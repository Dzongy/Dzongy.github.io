#!/bin/bash
# zenith_deploy.sh â ZENITH Sovereign Nexus v2 Deploy Script
set -euo pipefail

ZENITH_DIR="${HOME}/zenith-mint"
SEED_FILE="${ZENITH_DIR}/zenith_seed.json"
SERVER_FILE="${ZENITH_DIR}/amos.js"
SOL_KEY_FILE="${ZENITH_DIR}/.sol_key"
PORT="${ZENITH_PORT:-3005}"
HEALTH_URL="http://localhost:${PORT}/health"
MAX_RETRIES=10
RETRY_DELAY=2

CYAN='\033[0;36m'
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

log()  { echo -e "${CYAN}[ZENITH]${NC} $1"; }
ok()   { echo -e "${GREEN}[  OK  ]${NC} $1"; }
warn() { echo -e "${YELLOW}[ WARN ]${NC} $1"; }
fail() { echo -e "${RED}[ FAIL ]${NC} $1"; exit 1; }

echo ""
echo -e "${CYAN}+==========================================+${NC}"
echo -e "${CYAN}|     ZENITH SOVEREIGN NEXUS v2 DEPLOY     |${NC}"
echo -e "${CYAN}+==========================================+${NC}"
echo ""

log "Stopping existing processes..."
pkill -f "node.*amos.js" 2>/dev/null && warn "Killed existing amos.js" || true
pkill -f "cloudflared.*tunnel" 2>/dev/null && warn "Killed existing cloudflared" || true
sleep 1

log "Verifying files..."
cd "${ZENITH_DIR}" || fail "Cannot cd to ${ZENITH_DIR}"

if [ ! -f "${SEED_FILE}" ]; then fail "Missing: zenith_seed.json"; fi
ok "zenith_seed.json found"

if [ ! -f "${SERVER_FILE}" ]; then fail "Missing: amos.js"; fi
ok "amos.js found"

log "Installing npm dependencies..."
if ! command -v npm &>/dev/null; then fail "npm not found. Install Node.js first."; fi
npm install ws @solana/web3.js bs58 --no-audit --no-fund --silent 2>/dev/null
ok "Dependencies installed (ws, @solana/web3.js, bs58)"

if [ -f "${SOL_KEY_FILE}" ]; then
  SOL_KEY_PERMS=$(stat -c '%a' "${SOL_KEY_FILE}" 2>/dev/null || stat -f '%Lp' "${SOL_KEY_FILE}" 2>/dev/null || echo "unknown")
  if [ "${SOL_KEY_PERMS}" != "600" ]; then
    warn ".sol_key permissions are ${SOL_KEY_PERMS}, setting to 600"
    chmod 600 "${SOL_KEY_FILE}"
  fi
  export SOL_KEY=$(cat "${SOL_KEY_FILE}")
  ok "SOL key loaded from .sol_key"
else
  warn "No .sol_key file found â running without Solana key"
fi

log "Starting amos.js on port ${PORT}..."
export ZENITH_PORT="${PORT}"
nohup node "${SERVER_FILE}" > "${ZENITH_DIR}/amos.log" 2>&1 &
AMOS_PID=$!
ok "amos.js started (PID: ${AMOS_PID})"

log "Waiting for server health check..."
ATTEMPTS=0
SERVER_READY=false
while [ ${ATTEMPTS} -lt ${MAX_RETRIES} ]; do
  ATTEMPTS=$((ATTEMPTS + 1))
  sleep ${RETRY_DELAY}
  if curl -s -o /dev/null -w "%{http_code}" "${HEALTH_URL}" | grep -q "200"; then
    SERVER_READY=true
    break
  fi
  log "Retry ${ATTEMPTS}/${MAX_RETRIES}..."
done

if [ "${SERVER_READY}" = false ]; then fail "Server failed to respond after ${MAX_RETRIES} attempts. Check amos.log"; fi
ok "Server healthy at ${HEALTH_URL}"

if command -v cloudflared &>/dev/null; then
  log "Starting cloudflared tunnel..."
  nohup cloudflared tunnel --url "http://localhost:${PORT}" > "${ZENITH_DIR}/tunnel.log" 2>&1 &
  TUNNEL_PID=$!
  ok "Cloudflared started (PID: ${TUNNEL_PID})"
  log "Check tunnel.log for public URL"
else
  warn "cloudflared not found â skipping tunnel. Install with: pkg install cloudflared"
fi

cleanup() {
  echo ""
  log "Shutting down..."
  if [ -n "${AMOS_PID:-}" ]; then kill "${AMOS_PID}" 2>/dev/null && ok "amos.js stopped" || true; fi
  if [ -n "${TUNNEL_PID:-}" ]; then kill "${TUNNEL_PID}" 2>/dev/null && ok "cloudflared stopped" || true; fi
  log "Goodbye."
  exit 0
}
trap cleanup SIGINT SIGTERM

echo ""
echo -e "${GREEN}+==========================================+${NC}"
echo -e "${GREEN}|        ZENITH IS ALIVE â PORT ${PORT}        |${NC}"
echo -e "${GREEN}+==========================================+${NC}"
echo ""
log "Server PID : ${AMOS_PID}"
log "Health     : ${HEALTH_URL}"
log "Logs       : ${ZENITH_DIR}/amos.log"
[ -n "${TUNNEL_PID:-}" ] && log "Tunnel PID : ${TUNNEL_PID}"
echo ""
log "Press Ctrl+C to shut down gracefully."
wait