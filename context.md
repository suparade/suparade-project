# Suparade: system context

Last updated 2026-10-04. The current state of the whole repo. Product, agents, money rules and design are in `frontend/context.md`.

## Layout

| Path | What | Runs on |
| --- | --- | --- |
| `app/` | Payments API (FastAPI): campaigns, creators, detections, tips, Stripe Connect payouts, Link funding webhook, `POST /agent/stream-events` | Vercel under `/api`, or :8001 locally |
| `supabase/migrations/` | Schema: campaigns, creators, videos, detections, tips, `wallet_ledger`, RLS | Supabase `pvoesovsparqqzosgwki` |
| `backend/` | Gemini detector (FastAPI, `/api/sessions`, `/ws/events`): ffmpeg 10 s clips, Gemini, tip policy, verifier, chat reaction, alerts | Supabase Compute (`/compute/v1/detector`, see below), or :8000 locally. Needs ffmpeg, runs for hours, sessions live in memory |
| `frontend/` | Next.js 16 brand portal (replaced the Vite dashboard). Mission control, Videos and `/alert` are live: the detector's WebSocket (`lib/detector.tsx`) plus Supabase reads on the server with the service role key (`lib/supabase.ts`). Settings and Onboarding are still sample data | Vercel, or :3000 locally |
| `scripts/` | `seed_demo`, `stripe_check`, `run_e2e.sh`, `backfill_transfer_descriptions` | Local |
| `tests/` | Payments API tests. Detector tests are in `backend/tests/` | Local |

## How a tip flows

Stream or file → detector (`backend/`) → `POST /agent/stream-events` with `X-Agent-Key` → payments API reserves the budget under a row lock in Postgres → Stripe transfer to the creator's connected account → `tips` row becomes `paid` → the detector pushes the paid event over `/ws/events` to the portal (feed, `/alert` with Gemini's spoken message and card), and the portal re-reads the wallet and totals from Supabase. Supabase Realtime isn't used yet (no publishable key in hand).

## Env files

