"""Backend tests for the new IP Pool + SOCKS5 features.

Only small counts are used to preserve FloppyData bandwidth. Max 3 scans.
"""
import os
import time
import pytest
import requests
from pathlib import Path

FE_ENV = Path("/app/frontend/.env").read_text()
BASE_URL = None
for line in FE_ENV.splitlines():
    if line.startswith("REACT_APP_BACKEND_URL="):
        BASE_URL = line.split("=", 1)[1].strip().strip('"').rstrip("/")
        break
assert BASE_URL, "REACT_APP_BACKEND_URL missing"

TIMEOUT = 120


@pytest.fixture(scope="module")
def s():
    sess = requests.Session()
    sess.headers.update({"Content-Type": "application/json"})
    return sess


REQUIRED_ITEM_FIELDS = [
    "ip", "port", "host", "username", "password", "connection_string",
    "country", "state", "state_code", "city", "zip", "isp", "domain",
    "kind", "latency_ms", "added_at", "id",
]


# 1) SCAN #1: US / Texas, small count
@pytest.fixture(scope="module")
def scan_tx(s):
    start = time.time()
    r = s.post(
        f"{BASE_URL}/api/pool/scan",
        json={"type": "residential", "country": "US", "state": "Texas", "count": 5},
        timeout=TIMEOUT,
    )
    elapsed = time.time() - start
    assert r.status_code == 200, r.text
    data = r.json()
    print(f"scan_tx took {elapsed:.1f}s -> scanned={data['scanned']} alive={data['alive']} new={data['new']}")
    assert elapsed < 90, f"scan too slow ({elapsed:.1f}s)"
    return data


def test_pool_scan_shape(scan_tx):
    assert "scanned" in scan_tx and "alive" in scan_tx and "new" in scan_tx
    assert scan_tx["scanned"] == 5
    assert isinstance(scan_tx["items"], list)
    assert len(scan_tx["items"]) >= 1, "expected at least 1 alive IP"
    sample = scan_tx["items"][0]
    for f in REQUIRED_ITEM_FIELDS:
        assert f in sample, f"missing field: {f}"
    assert sample["country"] == "US"
    assert sample["port"] == 10080
    assert sample["latency_ms"] is None or isinstance(sample["latency_ms"], int)


def test_pool_list_no_underscore_id(s, scan_tx):
    r = s.get(f"{BASE_URL}/api/pool", timeout=TIMEOUT)
    assert r.status_code == 200
    items = r.json()
    assert isinstance(items, list) and len(items) >= 1
    for it in items:
        assert "_id" not in it
    # sorted desc by added_at
    times = [it.get("added_at") for it in items if it.get("added_at")]
    assert times == sorted(times, reverse=True)


def test_pool_delete_single(s, scan_tx):
    r = s.get(f"{BASE_URL}/api/pool", timeout=TIMEOUT)
    items = r.json()
    initial = len(items)
    # pick an ephemeral one to delete (choose most recent from scan_tx)
    target = scan_tx["items"][-1]
    tid = target["id"]
    d = s.delete(f"{BASE_URL}/api/pool/{tid}", timeout=TIMEOUT)
    assert d.status_code == 200 and d.json().get("ok") is True
    r2 = s.get(f"{BASE_URL}/api/pool", timeout=TIMEOUT)
    ids_after = {it["id"] for it in r2.json()}
    assert tid not in ids_after
    assert len(r2.json()) == initial - 1


# 2) ACTIVATE a pool item -> proxy/test must return SAME exit IP (sticky)
def test_activate_pool_item_and_sticky_exit_ip(s, scan_tx):
    # get freshest pool list & pick an item still present
    r = s.get(f"{BASE_URL}/api/pool", timeout=TIMEOUT)
    items = r.json()
    assert items
    # match to remaining scan_tx item
    remaining_ips = {it["ip"] for it in items}
    item = next((x for x in scan_tx["items"] if x["ip"] in remaining_ips), items[0])

    # activate expects ProxyConnection model - ensure required fields present
    payload = {
        "id": item["id"],
        "type": item.get("type", "residential"),
        "country": item.get("country"),
        "city": item.get("city"),
        "state": item.get("state"),
        "protocol": item.get("protocol", "http"),
        "host": item["host"],
        "port": item["port"],
        "username": item["username"],
        "password": item["password"],
        "connection_string": item["connection_string"],
        "rotation": item.get("rotation", 0),
        "exit_ip": item.get("exit_ip") or item["ip"],
        "latency_ms": item.get("latency_ms"),
        "status": "alive",
    }
    a = s.post(f"{BASE_URL}/api/proxy/activate", json=payload, timeout=TIMEOUT)
    assert a.status_code == 200, a.text
    assert a.json()["ok"] is True

    # proxy/active shows this IP
    ac = s.get(f"{BASE_URL}/api/proxy/active", timeout=TIMEOUT).json()["active"]
    assert ac["exit_ip"] == payload["exit_ip"]

    # proxy/test -> sticky same exit IP
    t = s.post(f"{BASE_URL}/api/proxy/test", json={}, timeout=TIMEOUT)
    assert t.status_code == 200, t.text
    tdata = t.json()
    assert tdata["status"] == "alive"
    assert tdata["exit_ip"] == payload["exit_ip"], \
        f"sticky broke: {tdata['exit_ip']} vs {payload['exit_ip']}"


# 3) SOCKS5 build + activate + fetch
def test_build_socks5_and_fetch(s):
    r = s.post(
        f"{BASE_URL}/api/proxy/build",
        json={"type": "residential", "country": "US", "protocol": "socks5", "rotation": 15},
        timeout=TIMEOUT,
    )
    assert r.status_code == 200, r.text
    data = r.json()
    assert data["protocol"] == "socks5"
    assert data["port"] == 10800
    assert data["status"] == "alive"
    assert data["exit_ip"]

    a = s.post(f"{BASE_URL}/api/proxy/activate", json=data, timeout=TIMEOUT)
    assert a.status_code == 200

    f = s.post(
        f"{BASE_URL}/api/proxy/fetch",
        json={"url": "https://api.ipify.org?format=json"},
        timeout=TIMEOUT,
    )
    assert f.status_code == 200, f.text
    fd = f.json()
    assert fd["http_status"] == 200
    assert "ip" in (fd.get("body_preview") or "")
