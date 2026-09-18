# FloppyData Proxy Gateway

Web dashboard + proxy server yang mengambil daftar proxy dari **FloppyData**, memfilter per negara / state / kota / ISP / type, lalu menjadikan **satu IP** sebagai proxy aktif. Traffic dari browser/aplikasi kamu diteruskan lewat IP tersebut.

```
FLOPPYDATA ──▶ Scan & ambil daftar IP ──▶ Filter & pilih 1 IP (USE) ──▶ PROXY SERVER KAMU :8888 ──▶ WEB TUJUAN
```

## Fitur
| Step | Fitur | Keterangan |
|---|---|---|
| 1 | **IP Pool** | Tabel per-IP gaya 922proxy: IP:port, Domain (rDNS), State, City, ISP, ZIP, Ping, Type (ISP / ISP-MOB / DC), Added. Nav wilayah (USA, America, Europe, AU/Oceania, Asia, Africa), chip state/negara, filter per kolom. |
| 1 | **Scan IP** | Ambil N IP nyata (10/20/50) untuk type + negara + state + kota + protocol (HTTP/SOCKS5). |
| 1 | **Scan USA** | Scan massal semua state Amerika di background, dengan progress bar & Stop. |
| 1 | **USE** | Jadikan IP itu proxy aktif (sesi *sticky* — IP tidak berubah). |
| 2 | **Proxy Server :8888** | Forward proxy asli (HTTP CONNECT + plain HTTP) tanpa login. Backend men-tunnel ke FloppyData (HTTP Basic atau SOCKS5) lalu keluar lewat IP aktif. Port bisa diganti di Settings. |
| 2 | **Test & Fetch** | Health check (exit IP + latency) dan fetch URL apa pun lewat proxy aktif. |
| 3 | **Cara Pakai** | Snippet siap-copy: Gateway :8888, curl, Windows/macOS, Firefox, Telegram, Python, Shell env. |
| 4 | **Riwayat Proxy** | Semua IP yang pernah diaktifkan, bisa diaktifkan ulang. |
| — | **Settings** | Simpan/ganti API key FloppyData, ganti port gateway. |

## Alur Kerja Lengkap

### 1. Ambil daftar proxy
- Backend memanggil `GET https://api.floppydata.net/v2/proxy/rotating/locations?type=residential|mobile|datacenter` (header `X-Api-Key`) → daftar negara beserta state & kota.
- FloppyData **tidak** memberi daftar IP mentah. IP "muncul" saat sebuah sesi dibuat. Karena itu tombol **Scan IP / Scan USA** melakukan:
  1. `POST /v2/proxy/rotating/connections` dengan `rotation: 0` (sticky) sebanyak N kali → N sesi dengan username unik.
  2. Setiap sesi dites lewat proxy ke `api.ipify.org` → **exit IP + ping**. Yang mati dibuang.
  3. Exit IP dilengkapi data **ip-api.com** (state, kota, ZIP, ISP, flag mobile/hosting → type ISP / ISP-MOB / DC) dan **reverse DNS** (domain).
  4. Disimpan ke MongoDB koleksi `pool` (upsert per IP).

### 2. Filter & pilih satu IP
- Tabel di-filter di browser: wilayah → state/negara (chip) → kolom (IP, Domain, ST, City, ISP, ZIP, Type).
- Klik **USE** → `POST /api/proxy/activate` menyimpan proxy aktif (host, port, username sesi, password, protocol) ke `settings.active_proxy` + mencatat ke `history`.

### 3. Proxy server kamu (:8888)
- Saat backend start, sebuah TCP server dibuka di `GATEWAY_PORT` (default 8888).
- Browser/OS diarahkan ke `alamat-server:8888` **tanpa username/password**.
- Untuk tiap koneksi masuk:
  - `CONNECT host:443` (HTTPS) → backend membuka tunnel ke FloppyData (`geo.g-w.info:10080` via `CONNECT` + `Proxy-Authorization`, atau `:10800` via handshake SOCKS5 + auth) ke host tujuan, balas `200 Connection Established`, lalu pipe dua arah.
  - `GET http://host/path` (HTTP biasa) → tunnel yang sama, request ditulis ulang ke bentuk origin, lalu pipe.
- Username sesi yang dipakai saat tunnel = username IP yang di-USE → website tujuan melihat **exit IP yang sama**.
- Statistik (koneksi, bytes, target terakhir) di `GET /api/gateway/status`.

