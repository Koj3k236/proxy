from fastapi import FastAPI, APIRouter, HTTPException
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import re
import time
import uuid
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
