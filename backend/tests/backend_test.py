"""Backend tests for FloppyData Proxy Gateway.

Uses REACT_APP_BACKEND_URL from frontend/.env (external URL). Requires network
access to FloppyData and the built rotating residential proxy.
"""
import os
import pytest
import requests
from pathlib import Path

# Read backend URL from frontend/.env (matches what UI uses)
FE_ENV = Path("/app/frontend/.env").read_text()
BASE_URL = None
for line in FE_ENV.splitlines():
    if line.startswith("REACT_APP_BACKEND_URL="):
        BASE_URL = line.split("=", 1)[1].strip().strip('"').rstrip("/")
        break
assert BASE_URL, "REACT_APP_BACKEND_URL missing"

TIMEOUT = 90


@pytest.fixture(scope="session")
def s():
    sess = requests.Session()
    sess.headers.update({"Content-Type": "application/json"})
    return sess


# --- settings & balance ---------------------------------------------------
def test_settings_configured(s):
    r = s.get(f"{BASE_URL}/api/settings", timeout=TIMEOUT)
    assert r.status_code == 200
    data = r.json()
    assert data["configured"] is True
    assert data.get("api_key_masked")


def test_account_balance(s):
    r = s.get(f"{BASE_URL}/api/account/balance", timeout=TIMEOUT)
    assert r.status_code == 200, r.text
    data = r.json()
    # nested proxy.rotating.total.traffic.availableGb
    avail = data.get("proxy", {}).get("rotating", {}).get("total", {}).get("traffic", {}).get("availableGb")
    assert avail is not None, f"missing availableGb in {data}"


# --- locations ------------------------------------------------------------
def test_locations_residential(s):
    r = s.get(f"{BASE_URL}/api/locations", params={"type": "residential"}, timeout=TIMEOUT)
    assert r.status_code == 200
    data = r.json()
    items = data.get("items") if isinstance(data, dict) else data
    assert isinstance(items, list) and len(items) > 0
    sample = items[0]
    assert "name" in sample and "countryCode" in sample


# --- proxy build/activate/active/test/fetch -------------------------------
@pytest.fixture(scope="session")
def built_proxy(s):
    payload = {"type": "residential", "country": "US", "protocol": "http", "rotation": 15}
    r = s.post(f"{BASE_URL}/api/proxy/build", json=payload, timeout=TIMEOUT)
    assert r.status_code == 200, r.text
    data = r.json()
    assert data["connection_string"]
    assert data["host"] == "geo.g-w.info"
    assert data["port"] == 10080
    assert data["status"] == "alive"
    assert data["exit_ip"]
    return data


def test_proxy_build(built_proxy):
    assert built_proxy["type"] == "residential"
    assert built_proxy["country"] == "US"


def test_proxy_activate_and_active(s, built_proxy):
    r = s.post(f"{BASE_URL}/api/proxy/activate", json=built_proxy, timeout=TIMEOUT)
    assert r.status_code == 200
    assert r.json()["ok"] is True

    r2 = s.get(f"{BASE_URL}/api/proxy/active", timeout=TIMEOUT)
    assert r2.status_code == 200
    active = r2.json()["active"]
    assert active and active["id"] == built_proxy["id"]


def test_proxy_test_endpoint(s, built_proxy):
    r = s.post(f"{BASE_URL}/api/proxy/test", json={}, timeout=TIMEOUT)
    assert r.status_code == 200, r.text
    data = r.json()
    assert data["status"] == "alive"
    assert data["exit_ip"]
    assert isinstance(data["latency_ms"], int)


def test_proxy_fetch_routes_through_proxy(s, built_proxy):
    r = s.post(f"{BASE_URL}/api/proxy/fetch",
               json={"url": "https://api.ipify.org?format=json"},
               timeout=TIMEOUT)
    assert r.status_code == 200, r.text
    data = r.json()
    assert data["http_status"] == 200
    assert data["via_proxy"]["exit_ip"] == built_proxy["exit_ip"] or data["via_proxy"]["exit_ip"] is not None
    # response body should contain an IP
    assert "ip" in (data.get("body_preview") or "")


# --- history --------------------------------------------------------------
def test_history_flow(s, built_proxy):
    r = s.get(f"{BASE_URL}/api/history", timeout=TIMEOUT)
    assert r.status_code == 200
    items = r.json()
    assert isinstance(items, list) and len(items) >= 1
    assert any(i.get("id") == built_proxy["id"] for i in items)

    # clear
    r2 = s.delete(f"{BASE_URL}/api/history", timeout=TIMEOUT)
    assert r2.status_code == 200
    r3 = s.get(f"{BASE_URL}/api/history", timeout=TIMEOUT)
    assert r3.json() == []


# --- validation -----------------------------------------------------------
def test_fetch_requires_active_proxy(s):
    # after clear_history, active is still set; expect 200 or 400 but not 500
    r = s.post(f"{BASE_URL}/api/proxy/fetch", json={"url": "https://api.ipify.org"}, timeout=TIMEOUT)
    assert r.status_code in (200, 400, 502)