### 4. Cara pakai dari aplikasi lain
Ada dua jalur, keduanya tampil siap-copy di panel **Cara Pakai**:

| Jalur | Isi di aplikasi | Catatan |
|---|---|---|
| **Gateway :8888** | Proxy HTTP `IP-server:8888`, tanpa login | Perlu app berjalan di laptop/VPS sendiri (port 8888 harus terjangkau). |
| **Langsung FloppyData** | Host `geo.g-w.info`, Port `10080` (HTTP) / `10800` (SOCKS5), Username sesi, Password | Bisa dari perangkat mana pun, termasuk HP. |

Verifikasi: buka https://api.ipify.org → harus menampilkan IP yang sedang aktif, atau klik **Health Check**.

## Arsitektur
```
frontend/  React (CRA + craco) · Tailwind · shadcn/ui · axios      → :3000 (dev) / nginx :80 (VPS)
backend/   FastAPI · Motor (MongoDB) · requests[socks] · asyncio    → :8001 (API)  +  :8888 (proxy gateway)
MongoDB    settings (api_key, gateway_port, active_proxy) · pool · history
```

Komponen frontend utama: `pages/Dashboard.jsx`, `components/pool/{IPPool,PoolTable,RegionNav,ScanDialog,BulkScan}.jsx`, `ActiveProxyCard`, `ArchitectureFlow`, `ProxyTools`, `UsageGuide`, `UsageHistory`, `SettingsDialog`.

## API Backend (prefix `/api`)
| Method | Path | Fungsi |
|---|---|---|
| GET/POST | `/settings` | Status API key & port gateway · simpan `api_key` / `gateway_port` |
| GET | `/account/balance` | Sisa kuota FloppyData |
| GET | `/locations?type=` | Daftar negara/state/kota |
| POST | `/pool/scan` | Scan N IP `{type,country,state?,city?,protocol,count}` |
| POST | `/pool/scan-bulk` | Scan massal per state `{country,per_state}` (background) |
| GET / POST | `/pool/scan-bulk/status` · `/pool/scan-bulk/stop` | Progress / hentikan |
| GET / DELETE | `/pool` · `/pool/{id}` | Daftar pool / hapus |
| POST | `/proxy/build` | Bangun 1 sesi rotating/sticky + tes `{type,country,protocol,rotation}` |
| POST | `/proxy/activate` | Jadikan proxy aktif (dipakai gateway) |
| GET | `/proxy/active` | Proxy aktif saat ini |
| POST | `/proxy/test` | Health check proxy aktif |
| POST | `/proxy/fetch` | Fetch URL lewat proxy aktif `{url}` |
| GET | `/gateway/status` | Status & statistik proxy server :8888 |
| GET / DELETE | `/history` · `/history/{id}` | Riwayat |

## Menjalankan Lokal (development)
```bash
# backend
cd backend && pip install -r requirements.txt
# isi backend/.env: MONGO_URL, DB_NAME, FLOPPYDATA_API_KEY, GATEWAY_PORT=8888, CORS_ORIGINS=*
uvicorn server:app --host 0.0.0.0 --port 8001 --reload

# frontend
cd frontend && yarn install
# isi frontend/.env: REACT_APP_BACKEND_URL=http://localhost:8001
yarn start
```
Buka http://localhost:3000, lalu tes proxy: `curl -x http://localhost:8888 https://api.ipify.org`.

## Deploy ke VPS
Lihat **[DEPLOY-VPS.md](DEPLOY-VPS.md)** — cukup `git clone` lalu `./install.sh` (Docker otomatis terpasang).

## Environment Variables
| File | Key | Keterangan |
|---|---|---|
| backend/.env | `MONGO_URL`, `DB_NAME` | Koneksi MongoDB |
| backend/.env | `FLOPPYDATA_API_KEY` | API key FloppyData (bisa juga diisi lewat Settings) |
| backend/.env | `GATEWAY_PORT` | Port proxy server (default 8888) |
| backend/.env | `CORS_ORIGINS` | Origin yang diizinkan |
| frontend/.env | `REACT_APP_BACKEND_URL` | URL backend |

## Catatan Keamanan
- Gateway :8888 tidak ber-autentikasi. Di VPS, batasi dengan firewall ke IP kamu (`ufw allow from IP-KAMU to any port 8888`).
- API key di-mask di UI dan hanya dipakai di backend.
