# Deploy ke VPS (Docker)

Butuh VPS Ubuntu/Debian dengan akses SSH (root atau sudo). Docker akan diinstal otomatis bila belum ada.

## 1. Ambil kode ke VPS
Klik **Save to GitHub** di Emergent, lalu di VPS:
```bash
git clone https://github.com/USERNAME/NAMA-REPO.git proxy-gateway
cd proxy-gateway
```

## 2. Jalankan installer
```bash
chmod +x install.sh
./install.sh
```
Installer akan menanyakan:
- **FloppyData API key**
- **Port web dashboard** (default 80)
- **Port proxy gateway** (default 8888)
- **URL publik dashboard** (otomatis `http://IP-VPS`)

Selesai → dashboard di `http://IP-VPS`, proxy di `IP-VPS:8888`.

## 3. Pakai proxy dari laptop/HP
Isi proxy HTTP di browser/OS: **Address `IP-VPS`, Port `8888`, tanpa username/password**.
Cek: buka https://api.ipify.org → harus tampil IP yang sedang di-USE di dashboard.

## Perintah berguna
```bash
docker compose logs -f backend     # lihat log gateway
docker compose restart backend     # restart
docker compose down                # stop semua
git pull && ./install.sh           # update ke versi terbaru
```

## Catatan
- Untuk mengganti port gateway di VPS, ubah `GATEWAY_PORT` di file `.env` lalu jalankan `./install.sh` lagi (perubahan port dari menu Settings dashboard hanya berlaku di dalam container).
- Amankan proxy: gateway :8888 terbuka tanpa login. Batasi akses dengan firewall ke IP kamu saja, mis. `ufw allow from IP-RUMAH to any port 8888` lalu `ufw delete allow 8888/tcp`.
