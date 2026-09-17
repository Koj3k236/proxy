"""Backend tests for iteration_3: forward proxy gateway + settings port + bulk scan.

Gateway is only reachable inside the container, so we hit http://localhost:<port>
directly for the proxy tunnel and the external REACT_APP_BACKEND_URL for the API.
"""
import json
import os
import time
from pathlib import Path

import pytest
import requests

FE_ENV = Path("/app/frontend/.env").read_text()
BASE_URL = next(
    l.split("=", 1)[1].strip().strip('"').rstrip("/")
    for l in FE_ENV.splitlines() if l.startswith("REACT_APP_BACKEND_URL=")
)
TIMEOUT = 60


@pytest.fixture(scope="module")
def s():
    return requests.Session()


def _via_gw(port, url, timeout=40):
    return requests.get(url, proxies={
        "http": f"http://localhost:{port}",
        "https": f"http://localhost:{port}",
    }, timeout=timeout)


# --- gateway with active proxy: HTTPS + HTTP ------------------------------
def test_gateway_status_running(s):
    r = s.get(f"{BASE_URL}/api/gateway/status", timeout=TIMEOUT)
    assert r.status_code == 200
    d = r.json()
    assert d["running"] is True
    assert d["port"] == 8888
    assert d["active_ip"], "no active proxy set"


def test_gateway_https_and_http_through_active(s):
    active = s.get(f"{BASE_URL}/api/proxy/active", timeout=TIMEOUT).json()["active"]
    assert active, "activate a proxy first"
    exit_ip = active["exit_ip"]

    rs = _via_gw(8888, "https://api.ipify.org?format=json")
    assert rs.status_code == 200
    assert rs.json()["ip"] == exit_ip

    rh = _via_gw(8888, "http://api.ipify.org?format=json")
    assert rh.status_code == 200
    assert rh.json()["ip"] == exit_ip

    st = s.get(f"{BASE_URL}/api/gateway/status", timeout=TIMEOUT).json()
    assert st["connections"] >= 2
    assert st["bytes_down"] > 0
    assert st["last_target"]


# --- HTTP upstream sticky --------------------------------------------------
def test_gateway_via_http_pool_item(s):
    pool = s.get(f"{BASE_URL}/api/pool", timeout=TIMEOUT).json()
    item = next((x for x in pool if x.get("protocol") == "http"), None)
    assert item, "no http pool item"
    r = s.post(f"{BASE_URL}/api/proxy/activate", json=item, timeout=TIMEOUT)
    assert r.status_code == 200
    time.sleep(0.5)
    got = _via_gw(8888, "https://api.ipify.org?format=json").json()
    assert got["ip"] == item["exit_ip"]


# --- SOCKS5 upstream -------------------------------------------------------
def test_gateway_via_socks5_build(s):
    r = s.post(f"{BASE_URL}/api/proxy/build",
               json={"type": "residential", "country": "US", "protocol": "socks5", "rotation": 0},
               timeout=TIMEOUT)
    assert r.status_code == 200
    built = r.json()
    assert built["port"] == 10800
    s.post(f"{BASE_URL}/api/proxy/activate", json=built, timeout=TIMEOUT)
    time.sleep(0.5)
    got = _via_gw(8888, "https://api.ipify.org?format=json").json()
    assert got["ip"] == built["exit_ip"]


# --- settings port switch --------------------------------------------------
def test_settings_port_switch_and_errors(s):
    # switch to 8899
    r = s.post(f"{BASE_URL}/api/settings", json={"gateway_port": 8899}, timeout=TIMEOUT)
    assert r.status_code == 200
    assert r.json()["gateway_port"] == 8899
    time.sleep(0.5)
    got = _via_gw(8899, "https://api.ipify.org?format=json").json()
    assert "ip" in got

    assert s.get(f"{BASE_URL}/api/settings", timeout=TIMEOUT).json()["gateway_port"] == 8899

    # occupied port
    r_occ = s.post(f"{BASE_URL}/api/settings", json={"gateway_port": 8080}, timeout=TIMEOUT)
    assert r_occ.status_code == 400
    assert "dipakai" in r_occ.json()["detail"].lower()
    st = s.get(f"{BASE_URL}/api/gateway/status", timeout=TIMEOUT).json()
    assert st["port"] == 8899 and st["running"] is True

    # out of range
    r_bad = s.post(f"{BASE_URL}/api/settings", json={"gateway_port": 80}, timeout=TIMEOUT)
    assert r_bad.status_code == 400

    # restore
    r_back = s.post(f"{BASE_URL}/api/settings", json={"gateway_port": 8888}, timeout=TIMEOUT)
    assert r_back.status_code == 200
    assert r_back.json()["gateway_port"] == 8888


# --- bulk scan lifecycle ---------------------------------------------------
def test_bulk_scan_flow(s):
    # ensure stopped
    s.post(f"{BASE_URL}/api/pool/scan-bulk/stop", timeout=TIMEOUT)
    time.sleep(1)

    r = s.post(f"{BASE_URL}/api/pool/scan-bulk", json={"country": "US", "per_state": 2}, timeout=TIMEOUT)
    assert r.status_code == 200
    d = r.json()
    assert d["running"] is True
    assert d["total"] >= 40
    assert d["per_state"] == 2

    # 409 on duplicate
    r2 = s.post(f"{BASE_URL}/api/pool/scan-bulk", json={"country": "US", "per_state": 2}, timeout=TIMEOUT)
    assert r2.status_code == 409

    # status increases
    time.sleep(6)
    st = s.get(f"{BASE_URL}/api/pool/scan-bulk/status", timeout=TIMEOUT).json()
    assert st["done"] >= 1
    assert st["running"] is True

    # stop
    r3 = s.post(f"{BASE_URL}/api/pool/scan-bulk/stop", timeout=TIMEOUT)
    assert r3.status_code == 200
    assert r3.json()["running"] is False
