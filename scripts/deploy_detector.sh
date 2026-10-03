#!/bin/bash
# Deploy the Gemini detector to Supabase Compute: https://pvoesovsparqqzosgwki.supabase.co/compute/v1/detector
#
#   ./scripts/deploy_detector.sh
#
# The container can't read the root .env, and our access token can't set project secrets, so this writes the
# detector's own values to backend/.env.compute (gitignored), which ships in the upload. Never the whole .env.
# DETECTOR_KEY guards the endpoints that start, feed and stop sessions. It is generated once and kept in that file.
set -euo pipefail
cd "$(dirname "$0")/.."
OUT=backend/.env.compute

grep -q '^GEMINI_API_KEY=..' .env || { echo "GEMINI_API_KEY is empty in .env"; exit 1; }
KEY=$(grep -m1 '^DETECTOR_KEY=' "$OUT" 2>/dev/null | cut -d= -f2- || true)
{
  grep -E '^(GEMINI_API_KEY|SUPARADE_CAMPAIGN_ID|AGENT_API_KEY)=' .env || true
  # The deployed detector pays through the deployed payments API and serves the deployed portal (and a local one).
  # The root .env keeps localhost for run_e2e.sh.
  echo "SUPARADE_API_URL=https://suparade.vercel.app/api"
  echo "CORS_ORIGINS=https://suparade.vercel.app,http://localhost:3000"
  echo "DETECTOR_KEY=${KEY:-$(openssl rand -hex 24)}"
} > "$OUT.tmp"
mv "$OUT.tmp" "$OUT"

export SUPABASE_EXPERIMENTAL_COMPUTE=1
export SUPABASE_ACCESS_TOKEN="${SUPABASE_ACCESS_TOKEN:-$(grep -m1 '^SUPABASE_ACCESS_TOKEN=' .env | cut -d= -f2-)}"
npx -y supabase@latest compute deploy detector --project-ref pvoesovsparqqzosgwki
