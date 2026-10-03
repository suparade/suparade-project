# GTM.si frontend

Hackathon project (Supabase hackathon, October 2026). Brand-side portal where AI agents watch live streams and micro-tip creators when the brand shows up. Product context, agent roles, decisions and the backend contract are in `context.md`; read it first.

## Repo state

- Next.js 16 app, ported from the design canvas (https://claude.ai/artifact/Q2hQF3LTys66cGYGaF4Jgv). `npm run dev`, `npm run build`, `npm run lint`.
- Routes: `/` Mission control, `/videos`, `/settings`, `/onboarding`, `/alert` (on-stream tip alert, 1280×720). Sidebar pages live in `app/(app)/`. Design tokens and the canvas's CSS classes are in `app/globals.css`.
- Mission control, Videos and `/alert` run on live data. `lib/detector.tsx` is one WebSocket per tab to the Gemini detector (`../backend/`, `NEXT_PUBLIC_DETECTOR_URL`, default `http://localhost:8000`): sessions, clips, events, chat, start/stop, webcam and tab capture. `lib/supabase.ts` reads the campaign wallet, tips and creators on the server with the service role key (no login yet). Onboarding step 4 is the real search agent: `app/onboarding/streams/route.ts` finds live Twitch and YouTube streams with no API keys, and "Start scouts" posts one detector session per kept stream. Settings and Onboarding steps 1-3 still show the canvas's sample data.
- Env: `next.config.ts` loads the repo root `.env` (one file for the payments API, the detector and this app). Never commit it: the hackathon account revokes leaked keys.
- Run the whole loop with `../scripts/run_e2e.sh` (payments API :8001, detector :8000, this app :3000).
- Next 16 differs from older versions: check `node_modules/next/dist/docs/` before using an API. `AGENTS.md` is managed by `next dev`; keep it committed.
- The Gemini detector (`../backend/`) and the payments API (`../app/`) are owned by teammates. Read them, but don't edit them unless asked.
- `image.png` is a screenshot of an older Mission summary layout, kept for reference.

## Planned stack

- Frontend: Next.js App Router and TypeScript on Vercel, Tailwind v4. Not installed yet: shadcn/ui, motion, supabase-js.
- Backend: Supabase (Postgres, Realtime, Edge Functions), the payments API in `../app/` and the Gemini detector in `../backend/`.
- Realtime: prefer Broadcast-from-database over `postgres_changes` once more than a handful of dashboards subscribe.
- Payments: Stripe Link Agent Wallet in test mode. Docs: https://docs.stripe.com/agentic-commerce/agents/link-agent-wallet

## Editing the design canvas

- Boards are `project/<Name>.dc.html` files inside the canvas (Design artifact type): Onboarding, Main (Mission control, the home page), Videos, Brief (shown as "Settings"), Alert. Only the chosen direction is kept; don't add exploration boards back unless asked.
- Read the files with the Artifact tool (`read`, `paths`). Edit the saved copies, then publish with `url`, `root` = the saved folder, `file_path` = one changed board, and `files` = the other changed boards.
- Send `project/canvas.json` only when the layout changes.
- Each board keeps its sample data and its little simulation in its `<script type="text/x-dc">` class. Check logic changes by running the class in node with a stub `DCLogic`.

## Design language ("Control room")

- Dark ground `#0C0E12` with an ambient gradient and a 40px grid. Glass panels: `rgba(255,255,255,.045)`, 1px border at `rgba(255,255,255,.1)`, backdrop blur.
- Text colors: `#EEF1F6` primary, `#A9B1BF` secondary, `#7B8494` muted.
- Type: Archivo (variable width, condensed `font-stretch` for headings) and JetBrains Mono through `.num` for every number, amount and id.
- Color meanings: brand color = the single accent and "paid" (Gatorade orange `#FF7A1A`, the demo brand). Amber `#F0B429` = scanning or flagged. Blue `#4DA3FF` = shared memory. Red `#FF5C5C` = live or error.
- Layout: left sidebar (Mission control, Videos, Settings at the bottom). No top nav. Pages must work at phone width.
- No emoji, no gradient text, no side-stripe cards. Icons are inline stroke SVG. Use real `<button>`, `<a>` and `<label>` elements. Touch targets are at least 44px.
- Impeccable design checker: `~/.claude/plugins/marketplaces/impeccable/skill/scripts/impeccable detect --json <files>`. The hi-fi boards were at 0 findings.

## Vocabulary (keep the UI consistent)

- Agents: scouts, verifier, tipper, brand agent, search agent, chat agent. Never "orchestrator"; it was replaced by **shared memory**.
- Tip card states: Researching (Exa search), Deciding, Sending, Paid, Skipped (with the reason).
- The tipper prices tips from market rates in shared memory, and searches Exa only when nothing fits. Don't show fixed per-category prices.
- Money goes to the creator's own Stripe account. The wallet has a spending limit. No human approves individual tips.
- Every tip alert carries a "Paid placement" tag.
