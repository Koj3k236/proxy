from fastapi import FastAPI, APIRouter, HTTPException
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import re
import time
import uuid
import socket
import asyncio
import logging
import requests
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional, Any, Dict
from datetime import datetime, timezone

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

FLOPPY_BASE = os.environ.get('FLOPPYDATA_BASE_URL', 'https://api.floppydata.net')

app = FastAPI()
api_router = APIRouter(prefix="/api")

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


async def get_api_key() -> Optional[str]:
    doc = await db.settings.find_one({"_id": "app"})
    if doc and doc.get("api_key"):
        return doc["api_key"]
    return os.environ.get('FLOPPYDATA_API_KEY') or None


def floppy_request(method: str, path: str, api_key: str, json_body: Optional[dict] = None,
                   params: Optional[dict] = None) -> Dict[str, Any]:
    url = f"{FLOPPY_BASE}{path}"
    headers = {"X-Api-Key": api_key, "Content-Type": "application/json"}
    resp = requests.request(method, url, headers=headers, json=json_body, params=params, timeout=30)
    try:
        data = resp.json()
    except Exception:
        data = {"raw": resp.text}
    if resp.status_code >= 400:
        msg = data.get("error", {}).get("message") if isinstance(data, dict) else None
        raise HTTPException(status_code=resp.status_code, detail=msg or f"FloppyData error ({resp.status_code})")
    return data


def proxy_map(connection_string: str) -> Dict[str, str]:
    if connection_string.startswith("socks5://"):
        connection_string = "socks5h://" + connection_string[len("socks5://"):]
    return {"http": connection_string, "https": connection_string}


def probe_proxy(connection_string: str, target: str = "https://api.ipify.org?format=json") -> Dict[str, Any]:
    proxies = proxy_map(connection_string)
    start = time.time()
    try:
        r = requests.get(target, proxies=proxies, timeout=30)
        latency = int((time.time() - start) * 1000)
        exit_ip = None
        try:
            exit_ip = r.json().get("ip")
        except Exception:
            exit_ip = r.text.strip()
        return {"status": "alive", "exit_ip": exit_ip, "latency_ms": latency, "http_status": r.status_code}
    except Exception as e:
        latency = int((time.time() - start) * 1000)
        return {"status": "dead", "exit_ip": None, "latency_ms": latency, "error": str(e)}


def fetch_through_proxy(connection_string: str, url: str) -> Dict[str, Any]:
    proxies = proxy_map(connection_string)
    start = time.time()
    r = requests.get(url, proxies=proxies, timeout=45, headers={
        "User-Agent": "Mozilla/5.0 (compatible; FloppyProxyGateway/1.0)"
    })
    latency = int((time.time() - start) * 1000)
    text = r.text or ""
    title_match = re.search(r"<title[^>]*>(.*?)</title>", text, re.IGNORECASE | re.DOTALL)
    title = title_match.group(1).strip()[:200] if title_match else None
    return {
        "http_status": r.status_code,
        "final_url": str(r.url),
        "content_type": r.headers.get("content-type"),
        "content_length": len(r.content),
        "latency_ms": latency,
        "title": title,
        "headers": dict(r.headers),
        "body_preview": text[:6000],
    }


GEO_FIELDS = "status,countryCode,region,regionName,city,zip,isp,org,reverse,mobile,hosting,query"


def geo_lookup(ips: List[str]) -> Dict[str, Dict[str, Any]]:
    out: Dict[str, Dict[str, Any]] = {}
    for i in range(0, len(ips), 100):
        chunk = ips[i:i + 100]
        try:
            r = requests.post(f"http://ip-api.com/batch?fields={GEO_FIELDS}", json=chunk, timeout=30)
            for item in r.json():
                if item.get("status") == "success":
                    out[item["query"]] = item
        except Exception as e:
            logger.warning(f"geo lookup failed: {e}")
    return out


def rdns(ip: str) -> Optional[str]:
    try:
        name = socket.gethostbyaddr(ip)[0]
    except Exception:
        return None
    labels = name.split(".")
    return "*.*." + ".".join(labels[-2:]) if len(labels) > 2 else name


async def rdns_many(ips: List[str]) -> Dict[str, Optional[str]]:
    async def one(ip):
        try:
            return ip, await asyncio.wait_for(asyncio.to_thread(rdns, ip), timeout=6)
        except Exception:
            return ip, None
    pairs = await asyncio.gather(*[one(ip) for ip in ips])
    return dict(pairs)


