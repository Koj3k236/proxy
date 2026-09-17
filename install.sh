#!/usr/bin/env bash
# Deploy FloppyData Proxy Gateway ke VPS (Ubuntu/Debian) dengan Docker.
set -e
cd "$(dirname "$0")"

if [ "$(id -u)" -ne 0 ]; then SUDO="sudo"; else SUDO=""; fi

if ! command -v docker >/dev/null 2>&1; then
  echo ">> Docker belum ada, menginstal..."
  curl -fsSL https://get.docker.com | $SUDO sh
fi
if ! docker compose version >/dev/null 2>&1; then
  echo ">> Menginstal docker compose plugin..."
  $SUDO apt-get update -y && $SUDO apt-get install -y docker-compose-plugin
fi

[ -f .env ] && set -a && . ./.env && set +a

PUBLIC_IP=$(curl -s -4 https://api.ipify.org || hostname -I | awk '{print $1}')

read -r -p "FloppyData API key [${FLOPPYDATA_API_KEY:+tersimpan}]: " IN_KEY
FLOPPYDATA_API_KEY=${IN_KEY:-$FLOPPYDATA_API_KEY}
[ -z "$FLOPPYDATA_API_KEY" ] && { echo "API key wajib diisi."; exit 1; }

read -r -p "Port web dashboard [${WEB_PORT:-80}]: " IN_WEB
WEB_PORT=${IN_WEB:-${WEB_PORT:-80}}

read -r -p "Port proxy gateway [${GATEWAY_PORT:-8888}]: " IN_GW
GATEWAY_PORT=${IN_GW:-${GATEWAY_PORT:-8888}}

DEFAULT_URL="http://${PUBLIC_IP}$([ "$WEB_PORT" = "80" ] || echo ":$WEB_PORT")"
read -r -p "URL publik dashboard [${PUBLIC_URL:-$DEFAULT_URL}]: " IN_URL
PUBLIC_URL=${IN_URL:-${PUBLIC_URL:-$DEFAULT_URL}}

cat > .env <<EOF
FLOPPYDATA_API_KEY=$FLOPPYDATA_API_KEY
WEB_PORT=$WEB_PORT
GATEWAY_PORT=$GATEWAY_PORT
PUBLIC_URL=$PUBLIC_URL
EOF

if command -v ufw >/dev/null 2>&1 && $SUDO ufw status | grep -q "Status: active"; then
  $SUDO ufw allow "$WEB_PORT"/tcp >/dev/null || true
  $SUDO ufw allow "$GATEWAY_PORT"/tcp >/dev/null || true
fi

echo ">> Build & start container (pertama kali ±3-5 menit)..."
$SUDO docker compose up -d --build

echo
echo "================================================================"
echo " Dashboard : $PUBLIC_URL"
echo " Proxy     : $PUBLIC_IP:$GATEWAY_PORT  (HTTP proxy, tanpa login)"
echo " Tes       : curl -x http://$PUBLIC_IP:$GATEWAY_PORT https://api.ipify.org"
echo " Log       : docker compose logs -f backend"
echo " Stop      : docker compose down"
echo "================================================================"
