#!/bin/bash
# One command end to end run: payments API (:8001) + Gemini detector (:8000) + Next.js portal (:3000),
# a $0.50 Stripe test tip, then the demo stream with real Gemini analysis and real Stripe payouts.
#
#   ./scripts/run_e2e.sh                 Ctrl+C stops everything
#   ./scripts/run_e2e.sh <video or URL>  analyze something else (file path, Twitch or YouTube live URL)
#
# Needs: .env with the payments keys, GEMINI_API_KEY and SUPARADE_CAMPAIGN_ID (backend/.env can override), Node, ffmpeg
# (installed with Homebrew if missing). Logs go to backend/logs/.
set -euo pipefail
cd "$(dirname "$0")/.."
ROOT="$(pwd)"
LOGS="$ROOT/backend/logs"
mkdir -p "$LOGS"
export PYTHONWARNINGS=ignore  # hides the harmless LibreSSL warning on macOS system Python
VIDEO="${1:-backend/demo/demo_stream.mp4}"

step() { printf "\n\033[1m== %s\033[0m\n" "$1"; }
fail() { printf "\033[31mFAILED: %s\033[0m\n" "$1"; exit 1; }
free_ports() {
  for port in 8000 8001 3000; do
    pid=$(lsof -ti tcp:$port -sTCP:LISTEN 2>/dev/null || true)
    if [ -n "$pid" ]; then kill $pid 2>/dev/null || true; fi
  done
}
cleanup() { printf "\nStopping servers...\n"; free_ports; }
wait_for() {
  for _ in $(seq 1 90); do
    curl -sf "$1" >/dev/null 2>&1 && return 0
    sleep 1
  done
  return 1
}

step "1. Checks"
[ -f .env ] || fail ".env is missing in $ROOT"
# backend/.env wins over the root .env, like in backend/config.py
setting() { { cat backend/.env .env 2>/dev/null || true; } | grep "^$1=" | head -1 | cut -d= -f2- | tr -d '[:space:]' || true; }
[ -n "$(setting GEMINI_API_KEY)" ] || fail "GEMINI_API_KEY is empty in .env"
CAMPAIGN=$(setting SUPARADE_CAMPAIGN_ID)
[ -n "$CAMPAIGN" ] || fail "SUPARADE_CAMPAIGN_ID is empty in .env"
command -v npm >/dev/null || fail "Node.js is missing (https://nodejs.org)"
if ! command -v ffmpeg >/dev/null; then
  command -v brew >/dev/null || fail "ffmpeg is missing and Homebrew is not installed (https://brew.sh)"
  echo "Installing ffmpeg with Homebrew, this takes a few minutes..."
  brew install ffmpeg
fi
[ -d .venv ] || python3 -m venv .venv
# shellcheck disable=SC1091
source .venv/bin/activate
echo "ok: $(python --version 2>&1), node $(node --version), ffmpeg found"

step "2. Python packages"
pip install -q --disable-pip-version-check -r requirements.txt -r backend/requirements.txt
echo "ok"

step "3. Freeing ports 8000, 8001, 3000"
free_ports
sleep 1
trap cleanup EXIT INT TERM
set -a
# shellcheck disable=SC1091
source .env
set +a
echo "ok"

step "4. Payments API on :8001"
uvicorn app.main:app --port 8001 > "$LOGS/payments.log" 2>&1 &
wait_for http://localhost:8001/health || fail "payments API did not start, see backend/logs/payments.log"
echo "ok"

step "4b. Stripe transfer descriptions (adds the agent's reason to older tips)"
python -m scripts.backfill_transfer_descriptions || echo "(could not update some older transfers, new ones are fine)"

step "5. Campaign budget"
balance() {
  curl -s -H "X-Agent-Key: $AGENT_API_KEY" "http://localhost:8001/agent/campaigns/$CAMPAIGN/context" |
    python -c 'import sys, json; print(json.load(sys.stdin)["balance_cents"])'
}
BAL=$(balance) || fail "could not read the campaign, see backend/logs/payments.log"
echo "budget left: $BAL cents"
if [ "$BAL" -lt 1000 ]; then
  echo "adding 1500 cents of sandbox dev credit"
  curl -s -X POST "http://localhost:8001/campaigns/$CAMPAIGN/dev-credit" \
    -H "X-Agent-Key: $AGENT_API_KEY" -H "Content-Type: application/json" -d '{"amount_cents":1500}'
  echo
  echo "budget left: $(balance) cents"
fi

step "5b. Stripe platform balance (every transfer to a streamer is paid from it)"
AVAIL=$(python -c 'from app.stripe_utils import as_dict, get_stripe
print(sum(b["amount"] for b in as_dict(get_stripe().Balance.retrieve())["available"] if b["currency"] == "usd"))')
echo "available: $AVAIL cents"
if [ "$AVAIL" -lt 1000 ]; then
  echo "adding 2000 cents of Stripe test funds"
  python -m scripts.stripe_check --add-test-funds 2000 | grep -E "payment|FAILED" || true
fi

step "6. Test tip without Gemini (\$0.50 Stripe sandbox transfer to demo-streamer)"
OUT=$(python -m backend.payments demo-streamer 2>&1 || true)
echo "$OUT" | grep -E "^(payment|campaign):" || echo "$OUT" | tail -20
echo "$OUT" | grep -q "status='paid'" || fail "the test tip was not paid (details above, and backend/logs/payments.log)"
echo "ok, Stripe paid the test tip"

step "7. Gemini detector on :8000"
uvicorn backend.main:app --port 8000 > "$LOGS/detector.log" 2>&1 &
wait_for http://localhost:8000/api/health || fail "detector did not start, see backend/logs/detector.log"
curl -s http://localhost:8000/api/payments
echo

step "8. Portal on :3000"
if [ ! -d frontend/node_modules ]; then (cd frontend && npm install --silent); fi
(cd frontend && exec npm run dev -- --port 3000) > "$LOGS/portal.log" 2>&1 &
wait_for http://localhost:3000 || fail "portal did not start, see backend/logs/portal.log"
open http://localhost:3000 2>/dev/null || true
echo "ok, http://localhost:3000 (tip alert overlay: http://localhost:3000/alert)"

step "9. Watching $VIDEO as demo-streamer (demo mode)"
sleep 3
curl -s -X POST http://localhost:8000/api/sessions -H "Content-Type: application/json" \
  -d "{\"source\":\"url\",\"url\":\"$VIDEO\",\"streamer_id\":\"demo-streamer\",\"demo_alerts\":true,\"chat_script\":\"backend/demo/chat_demo.json\"}"
echo
printf "\n\033[1mRunning. Watch the portal. Ctrl+C stops everything.\033[0m\n\n"
tail -n 0 -f "$LOGS/detector.log" | grep --line-buffered -E "payments|tip |ERROR|Traceback|session |refused|webhook"
