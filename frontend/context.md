# GTM.si: product context

Last updated 2026-10-03. Decisions here override older notes.

## The product

GTM.si is product placement for live streams, paid in real time. A brand's AI agents watch streams and videos. When a creator shows, drinks or names the brand, the agents send that creator a micro-tip, and the tip's message shows up on the stream.

- Hackathon prompt: "build something agents want". The brand's tipper agent is the customer. GTM.si gives it eyes on streams and a way to pay creators. The portal is the human side: set up the brand and the budget, then watch the agents work.
- Concept paper: https://tremendous-tiger-a4a.notion.site/Concept-Paper-AI-Agents-That-Tip-Streamers-for-Product-Placement-3ee00bbdfc3b81138b84dbbd2db3a18e
- Why each side wants it: brands pay only for exposure that happened. Creators get money they didn't expect, which gives them a reason to keep the brand in frame. Viewers see the tip alert, so the brand gets a second moment on screen.
- Demo brand: **Gatorade** (decided 2026-10-03). It matches the backend's `SPONSOR_BRAND` and its demo clips. The UI accent is Gatorade orange `#FF7A1A`. Competitors that never get tipped include Powerade, Prime and BodyArmor (`COMPETITOR_BRANDS`).

## Agents (decided 2026-10-03)

| Agent | Job |
| --- | --- |
| Brand agent | During onboarding, studies the brand (site, packaging, posts, existing creator mentions) and runs the first Exa market-rate search. Writes all of it to shared memory. |
| Search agent | Finds streams and videos where the brand already shows up or would fit. Each stream the brand keeps gets a scout. Built 2026-10-04 for live streams only: Twitch streams whose title says the brand or that are live in the brand's categories (`fits` in the onboarding page), plus YouTube live streams whose title says the brand. |
| Scouts | One per stream. Gemini Flash watches 10 s clips (video and audio) and returns moments as structured JSON. |
| Verifier | Gemini Pro takes a second, skeptical look at every tip candidate before money moves. |
| Tipper | Fully autonomous. Decides whether to tip, how much, and the message. Pays from the Link Agent Wallet. |
| Chat agent | Reads chat around each tip and scores how the audience reacted (Videos page, "Chat engagement"). |

- **No orchestrator for now.** It is replaced by **shared memory**: one source every agent reads from and writes to. It holds the brand profile, the rules, market rates and each creator's tip history.
- **Pricing.** The tipper sets the amount from what the creator did (named, shown, drunk on camera, how prominent, audience size) and the market rate for that kind of placement. It **reads market rates from shared memory first** and **searches the web with Exa only when nothing saved fits**, then saves what it found so no agent searches again. Per-category fixed prices were removed from the UI.
- **Stop when it's not needed.** The tipper skips tips that wouldn't change what the creator does: inside the cooldown, a creator repeating the name to get paid (farming), staged moments. The feed shows each skip with its reason.

## Money

- Stripe **Link Agent Wallet** in test mode. The wallet's **spending limit is the guardrail**: the agent spends on its own and never more than what was funded. No human approves individual tips.
- Caveat from Stripe's docs: the wallet owner approves each spend request on Link within 10 minutes. The team chose to keep the agent autonomous anyway. Check how test mode behaves before the demo.
- **Payouts.** Each tip goes to the creator's own Stripe account, set up by hand before the agent can tip them (Videos page, "Creator's Stripe account"). Without an account, a creator can be watched but not paid.
- **Disclosure.** Every tip alert carries a "Paid placement" tag.

## Video ingestion (backend, already working)

The detector is at `../backend/` (FastAPI, port 8000). It already handles live streams in real time:

- Live URLs from Twitch, YouTube Live, Kick and others go through `streamlink | ffmpeg` and are cut into 10 s mp4 clips at 480p and 5 fps.
- Local files are replayed in real time (`ffmpeg -re`), which works well for demos.
- Webcam or a shared browser tab arrive as 10 s webm clips recorded in the browser and uploaded to `/api/sessions/{id}/chunk`.
- Twitch chat is read anonymously over IRC. Scripted or manual chat works for demos.
- Clips that wait longer than `MAX_BACKLOG` are dropped so analysis stays close to live. Latency is about one clip plus 2-5 s.

