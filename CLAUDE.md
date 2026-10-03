# Suparade

Supabase hackathon project (October 2026), team repo `github.com/suparade/suparade-project`. Gemini watches live streams, spots a sponsor's product, and the streamer gets a real Stripe tip with an on-screen alert.

@context.md
@memory.md

## Keep context.md and memory.md current

- `context.md` is how the repo is **now**: layout, what runs where, deploy, open items. Edit it in place when something changes and delete what stops being true.
- `memory.md` is a dated, append-only log of decisions and gotchas that someone would otherwise rediscover the hard way. One entry per line, newest at the bottom: `YYYY-MM-DD: fact (why it matters)`. Don't log what the code or git history already says.
- Update them in the same change as the code they describe.
- Several Claude sessions work in this repo at once. Re-read a file right before editing it, change only your lines, never rewrite the whole file.
- Notes for one area stay in that area: `frontend/CLAUDE.md` and `frontend/context.md` (product, agents, design), `backend/README.md` (detector), `README.md` (setup and API reference).

## Rules

- Never commit `.env` or `backend/.env`. The hackathon account revokes leaked keys.
- Stripe stays in test mode. Live keys are refused unless `ALLOW_LIVE_MODE=1`; don't set it.
- Supabase project `pvoesovsparqqzosgwki`. Schema changes go in a new file in `supabase/migrations/`; never edit a migration that has been applied.
- The frontend is Next.js 16: read `frontend/AGENTS.md` and `frontend/node_modules/next/dist/docs/` before using a Next API.

## Commands

- Payments API tests: `pytest`
- Detector tests: `python -m unittest discover -s backend/tests -t .`
- Frontend: `cd frontend && npm run build && npm run lint`
- Full local setup and the end-to-end run: `README.md`
