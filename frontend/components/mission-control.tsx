"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { DEMO_STREAM, DETECTOR, detectorUrl, useDetector, type Chunk, type Session, type TipEvent } from "@/lib/detector";
import { categoryLabel, clock, money, paymentError, reasonLabel } from "@/lib/format";
import type { Summary } from "@/lib/supabase";

type Outcome = "deciding" | "sending" | "paid" | "skip";

/** Detector status -> the tip card states in the design (Deciding, Sending, Paid, Skipped). */
export const outcome = (e: TipEvent): Outcome =>
  e.status === "tipped" ? "paid" : e.status === "paying" ? "sending" : e.status === "pending_verification" ? "deciding" : "skip";

const at = (e: TipEvent) => Date.parse(e.detected_at ?? "") || 0;
const hue = (id: string) => [...id].reduce((h, c) => (h * 31 + c.charCodeAt(0)) % 360, 0);
const tileBg = (h: number) =>
  `radial-gradient(ellipse 24% 44% at 50% 72%, hsl(${h} 30% 46% / 0.55), transparent 70%), radial-gradient(120% 90% at 30% 15%, hsl(${h} 45% 30%) 0%, hsl(${h} 40% 13%) 55%, #0C0E12 100%)`;

export function sourceLabel(s: Session) {
  if (s.source === "browser") return "Webcam or tab";
  if (s.local_file) return "Local file";
  try {
    return new URL(s.url ?? "").hostname.replace(/^www\./, "");
  } catch {
    return "Stream";
  }
}