Tip policy in `tip_policy.py`, all settings in `config.py` and `.env`:

- Confidence must be at least 0.6.
- 30 s cooldown per stream.
- At most 3 tips for the same category and brand per 10 minutes.
- Competitor brands never get tipped.
- Mentions need positive sentiment.
- The subject must be a `real_person`.
- No staged moments and no prerecorded or looped footage.
- Safety flags block tips: alcohol, vaping, NSFW, slurs, gambling.

Bonuses and alerts:

- Sponsor screen time pays 5¢ per prominence-weighted second.
- Chat reaction multiplies the tip by up to 1.5×.
- For demo sessions, Gemini writes the thank-you alert, reads it aloud (TTS) and makes a card image.

**Gap:** the backend still uses fixed `suggested_tip_cents` per category. The memory-then-Exa pricing and the shared memory itself still need to be built on the tipper side. Thomas will work out the pricing later.

### Event contract (`BeverageEvent`, POSTed to `EVENT_WEBHOOK_URL`, streamed on `/ws/events`)

`event_id, session_id, streamer_id, category, confidence, description, quote, brand, stream_offset_seconds, detected_at, suggested_tip_cents, sentiment, subject_type, is_sponsor, is_competitor, status (tipped | blocked | pending_verification | rejected_by_verifier), block_reasons[], verification_reason, exposure_seconds, thumbnail_url, clip_url, boxes[{label, box_2d}], audience_reaction, reaction_summary, chat_highlights[], reaction_multiplier, alert_message, alert_audio_url, card_url`

Categories: `sports_drink_mention, drinking_water, drinking_other, holding_or_showing_beverage, verbal_beverage_mention, sponsor_screen_time`.

API: `POST /api/sessions` (`{source: url|browser, url?, streamer_id, demo_alerts?, chat_script?}`), `POST /api/sessions/{id}/chunk`, `POST /api/sessions/{id}/chat`, `GET /api/sessions/{id}/media`, `DELETE /api/sessions/{id}`, `GET /api/events`, `WS /ws/events`.

## Design (hi-fi canvas)

https://claude.ai/artifact/Q2hQF3LTys66cGYGaF4Jgv, a Design canvas, version 14 on 2026-10-03. It holds only the chosen "Control room" direction; the low-fi options were removed.

| Board | What it shows |
| --- | --- |
| Onboarding | 1 pick or add a brand. 2 the brand agent studies it, including the Exa market-rate search. 3 what counts as a moment, plus the wallet. 4 the search agent finds streams, then launch. |
| Mission control (home) | Wallet against its limit, stats, one tile per watched stream (click to filter), and a floating agent feed. Each card is a playable 10 s clip with a box around the product and rows for scout, Memory and Tipper. A paid clip shows the tip alert over the video while it plays. Card states: Researching, Deciding, Sending, Paid, Skipped. |
| Videos | Sources: live URL, recording, local file, webcam, or a shared tab. Each creator's Stripe account, status, clips, flags, tipped, chat engagement. |
| Settings | Brand, moment categories, guardrails, "How to tip" guidance, wallet. Side panel: shared memory (rules and market rates). |
| On-stream tip alert | What the streamer sees, with the "Paid placement" tag. |

## Demo plan

Run the full loop on clips we control, live or replayed: a brand is picked, a scout finds it, the verifier confirms, the tipper prices the tip (from memory, or Exa then memory), pays the creator's Stripe account, and the alert lands on the video. The portal shows every step as it happens.

## Beyond the hackathon

A swarm of scouts across many live streams. Tips for any highly clippable moment (big laughs, outrageous moments), so the brand travels with the clip. The public adding money to a brand's pot (not defined yet).

## Open items

- Build shared memory and memory-then-Exa pricing in the backend, replacing the fixed per-category amounts (Thomas, later).
- Link spend-request approval versus full autonomy, in test mode (Thomas is checking).
- Tips inside real Twitch, YouTube or TikTok streams. For now the alert shows over the video in the portal.
- Creator consent and sponsorship disclosure for the real product.
- Agent framework: Strands with Python was discussed. The event guide points to the AI SDK. Python backends run on Vercel.