- `.env` (root): one file for all three parts. `run_e2e.sh` sources it, the detector loads it after `backend/.env`, and `frontend/next.config.ts` loads it. Payments API: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `AGENT_API_KEY`, `FRONTEND_URL`, `ALLOW_DEV_FUNDING`, `ALLOW_LIVE_MODE`, `SUPABASE_EXPERIMENTAL_COMPUTE`, `SUPABASE_JWT_KEY` (the public key ID of the project's ES256 signing key; nothing reads it yet).
- Detector and portal settings in the root `.env`: `GEMINI_API_KEY`, `SUPARADE_API_URL` (`http://localhost:8001`), `SUPARADE_CAMPAIGN_ID` (also the campaign the portal shows), `CORS_ORIGINS` (`http://localhost:3000`), optional `NEXT_PUBLIC_DETECTOR_URL` (default `http://localhost:8000`).
- `backend/.env` (optional): overrides for the detector, every knob is in `backend/.env.example`.

## Deploy

- `vercel.json` uses Vercel Services: `frontend` (root `frontend/`) at `/`, `payments` (root `./`, entrypoint `app.main:app`) at `/api/*`. `FastAPI(root_path="/api")` makes the API answer with or without the prefix. `api/index.py` is gone.
- `.vercelignore` keeps `backend/`, `tests/`, `scripts/` and `supabase/` out of the upload.
- Not deployed or tested on Vercel yet (only `vercel dev -L` routing in the first merge). The deployed portal still needs a reachable detector: set `NEXT_PUBLIC_DETECTOR_URL` and add the portal URL to the detector's `CORS_ORIGINS`.

## Supabase Compute (private alpha, enabled for our project)

Containers next to our Postgres: full Linux, no time limit, public URL or private. The best fit here is the detector, which today needs "a laptop or a VM".

- Setup: CLI 2.119 or newer (`npx supabase@latest`), `SUPABASE_EXPERIMENTAL_COMPUTE=1` (already in `.env`), then `supabase link --project-ref pvoesovsparqqzosgwki`.
- Commands: `supabase compute new|deploy|list|status|logs|delete`. Config goes in `[compute.<name>]` in `supabase/config.toml` (`runtime` node, deno or dockerfile; `size` 2gb or 4gb; `exposure` public or private; `instances`). Code goes in `supabase/compute/<name>/`.
- Public URL: `https://pvoesovsparqqzosgwki.supabase.co/compute/v1/<name>`. A Dockerfile image must serve HTTP on `$PORT`.
- **Detector deployed** 2026-10-04 at `https://pvoesovsparqqzosgwki.supabase.co/compute/v1/detector` (`[compute.detector]`, `backend/Dockerfile`, `./scripts/deploy_detector.sh`). Health, Gemini key, CORS for `localhost:3000` and `/ws/events` checked live. Session endpoints need `X-Detector-Key` (value in gitignored `backend/.env.compute`).
- Smoke test on 2026-10-04 (throwaway Dockerfile service, deleted afterwards):
  - Deploying took about 2 minutes.
  - The public URL answers with **no auth**.
  - The `/compute/v1/<name>` prefix is stripped, so the app sees `/api/...` as usual.
  - **WebSockets work.**
  - The container gets exactly the project's Edge Function secrets as env vars: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_DB_URL`, `SUPABASE_JWKS`, `SUPABASE_PUBLISHABLE_KEYS`, `SUPABASE_SECRET_KEYS`, plus `PORT`. Every public service therefore holds the service role key and the DB URL.
- Not verified yet: whether `supabase secrets set` values reach Compute (very likely, since the env vars match the secrets list exactly), and whether idle services get suspended.
- `SUPABASE_ACCESS_TOKEN` (`sbp_`) in `.env` works for deploy, list and delete, but lacks the `edge_functions_secrets_write` permission, so `supabase secrets set` fails. So the deploy script writes the detector's values from the root `.env` to `backend/.env.compute` (gitignored), and that file ships in the upload: `GEMINI_API_KEY`, `SUPARADE_CAMPAIGN_ID`, `AGENT_API_KEY`, `CORS_ORIGINS`, `SUPARADE_API_URL` (only if https), `DETECTOR_KEY` (generated once, kept across deploys). Thomas chose this over waiting for the permission. Rotate the Gemini key after the hackathon.
- Pause the detector with `instances = 0` in `[compute.detector]` plus a redeploy; delete it with `supabase compute delete detector`.
- Still open on the deployed detector:
  - Tips are simulated (`payments_enabled: false`): `SUPARADE_API_URL` must be the deployed payments API (https), then rerun the deploy script.
  - The portal sends no `X-Detector-Key`, so starting or stopping a session from it gets 401. The key must not go in a `NEXT_PUBLIC_` var.
  - Evidence under `backend/evidence/` lives on the container's disk and disappears on every redeploy. Fine for the demo; move it to Supabase Storage if it has to last.

## Open items

- Supabase Realtime and RLS in the portal: the publishable key exists (Thomas has it, checked against this project), but it isn't in `.env` anymore since `SUPABASE_ACCESS_TOKEN` now holds the `sbp_` token. Add it as `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`. Then `/alert` can listen to paid `tips` without the detector, and brands can sign in.
- Settings and Onboarding pages still show sample data; nothing in the backend stores them yet.
- Shared memory and memory-then-Exa pricing for the tipper are not built. The detector still uses fixed `suggested_tip_cents` (Thomas).
- Funding through Checkout and the webhook works end to end locally (2026-10-04: $5 test card payment → `checkout.session.completed` → ledger credit). The Link agent paying that Checkout is still untested, and a deployed URL needs a Stripe webhook endpoint with its own `whsec_` (the local `.env` holds the `stripe listen` secret).
- Thomas's Supabase CLI login and the Supabase MCP can't see `pvoesovsparqqzosgwki`. CLI commands work with `SUPABASE_ACCESS_TOKEN` from `.env` and `--project-ref pvoesovsparqqzosgwki`; the deploy script does this. The MCP still gets "permission denied".