/** Re-renders every second, for stream clocks and fading tile chips. */
function useNow() {
  const [now, setNow] = useState(0);
  useEffect(() => {
    const tick = () => setNow(Date.now());
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);
  return now;
}

export function MissionControl({ summary, history, error }: { summary: Summary | null; history: TipEvent[]; error?: string }) {
  const d = useDetector();
  const router = useRouter();
  const now = useNow();
  const [filter, setFilter] = useState<string | null>(null);
  const [playing, setPlaying] = useState<string | null>(null);

  // The wallet and totals live in Supabase: re-read them when a payment settles, and every 20 s.
  const settled = d.events.filter((e) => e.status === "tipped" || e.status === "payment_failed").length;
  useEffect(() => {
    if (settled) router.refresh();
  }, [settled, router]);
  useEffect(() => {
    const id = setInterval(() => router.refresh(), 20000);
    return () => clearInterval(id);
  }, [router]);

  // Live events from the detector, plus earlier tips from Supabase that this detector run doesn't know about.
  const live = new Set(d.events.map((e) => e.event_id));
  const all = [...d.events, ...history.filter((h) => !live.has(h.event_id))].sort((a, b) => at(b) - at(a));
  const feed = (filter ? all.filter((e) => e.session_id === filter) : all).slice(0, 30);
  const sponsor = d.health?.sponsor_brand ?? "Gatorade";
  const walletLeft = summary ? money(summary.balance) : "–";
  const filterName = d.sessions.find((s) => s.id === filter)?.streamer_id;

  return (
    <div className="flex min-w-0 flex-[999_1_560px] flex-wrap items-stretch">
      <main className="flex min-w-0 flex-[999_1_640px] flex-col gap-4.5 px-6 pt-6 pb-7">
        <h1 className="m-0 text-[28px] leading-[1.1] font-bold tracking-[-0.01em] font-stretch-80%">Mission control</h1>

        <Notices error={error} />

        <section aria-label="Mission summary" className="glass flex flex-wrap gap-x-10 gap-y-5 rounded-[10px] border border-white/10 bg-white/[.045] px-5 py-4.5">
          <div className="flex min-w-0 flex-[2_1_280px] flex-col gap-2">
            <div className="flex min-h-6 items-center justify-between gap-3">
              <span className="text-[13px] text-dim">Link Agent Wallet</span>
              <StripeLink />
            </div>
            <div className="flex items-baseline gap-2">
              <span className="num text-[28px] leading-none font-semibold">{walletLeft}</span>
              {summary && (
                <span className="text-[13px] text-mute">
                  left of <span className="num">{money(summary.funded)}</span> funded · max tip <span className="num">{money(summary.maxTip)}</span>
                </span>
              )}
            </div>
            <div className="mt-1 h-1 overflow-hidden rounded-xs bg-white/10">
              <div className="meter h-full w-full origin-left rounded-xs bg-accent" style={{ transform: `scaleX(${summary?.funded ? Math.max(0, summary.balance / summary.funded).toFixed(3) : 0})` }} />
            </div>
          </div>
          <Stat label="Moments flagged" value={d.events.length} sub="since the detector started" />
          <Stat label="Tips sent" value={summary?.tips ?? 0} sub={`${money(summary?.tipped ?? 0)} total`} />
          <Stat label="Creators paid" value={summary?.creatorsPaid ?? 0} suffix={summary ? `of ${summary.creators}` : undefined} />
        </section>

        <section aria-label="Streams being watched" className="flex flex-col gap-3">
          <div className="flex flex-wrap items-baseline justify-between gap-3">
            <h2 className="m-0 text-[15px] font-semibold">
              Watching <span className="num">{d.sessions.length}</span> {d.sessions.length === 1 ? "stream" : "streams"}
            </h2>
            <span className="text-[13px] text-mute">One scout per stream, {d.health?.chunk_seconds ?? 10} second clips. Select a tile to filter the feed.</span>
          </div>
          {d.sessions.length === 0 ? (
            <div className="glass flex flex-wrap items-center gap-3 rounded-[10px] border border-dashed border-white/16 bg-white/[.03] px-5 py-6">
              <p className="m-0 flex-[1_1_280px] text-sm text-dim">No streams yet. Replay the demo clip, or add a live URL, a file or your webcam on the Videos page.</p>
              <DemoButton />
              <Link href="/videos" className="btn-ghost h-10 px-3.5 text-sm font-medium no-underline">Add a source</Link>
            </div>
          ) : (
            <div className="grid grid-cols-[repeat(auto-fit,minmax(min(300px,100%),1fr))] gap-3">
              {d.sessions.map((s, i) => (
                <StreamTile
                  key={s.id}
                  s={s}
                  scout={`scout-${String(i + 1).padStart(2, "0")}`}
                  now={now}
                  events={d.events.filter((e) => e.session_id === s.id)}
                  chunks={d.chunks[s.id] ?? []}
                  stream={d.streams[s.id]}
                  sponsor={sponsor}
                  selected={filter === s.id}
                  onSelect={() => setFilter(filter === s.id ? null : s.id)}
                />
              ))}
            </div>
          )}
        </section>
      </main>

      {/* No drop shadow: Chrome counts it as covering the stream tiles beside it, and Twitch then won't autoplay them. */}
      <aside aria-label="Agent feed" className="glass sticky top-4 m-4 flex max-h-[calc(100vh-32px)] min-w-0 flex-[1_1_360px] flex-col self-start overflow-hidden rounded-2xl border border-white/10 bg-[rgba(12,14,18,0.5)]">
        <div className="flex flex-col gap-2.5 border-b border-white/8 px-5 pt-4.5 pb-3.5">
          <div className="flex items-center justify-between gap-2">
            <h2 className="m-0 text-[15px] font-semibold">Agent feed</h2>
            <span className="flex items-center gap-1.5 text-xs font-medium text-dim">
              <span className={`size-1.5 rounded-full ${d.connected ? "bg-amber" : "bg-live"}`} />
              {d.connected ? "Live" : "Detector offline"}
            </span>
          </div>
          <p className="m-0 text-[13px] leading-normal text-dim">
            <span className="font-semibold text-amber">{d.sessions.length} {d.sessions.length === 1 ? "scout" : "scouts"}</span> on {d.health?.model ?? "Gemini"}
            {d.health?.verify_model && <> · verifier on {d.health.verify_model}</>} · <span className="font-semibold text-accent">tipper</span> holding <span className="num">{walletLeft}</span>
          </p>
          {filter && (
            <div className="flex items-center gap-2 text-xs text-mute">
              <span>Showing only</span>
              <button type="button" onClick={() => setFilter(null)} aria-label="Show every stream" className="inline-flex min-h-8 items-center gap-1.5 rounded-md border border-white/16 bg-white/6 px-2.5 text-xs font-semibold text-ink transition-colors hover:border-white/30">
                <span>@{filterName ?? "stream"}</span>
                <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden="true"><path d="M2 2l6 6M8 2l-6 6" /></svg>
              </button>
            </div>
          )}
        </div>
        <div className="flex min-h-0 flex-auto flex-col gap-2.5 overflow-y-auto p-3">
          {feed.length === 0 && <p className="m-0 p-2 text-[13px] text-mute">{filter ? "Nothing flagged on this stream yet. The scout keeps watching." : "Nothing flagged yet. Moments show up here as the scouts find them."}</p>}
          {feed.map((e) => (
            <FeedCard key={e.event_id} e={e} sponsor={sponsor} playing={playing === e.event_id} onPlay={() => setPlaying(playing === e.event_id ? null : e.event_id)} />
          ))}
        </div>
      </aside>
    </div>
  );
}

/** Setup problems, in the order you'd hit them. */
function Notices({ error }: { error?: string }) {
  const d = useDetector();
  const notes: string[] = [];
  if (error) notes.push(`Can't read Supabase: ${error}`);
  if (!d.connected) notes.push(`The Gemini detector isn't reachable at ${DETECTOR}. Start everything with ./scripts/run_e2e.sh.`);
  else if (d.health && !d.health.api_key_set) notes.push("GEMINI_API_KEY is missing in the repo root .env, so the scouts can't analyze clips.");
  else if (d.health && !d.health.payments_enabled) notes.push("Payments are simulated: set SUPARADE_API_URL and SUPARADE_CAMPAIGN_ID in the repo root .env.");
  if (!notes.length) return null;
  return (
    <div role="status" className="flex flex-col gap-1 rounded-[10px] border border-amber/30 bg-amber/8 px-4 py-3 text-[13px] text-ink">
      {notes.map((n) => <p key={n} className="m-0">{n}</p>)}
    </div>
  );
}

export function DemoButton() {
  const d = useDetector();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const run = async () => {
    setBusy(true);
    setErr("");
    try {
      await d.start(DEMO_STREAM);
    } catch (e) {
      setErr((e as Error).message);
    }
    setBusy(false);
  };
  return (
    <>
      <button type="button" onClick={run} disabled={busy || !d.connected} className="btn-primary h-10 px-4 text-sm disabled:opacity-50">
        {busy ? "Starting…" : "Watch the demo stream"}
      </button>
      {err && <span role="alert" className="w-full text-[13px] text-live">{err}</span>}
    </>
  );
}

function StripeLink() {
  return (
    <a href="https://dashboard.stripe.com/acct_1UMRhZ4OXYqp8il9/test/connect/transfers" target="_blank" rel="noopener" className="inline-flex items-center gap-1.5 text-[13px] font-medium text-dim no-underline">
      Stripe transfers
      <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 2.5H2.5v7h7V7" /><path d="M7 2h3v3M10 2L5.5 6.5" /></svg>
      <span className="sr-only">(opens in a new tab)</span>
    </a>
  );
}

function Stat({ label, value, sub, suffix }: { label: string; value: number; sub?: string; suffix?: string }) {
  return (
    <div className="flex flex-[1_1_110px] flex-col gap-2">
      <span className="flex min-h-6 items-center text-[13px] text-dim">{label}</span>
      <div className="flex items-baseline gap-1.5">
        <span className="num text-[28px] leading-none font-semibold">{value}</span>
        {suffix && <span className="num text-[13px] text-mute">{suffix}</span>}
      </div>
      {sub && <span className="text-[13px] text-mute">{sub}</span>}
    </div>
  );
}

export function LiveVideo({ stream }: { stream: MediaStream }) {
  return (
    <video
      ref={(v) => {
        if (v && v.srcObject !== stream) v.srcObject = stream;
      }}
      autoPlay
      muted
      playsInline
      className="absolute inset-0 size-full object-cover"
    />
  );
}

/** The platform's own muted player for a Twitch or YouTube URL. Sessions only exist in the browser, so `location` is safe. */
function embedUrl(url: string | null) {
  const u = URL.parse(url ?? "");
  if (!u) return null;
  const host = u.hostname.replace(/^(www|m)\./, "");
  if (host === "twitch.tv") {
    const channel = u.pathname.split("/")[1];
    return channel && `https://player.twitch.tv/?channel=${channel}&parent=${location.hostname}&muted=true`;
  }
  const yt = host === "youtu.be" ? u.pathname.slice(1) : host === "youtube.com" ? u.searchParams.get("v") ?? u.pathname.match(/^\/live\/([\w-]+)/)?.[1] : null;
  return yt && `https://www.youtube.com/embed/${yt}?autoplay=1&mute=1&playsinline=1`;
}

/** What a tile shows behind its labels: this tab's webcam, the replayed file, or the latest evidence frame. */
export function StreamMedia({ s, stream, poster }: { s: Session; stream?: MediaStream; poster?: string }) {
  if (stream) return <LiveVideo stream={stream} />;
  if (s.local_file) return <video src={`${DETECTOR}/api/sessions/${s.id}/media`} autoPlay muted loop playsInline className="absolute inset-0 size-full object-cover" />;
  // eslint-disable-next-line @next/next/no-img-element -- served by the local detector, not optimizable
  return poster ? <img src={poster} alt="" className="absolute inset-0 size-full object-cover" /> : null;
}

function StreamTile(p: { s: Session; scout: string; now: number; events: TipEvent[]; chunks: Chunk[]; stream?: MediaStream; sponsor: string; selected: boolean; onSelect: () => void }) {
  const { s, now, events } = p;
  const latest = events[0];
  const o = latest && now - at(latest) < 30_000 ? outcome(latest) : null;
  // detected_at is before the verifier and Stripe, so a 30 s window leaves roughly 15 s on screen after the payment.
  // The biggest recent tip wins, so a screen-time bonus doesn't hide the tip with the thank-you message.
  const tip = events
    .filter((e) => outcome(e) === "paid" && now - at(e) < 30_000)
    .sort((a, b) => b.suggested_tip_cents - a.suggested_tip_cents)[0];
  const state = !o ? "scanning" : o === "paid" ? "paid" : o === "skip" ? "hold" : "seen";
  const chip = state === "seen" ? `Seen · ${categoryLabel(latest.category)}` : state === "paid" ? `Paid ${money(latest.suggested_tip_cents)}` : "Skipped";
  const last = p.chunks.at(-1)?.status;
  const frost = "frost rounded bg-[rgba(12,14,18,0.5)] px-[7px] py-[3px] text-[11px]";
  const elapsed = now && !s.source_exited ? clock(Math.max(0, now / 1000 - s.started_at)) : "";
  // Twitch only autoplays a player Chrome reports as fully visible: nothing on top, no ancestor blur (backdrop-filter), and
  // no clipping or rounding (the tile's fractional width counts as clipped). So a live player gets the video area to
  // itself with square corners, its labels go below, and its tile drops `glass`.
  const embed = !s.source_exited && embedUrl(s.url);
  const badges = (
    <span className="flex flex-none items-center gap-1.5">
      <span className={`${frost} flex items-center gap-[5px] font-semibold`}>
        <span className={`size-1.5 rounded-full ${s.source_exited ? "bg-mute" : "bg-live"}`} />
        {s.source_exited ? "ENDED" : "LIVE"}
      </span>
      <span className={`${frost} text-dim`}>{sourceLabel(s)}</span>
    </span>
  );
  const alert = tip && (
    <>
      <span className="flex size-8 flex-none items-center justify-center rounded-md bg-accent">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#0C0E12" strokeWidth="2.2" strokeLinejoin="round" aria-hidden="true"><path d="M13 2L4 14h7l-1 8 9-12h-7l1-8z" /></svg>
      </span>
      <span className="flex min-w-0 flex-auto flex-col gap-0.5">
        <span className="text-sm font-bold">{p.sponsor} tipped <span className="num">{money(tip.suggested_tip_cents)}</span></span>
        <span className="line-clamp-2 text-xs">{tip.alert_message ?? tip.description}</span>
      </span>
      <span className="flex-none self-start rounded border border-white/24 px-[5px] py-0.5 text-[10px] font-semibold text-dim">Paid placement</span>
    </>
  );
  return (
    <button
      type="button"
      onClick={p.onSelect}
      aria-label={`Show only ${s.streamer_id} in the feed`}
      aria-pressed={p.selected}
      className={`tile ${embed ? "" : "glass"} block w-full rounded-[10px] bg-white/5 p-0 text-left text-ink ${state} ${state === "scanning" && !s.source_exited ? "scan" : ""} ${p.selected ? "sel" : ""}`}
    >
      <span className={`relative block aspect-video ${embed ? "" : "overflow-hidden rounded-t-[9px]"}`} style={{ background: tileBg(hue(s.id)) }}>
        {embed ? (
          <iframe src={embed} title={`@${s.streamer_id} on ${sourceLabel(s)}`} allow="autoplay; encrypted-media" tabIndex={-1} className="pointer-events-none absolute inset-0 size-full border-0" />
        ) : (
          <>
            <StreamMedia s={s} stream={p.stream} poster={detectorUrl(events.find((e) => e.thumbnail_url)?.thumbnail_url)} />
            <span className="scanline" />
            <span className="absolute top-2.5 left-2.5">{badges}</span>
            <span className={`${frost} num absolute top-2.5 right-2.5 text-dim`}>{p.scout}</span>
            {tip ? (
              <span key={tip.event_id} role="status" className="tile-alert glass">{alert}</span>
            ) : (
              o && <span className={`chip ${state}`}>{chip}</span>
            )}
            <span className="absolute inset-x-0 bottom-0 flex flex-col gap-0.5 bg-linear-to-b from-[rgba(12,14,18,0)] to-[rgba(12,14,18,0.86)] px-3 pt-7 pb-2.5">
              <span className="flex items-baseline justify-between gap-2">
                <span className="text-sm font-semibold">@{s.streamer_id}</span>
                <span className="num text-xs text-dim">{elapsed}</span>
              </span>
              <span className="truncate text-xs text-dim">{s.source_exited ? (s.exit_reason ?? "Source ended") : (s.url ?? "Webcam or shared tab")}</span>
            </span>
          </>
        )}
      </span>
      <span className="flex flex-col gap-2 px-3 pt-2.5 pb-3">
        {embed && (
          <>
            <span className="flex items-center gap-2">
              {badges}
              <span className="min-w-0 truncate text-sm font-semibold">@{s.streamer_id}</span>
              <span className="num ml-auto flex-none text-xs text-dim">{p.scout} · {elapsed}</span>
            </span>
            {tip ? (
              <span key={tip.event_id} role="status" className="rise flex items-center gap-2.5 rounded-[10px] border border-accent bg-[rgba(19,22,28,0.72)] px-3 py-2.5">{alert}</span>
            ) : (
              o && <span className={`chip ${state} static self-start transform-none`}>{chip}</span>
            )}
          </>
        )}
        <span className="flex min-h-2 gap-[3px] overflow-hidden" aria-label="Last 30 analyzed clips">
          {p.chunks.map((c) => <span key={c.chunk_index} className={`clip ${c.status}`} title={c.summary ?? c.status} />)}
        </span>
        <span className="flex flex-wrap justify-between gap-2 text-xs text-mute">
          <span><span className="num">{s.events_detected}</span> flags · <span className="num">{s.chunks_analyzed}</span> clips · <span className="num text-accent">{money(s.tips_cents)} tipped</span></span>
          {/* The detector doesn't replay clip statuses, so after a reload only new clips show up here. */}
          <span>last clip: {last ? last.replace("_", " ") : s.chunks_analyzed ? "analyzed" : "waiting"}</span>
        </span>
      </span>
    </button>
  );
}

const PILL = { paid: "Paid", skip: "Skipped", sending: "Sending", deciding: "Deciding" };

function FeedCard({ e, sponsor, playing, onPlay }: { e: TipEvent; sponsor: string; playing: boolean; onPlay: () => void }) {
  const o = outcome(e);
  const amt = money(e.suggested_tip_cents);
  // Older tips may point at evidence saved by a detector on another machine.
  const [missing, setMissing] = useState(false);
  const thumb = missing ? undefined : detectorUrl(e.thumbnail_url);
  const clip = detectorUrl(e.clip_url);
  const screenTime = e.category === "sponsor_screen_time";
  const message = e.alert_message;
  const row = "grid grid-cols-[88px_minmax(0,1fr)] gap-2.5";

  const verifier =
    e.status === "pending_verification" ? "Checking the clip again on Gemini Pro…"
    : e.status === "blocked" ? "Not needed: the scout's rules already ruled it out."
    : e.verification_reason ?? (screenTime ? "Screen time is measured, nothing to verify." : null);
  const why =
    e.status === "blocked" ? `Ruled out: ${(e.block_reasons ?? []).map(reasonLabel).join(", ")}.`
    : e.status === "rejected_by_verifier" ? "The verifier didn't confirm the moment."
    : e.status === "payment_failed" ? `Stripe didn't pay: ${paymentError(e.payment_error)}.`
    : o === "deciding" ? "Waiting for the verifier before paying."
    : null;

  return (
    <article className={`feed-item flex flex-col gap-2.5 rounded-xl border border-white/8 bg-white/4 p-3.5 ${o}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-0.5">
          <span className="text-sm font-semibold">@{e.streamer_id}</span>
          <span className="text-xs text-mute">{categoryLabel(e.category)} · <span className="num">{clock(e.stream_offset_seconds)}</span></span>
        </div>
        <span className={`pill ${o}`}>{PILL[o]}{o === "paid" && ` ${amt}`}</span>
      </div>

      {thumb && (
        <div className={`relative aspect-video overflow-hidden rounded-lg bg-black/40 ${playing ? "playing" : ""}`}>
          {playing && clip ? (
            <video src={clip} autoPlay playsInline onEnded={onPlay} className="absolute inset-0 size-full object-cover" />
          ) : (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element -- served by the local detector, not optimizable */}
              <img src={thumb} alt={`Frame from @${e.streamer_id}'s stream: ${e.description}`} onError={() => setMissing(true)} className="absolute inset-0 size-full object-cover" />
              {e.boxes?.map((b, i) => {
                const [y0, x0, y1, x1] = b.box_2d;
                return <div key={i} className="box" style={{ top: `${y0 / 10}%`, left: `${x0 / 10}%`, height: `${(y1 - y0) / 10}%`, width: `${(x1 - x0) / 10}%` }}><span>{b.label}</span></div>;
              })}
            </>
          )}
          {o === "paid" && (
            <div className="tipalert glass" style={{ animationDelay: "1s" }}>
              <span className="flex size-[26px] flex-none items-center justify-center rounded-md bg-accent">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#0C0E12" strokeWidth="2.2" strokeLinejoin="round" aria-hidden="true"><path d="M13 2L4 14h7l-1 8 9-12h-7l1-8z" /></svg>
              </span>
              <span className="flex min-w-0 flex-auto flex-col gap-px">
                <span className="text-xs font-bold">{sponsor} tipped <span className="num">{amt}</span></span>
                {message && <span className="truncate text-[11px]">{message}</span>}
              </span>
              <span className="flex-none rounded border border-white/24 px-[5px] py-0.5 text-[10px] font-semibold text-dim">Paid placement</span>
            </div>
          )}
          <div className="absolute inset-x-0 bottom-0 flex items-center gap-2.5 bg-linear-to-b from-[rgba(12,14,18,0)] to-[rgba(12,14,18,0.84)] px-2.5 pt-[22px] pb-2">
            <button type="button" className="play disabled:opacity-40" onClick={onPlay} disabled={!clip} aria-label={`${playing ? "Stop" : "Play"} the clip from @${e.streamer_id}`}>
              {playing ? (
                <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor" aria-hidden="true"><rect x="1" y="1" width="8" height="8" rx="1" /></svg>
              ) : (
                <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor" aria-hidden="true"><path d="M3.5 2v8l6.5-4z" /></svg>
              )}
            </button>
            <span className="track"><span className="fill" /></span>
            <span className="num text-[11px] text-dim">0:10</span>
          </div>
        </div>
      )}

      <p className="m-0 text-[13px] leading-[1.45] text-dim">{e.description}</p>
      {e.quote && <p className="m-0 text-[13px] leading-[1.45] italic">“{e.quote}”</p>}

      <div className="flex flex-col gap-2 border-t border-white/6 pt-2.5 text-[13px] leading-[1.45]">
        <div className={row}>
          <span className="text-xs font-semibold text-amber">Scout</span>
          <span className="text-dim">
            {screenTime ? `${e.brand ?? sponsor} on screen` : <>confidence <span className="num text-ink">{e.confidence.toFixed(2)}</span>{e.sentiment && ` · ${e.sentiment}`}</>}
            {e.is_competitor && " · competitor brand"}
          </span>
        </div>
        {verifier && (
          <div className={row}>
            <span className="text-xs font-semibold text-ink">Verifier</span>
            <span className="text-dim">{verifier}</span>
          </div>
        )}
        {e.audience_reaction && (
          <div className={row}>
            <span className="text-xs font-semibold text-memory">Chat agent</span>
            <span className="flex flex-col gap-1 text-dim">
              <span>Reaction <span className="text-ink">{e.audience_reaction}</span>{(e.reaction_multiplier ?? 1) > 1 && <> · tip ×<span className="num">{e.reaction_multiplier}</span></>}. {e.reaction_summary}</span>
              {!!e.chat_highlights?.length && <span className="text-mute">{e.chat_highlights.map((h) => `“${h}”`).join(" ")}</span>}
            </span>
          </div>
        )}
        <div className={row}>
          <span className="text-xs font-semibold text-accent">Tipper</span>
          <span className="flex flex-col gap-1 text-dim">
            <span>
              <strong className="font-semibold text-ink">{o === "skip" ? "Skip." : o === "deciding" ? "Pricing." : `Pay ${amt}.`}</strong> {why}
              {o === "sending" && `Sending ${amt} to @${e.streamer_id}’s Stripe account…`}
              {o === "paid" && (e.payment_status === "simulated" ? "Simulated: payments are off." : `Paid to @${e.streamer_id}’s Stripe account from the campaign wallet.`)}
              {e.requested_tip_cents && o !== "skip" ? ` Capped from ${money(e.requested_tip_cents)} by the max tip.` : ""}
            </span>
            {e.stripe_transfer_id && <span className="num text-xs text-mute">{e.stripe_transfer_id}</span>}
            {o === "paid" && message && <span className="text-sm font-medium text-ink">“{message}”</span>}
            {e.alert_audio_url && (
              <button type="button" onClick={() => void new Audio(detectorUrl(e.alert_audio_url)).play()} className="self-start rounded-md border border-white/12 bg-transparent px-2.5 py-1.5 text-xs text-dim transition-colors hover:border-white/30 hover:text-ink">
                Play the spoken alert
              </button>
            )}
          </span>
        </div>
      </div>
    </article>
  );
}
