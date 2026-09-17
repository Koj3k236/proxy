# PRD — FloppyData Proxy Gateway

## Original Problem Statement
Tugas kuliah (dosen): buat web yang mengambil daftar proxy dari floppydata.com, filter & pilih satu proxy (IP, PORT, TYPE, COUNTRY), lalu web bertindak sebagai "proxy server kamu" (:8080) yang meneruskan traffic lewat proxy terpilih ke web. Alur: FLOPPYDATA → ambil daftar proxy → filter proxy dipilih → PROXY SERVER KAMU :8080 → WEB KAMU.

## User Choices
- Punya FloppyData API key (disimpan di backend/.env FLOPPYDATA_API_KEY, bisa diubah via Settings).
- Fungsi: dashboard + benar-benar meneruskan traffic (keduanya).
- Port :8080 hanya konseptual (backend di-manage supervisor).
- Fitur tambahan: health test proxy, filter country/type, riwayat proxy.
- Tema: dark technical/hacker dashboard.

## Architecture
- Frontend: React (CRA + craco), Tailwind + shadcn/ui, dark neon theme (Cabinet Grotesk / IBM Plex Sans / JetBrains Mono).
- Backend: FastAPI, MongoDB (settings + history collections).
- Upstream: FloppyData Client API v2 (https://api.floppydata.net, header X-Api-Key). Account punya rotating residential (~10GB); static inventory kosong sehingga aplikasi memakai rotating locations + build connection.
- Backend bertindak sebagai proxy server: `probe_proxy()` resolve exit IP via ipify, `fetch_through_proxy()` meneruskan URL target lewat proxy aktif (requests via asyncio.to_thread).

## Implemented (2026-06-17)
- Settings API + dialog: simpan/ganti API key (masked), status env/user.
- GET /api/account/balance (saldo GB rotating).
- GET /api/locations?type= — daftar lokasi proxy per type (residential/mobile/datacenter).
- POST /api/proxy/build — bangun koneksi rotating + tes (exit_ip, latency, alive/dead).
- POST /api/proxy/activate — set proxy aktif + catat history (unique history _id).
- GET /api/proxy/active, POST /api/proxy/test, POST /api/proxy/fetch.
- GET/DELETE /api/history.
- Dashboard UI: Active Proxy hero card, Architecture Flow visual, Proxy List (tabs+search), Test & Fetch terminal, Usage History, balance chip.
- Verified end-to-end: build→activate→fetch mengembalikan exit IP US yang cocok; testing agent 100% backend & frontend.

## Backlog (P1/P2)
- P1: DialogDescription/aria untuk a11y warning Radix.
- P2: auth pada POST /api/settings (proteksi API key) untuk produksi.
- P2: timeout proxy configurable via env; opsi httpx async.
- P2: export/share connection string, multi-proxy compare, country flag via CDN images.

## Next Tasks
- Menunggu feedback user setelah review awal.