def build_and_probe(api_key: str, payload: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    data = floppy_request("POST", "/v2/proxy/rotating/connections", api_key, payload)
    conn = data.get("connection", {})
    cs = conn.get("connectionString")
    probe = probe_proxy(cs)
    if probe.get("status") != "alive" or not probe.get("exit_ip"):
        return None
    return {
        "protocol": conn.get("protocol", payload["protocol"]),
        "host": conn.get("host"),
        "port": conn.get("port"),
        "username": conn.get("username"),
        "password": conn.get("password"),
        "connection_string": cs,
        "exit_ip": probe["exit_ip"],
        "latency_ms": probe["latency_ms"],
    }


def kind_of(geo: Dict[str, Any]) -> str:
    if geo.get("hosting"):
        return "DC"
    if geo.get("mobile"):
        return "ISP/MOB"
    return "ISP"


# ---------------------------------------------------------------------------
# Models
# ---------------------------------------------------------------------------
class SettingsIn(BaseModel):
    api_key: str


class BuildIn(BaseModel):
    type: str = "residential"
    country: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    protocol: str = "http"
    rotation: int = 15


class ProxyConnection(BaseModel):
    id: str
    type: str
    country: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    protocol: str
    host: str
    port: int
    username: str
    password: str
    connection_string: str
    rotation: int
    exit_ip: Optional[str] = None
    latency_ms: Optional[int] = None
    status: Optional[str] = None
    created_at: str = Field(default_factory=now_iso)


class ScanIn(BaseModel):
    type: str = "residential"
    country: str
    state: Optional[str] = None
    city: Optional[str] = None
    protocol: str = "http"
    count: int = 20


class FetchIn(BaseModel):
    url: str


class TestIn(BaseModel):
    connection_string: Optional[str] = None


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------
@api_router.get("/")
async def root():
    return {"message": "FloppyData Proxy Gateway API"}


@api_router.get("/settings")
async def get_settings():
    doc = await db.settings.find_one({"_id": "app"})
    db_key = doc.get("api_key") if doc else None
    env_key = os.environ.get('FLOPPYDATA_API_KEY')
    key = db_key or env_key
    masked = None
    if key:
        masked = key[:4] + "•" * max(0, len(key) - 8) + key[-4:] if len(key) > 8 else "••••"
    return {
        "configured": bool(key),
        "api_key_masked": masked,
        "source": "user" if db_key else ("env" if env_key else None),
    }


@api_router.post("/settings")
async def save_settings(body: SettingsIn):
    await db.settings.update_one(
        {"_id": "app"},
        {"$set": {"api_key": body.api_key.strip(), "updated_at": now_iso()}},
        upsert=True,
    )
    return {"ok": True}


@api_router.get("/account/balance")
async def account_balance():
    key = await get_api_key()
    if not key:
        raise HTTPException(status_code=400, detail="FloppyData API key belum diatur.")
    data = await asyncio.to_thread(floppy_request, "GET", "/v2/account/balances", key)
    return data


@api_router.get("/locations")
async def locations(type: str = "residential"):
    key = await get_api_key()
    if not key:
        raise HTTPException(status_code=400, detail="FloppyData API key belum diatur.")
    data = await asyncio.to_thread(floppy_request, "GET", "/v2/proxy/rotating/locations", key, None, {"type": type})
    return data


@api_router.post("/proxy/build")
async def proxy_build(body: BuildIn):
    key = await get_api_key()
    if not key:
        raise HTTPException(status_code=400, detail="FloppyData API key belum diatur.")

    payload: Dict[str, Any] = {"type": body.type, "protocol": body.protocol, "rotation": body.rotation}
    if body.country:
        payload["country"] = body.country
    if body.city:
        payload["city"] = body.city
    if body.state:
        payload["state"] = body.state

    data = await asyncio.to_thread(floppy_request, "POST", "/v2/proxy/rotating/connections", key, payload)
    conn = data.get("connection", {})
    cs = conn.get("connectionString")

    probe = await asyncio.to_thread(probe_proxy, cs)

    result = ProxyConnection(
        id=str(uuid.uuid4()),
        type=body.type,
        country=body.country,
        city=body.city,
        state=body.state,
        protocol=conn.get("protocol", body.protocol),
        host=conn.get("host"),
        port=conn.get("port"),
        username=conn.get("username"),
        password=conn.get("password"),
        connection_string=cs,
        rotation=body.rotation,
        exit_ip=probe.get("exit_ip"),
        latency_ms=probe.get("latency_ms"),
        status=probe.get("status"),
    )
    return result.model_dump()


@api_router.post("/proxy/activate")
async def proxy_activate(body: ProxyConnection):
    doc = body.model_dump()
    await db.settings.update_one({"_id": "app"}, {"$set": {"active_proxy": doc}}, upsert=True)
    hist = dict(doc)
    hist["used_at"] = now_iso()
    await db.history.insert_one({**hist, "_id": str(uuid.uuid4())})
    return {"ok": True, "active": doc}


@api_router.get("/proxy/active")
async def proxy_active():
    doc = await db.settings.find_one({"_id": "app"})
    if not doc or not doc.get("active_proxy"):
        return {"active": None}
    return {"active": doc["active_proxy"]}


@api_router.post("/proxy/test")
async def proxy_test(body: TestIn):
    cs = body.connection_string
    if not cs:
        doc = await db.settings.find_one({"_id": "app"})
        active = doc.get("active_proxy") if doc else None
        if not active:
            raise HTTPException(status_code=400, detail="Belum ada proxy aktif untuk diuji.")
        cs = active["connection_string"]
    result = await asyncio.to_thread(probe_proxy, cs)
    return result


@api_router.post("/proxy/fetch")
async def proxy_fetch(body: FetchIn):
    doc = await db.settings.find_one({"_id": "app"})
    active = doc.get("active_proxy") if doc else None
    if not active:
        raise HTTPException(status_code=400, detail="Belum ada proxy aktif. Pilih & aktifkan proxy dulu.")

    url = body.url.strip()
    if not re.match(r"^https?://", url):
        url = "https://" + url

    try:
        result = await asyncio.to_thread(fetch_through_proxy, active["connection_string"], url)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Gagal fetch lewat proxy: {e}")
    result["via_proxy"] = {
        "exit_ip": active.get("exit_ip"),
        "country": active.get("country"),
        "type": active.get("type"),
        "host": active.get("host"),
        "port": active.get("port"),
    }
    return result


@api_router.post("/pool/scan")
async def pool_scan(body: ScanIn):
    key = await get_api_key()
    if not key:
        raise HTTPException(status_code=400, detail="FloppyData API key belum diatur.")
    count = max(1, min(body.count, 50))
    payload: Dict[str, Any] = {"type": body.type, "protocol": body.protocol, "rotation": 0, "country": body.country}
    if body.state:
        payload["state"] = body.state
    if body.city:
        payload["city"] = body.city

    sem = asyncio.Semaphore(8)

    async def one():
        async with sem:
            try:
                return await asyncio.to_thread(build_and_probe, key, payload)
            except Exception as e:
                logger.warning(f"scan build failed: {e}")
                return None

    results = await asyncio.gather(*[one() for _ in range(count)])
    alive: Dict[str, Dict[str, Any]] = {}
    for r in results:
        if r and r["exit_ip"] not in alive:
            alive[r["exit_ip"]] = r

    geo = await asyncio.to_thread(geo_lookup, list(alive.keys())) if alive else {}
    domains = await rdns_many(list(alive.keys())) if alive else {}
    ts = now_iso()
    new_count = 0
    items = []
    for ip, r in alive.items():
        g = geo.get(ip, {})
        doc = {
            **r,
            "ip": ip,
            "type": body.type,
            "country": g.get("countryCode") or body.country,
            "state": (g.get("regionName") or (body.state or "")).replace("_", " ") or None,
            "state_code": g.get("region"),
            "city": (g.get("city") or (body.city or "")).replace("_", " ") or None,
            "zip": g.get("zip"),
            "isp": g.get("isp") or g.get("org"),
            "domain": domains.get(ip) or g.get("reverse"),
            "kind": kind_of(g) if g else "ISP",
            "rotation": 0,
            "status": "alive",
            "req_state": body.state,
            "req_city": body.city,
            "last_seen": ts,
        }
        existing = await db.pool.find_one({"ip": ip}, {"_id": 0, "id": 1, "added_at": 1})
        if existing:
            doc["id"] = existing["id"]
            doc["added_at"] = existing["added_at"]
        else:
            doc["id"] = str(uuid.uuid4())
            doc["added_at"] = ts
            doc["created_at"] = ts
            new_count += 1
        await db.pool.update_one({"ip": ip}, {"$set": doc}, upsert=True)
        items.append(doc)

    return {"scanned": count, "alive": len(alive), "new": new_count, "items": items}


@api_router.get("/pool")
async def pool_list():
    return await db.pool.find({}, {"_id": 0}).sort("added_at", -1).to_list(2000)


@api_router.delete("/pool/{item_id}")
async def pool_delete(item_id: str):
    await db.pool.delete_one({"id": item_id})
    return {"ok": True}


@api_router.delete("/pool")
async def pool_clear():
    await db.pool.delete_many({})
    return {"ok": True}


@api_router.get("/history")
async def get_history():
    items = await db.history.find({}, {"_id": 0}).sort("used_at", -1).to_list(200)
    return items


@api_router.delete("/history/{item_id}")
async def delete_history(item_id: str):
    await db.history.delete_one({"id": item_id})
    return {"ok": True}


@api_router.delete("/history")
async def clear_history():
    await db.history.delete_many({})
    return {"ok": True}


app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
