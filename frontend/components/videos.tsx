"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { sourceLabel } from "@/components/mission-control";
import { DEMO_STREAM, useDetector, type NewSession } from "@/lib/detector";
import { categoryLabel, clock, money } from "@/lib/format";
import type { Creator } from "@/lib/supabase";

const th = "border-b border-white/8 px-3 pb-2.5 text-left text-xs font-medium whitespace-nowrap text-mute";
const td = "h-[52px] border-b border-white/6 px-3 align-middle text-sm whitespace-nowrap transition-colors group-hover:bg-white/4";
const smallBtn = "rounded-md border border-white/12 bg-transparent px-2.5 py-1.5 text-xs text-dim transition-colors hover:border-white/30 hover:text-ink";

export function Videos({ creators, error }: { creators: Creator[]; error?: string }) {
  const d = useDetector();
  const router = useRouter();
  const [handle, setHandle] = useState(DEMO_STREAM.streamer_id);
  const [url, setUrl] = useState("");
  const [spoken, setSpoken] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  // Creator payout totals live in Supabase.
  useEffect(() => {
    const id = setInterval(() => router.refresh(), 20000);
    return () => clearInterval(id);
  }, [router]);

  const creator = (h: string) => creators.find((c) => c.handle?.toLowerCase() === h.trim().replace(/^@/, "").toLowerCase());
  const streamer_id = handle.trim().replace(/^@/, "");
  const scanning = d.sessions.filter((s) => !s.source_exited);

  const run = async (go: () => Promise<unknown>) => {
    setBusy(true);
    setErr("");
    try {
      await go();
    } catch (e) {
      setErr((e as Error).message);
    }
    setBusy(false);
  };
  const body = (): Omit<NewSession, "source"> => ({ streamer_id, demo_alerts: spoken });

  return (
    <main className="min-w-0 flex-[999_1_560px]">
      <div className="mx-auto flex w-full max-w-[1200px] flex-col gap-7 px-6 pt-10 pb-16">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="flex max-w-[640px] flex-col gap-2.5">
            <h1 className="m-0 text-[44px] leading-[1.05] font-bold tracking-[-0.01em] font-stretch-78%">Videos</h1>
            <p className="m-0 text-base leading-normal text-dim">Every source gets its own scout. Paste a live URL or a recording, or put yourself on camera for a demo. Tips go to the Stripe account of the creator whose handle you enter.</p>
          </div>
          <span className="text-[13px] text-mute">
            <span className="num">{d.sessions.length}</span> sources · <span className="num">{scanning.length}</span> scanning · <span className="num">{d.sessions.reduce((n, s) => n + s.chunks_analyzed, 0).toLocaleString("en-US")}</span> clips analyzed
          </span>
        </div>

        {error && <p role="status" className="m-0 rounded-[10px] border border-amber/30 bg-amber/8 px-4 py-3 text-[13px]">Can&apos;t read Supabase: {error}</p>}
        {!d.connected && <p role="status" className="m-0 rounded-[10px] border border-amber/30 bg-amber/8 px-4 py-3 text-[13px]">The Gemini detector isn&apos;t running, so sources can&apos;t be added. Start everything with ./scripts/run_e2e.sh.</p>}

        <form
          onSubmit={(e) => {
            e.preventDefault();
            void run(async () => {
              await d.start({ ...body(), source: "url", url: url.trim() });
              setUrl("");
            });
          }}
          className="glass flex flex-col gap-3 rounded-[10px] border border-white/10 bg-white/[.045] p-4"
        >
          <div className="flex flex-wrap items-end gap-2.5">
            <div className="flex min-w-40 flex-[0_1_220px] flex-col gap-1.5">
              <label htmlFor="creator" className="text-[13px] text-dim">Creator handle</label>
              <input id="creator" value={handle} onChange={(e) => setHandle(e.target.value)} placeholder="@handle" required />
            </div>
            <div className="flex min-w-0 flex-[1_1_320px] flex-col gap-1.5">
              <label htmlFor="url" className="text-[13px] text-dim">Stream URL, video URL or local file</label>
              <input id="url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://twitch.tv/… or https://youtu.be/… or backend/demo/demo_stream.mp4" required />
            </div>
            <button type="submit" disabled={busy || !d.connected} className="btn-primary h-10 px-4 text-sm disabled:opacity-50">Add source</button>
            <span className="px-1 pb-[11px] text-[13px] text-mute">or</span>
            <button type="button" disabled={busy || !d.connected || !streamer_id} onClick={() => void run(() => d.capture("webcam", body(), setErr))} className="btn-ghost h-10 px-3.5 text-sm font-medium disabled:opacity-50">Use webcam</button>
            <button type="button" disabled={busy || !d.connected || !streamer_id} onClick={() => void run(() => d.capture("screen", body(), setErr))} className="btn-ghost h-10 px-3.5 text-sm font-medium disabled:opacity-50">Share a browser tab</button>
            <button type="button" disabled={busy || !d.connected} onClick={() => void run(() => d.start(DEMO_STREAM))} className="btn-ghost h-10 px-3.5 text-sm font-medium disabled:opacity-50">Replay the demo clip</button>
          </div>
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-[13px]">
            <label className="flex min-h-11 cursor-pointer items-center gap-2 text-dim">
              <input type="checkbox" checked={spoken} onChange={(e) => setSpoken(e.target.checked)} />
              Spoken thank-you alerts (Gemini writes and reads each tip message)
            </label>
            {streamer_id && !error && (creator(streamer_id)?.transfers_enabled ? (
              <span className="text-mute">@{streamer_id} can be paid: Stripe account <span className="num">{creator(streamer_id)!.stripe_account_id}</span></span>
            ) : (
              <span className="text-amber">@{streamer_id} has no Stripe account that can receive payouts. Moments will be flagged but not paid.</span>
            ))}
          </div>
          {err && <p role="alert" className="m-0 text-[13px] text-live">{err}</p>}
        </form>

        <div className="glass overflow-x-auto rounded-[10px] border border-white/10 bg-white/[.045] px-2 pt-3.5 pb-1">
          <table className="w-full min-w-[1000px] border-collapse">
            <thead>
              <tr>
                <th className={th}>Creator</th>
                <th className={th}>Source</th>
                <th className={th}>Status</th>
                <th className={`${th} text-right`}>Clips</th>
                <th className={`${th} text-right`}>Flags</th>
                <th className={`${th} text-right`}>Tipped</th>
                <th className={th}>Chat engagement</th>
                <th className={th}>Last moment</th>
                <th className={th}><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody>
              {d.sessions.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-3 py-6 text-sm text-mute">No sources yet. Add one above; it shows up here while its scout watches.</td>
                </tr>
              )}
              {d.sessions.map((s) => {
                const c = creator(s.streamer_id);
                const events = d.events.filter((e) => e.session_id === s.id);
                const reaction = events.find((e) => e.audience_reaction);
                const last = events[0];
                return (
                  <tr key={s.id} className="group">
                    <td className={td}>
                      <span className="flex flex-col gap-0.5">
                        <span className="font-semibold">@{s.streamer_id}</span>
                        {c?.stripe_account_id ? (
                          <span className="num text-xs text-mute">{c.stripe_account_id}{!c.transfers_enabled && " · payouts pending"}</span>
                        ) : (
                          <span className="text-xs text-amber">No Stripe account yet</span>
                        )}
                      </span>
                    </td>
                    <td className={`${td} max-w-[260px] truncate text-dim`} title={s.url ?? undefined}>
                      {sourceLabel(s)} <span className="text-mute">· {s.source === "browser" ? "webcam or tab" : s.local_file ? s.url : "live"}</span>
                    </td>
                    <td className={td}>
                      <span className={`inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium ${s.source_exited ? "bg-white/8 text-dim" : "bg-amber/12 text-amber"}`}>
                        {!s.source_exited && <span className="size-1.5 rounded-full bg-amber" />}
                        {s.source_exited ? "ended" : "scanning"}
                      </span>
                    </td>
                    <td className={`${td} num text-right text-[13px] ${s.chunks_analyzed ? "" : "text-mute"}`}>{s.chunks_analyzed.toLocaleString("en-US")}</td>
                    <td className={`${td} num text-right text-[13px] ${s.events_detected ? "" : "text-mute"}`}>{s.events_detected}</td>
                    <td className={`${td} num text-right text-[13px] ${s.tips_cents ? "text-accent" : "text-mute"}`}>{money(s.tips_cents)}</td>
                    <td className={`${td} ${s.chat_messages ? "" : "text-mute"}`}>
                      {s.chat_messages ? (
                        <span className="flex flex-col gap-0.5">
                          <span><span className="num">{s.chat_messages}</span> messages{reaction && <> · reaction <span className="font-semibold">{reaction.audience_reaction}</span></>}</span>
                          {reaction?.chat_highlights?.[0] && <span className="max-w-[220px] truncate text-xs text-mute">“{reaction.chat_highlights[0]}”</span>}
                        </span>
                      ) : "No chat feed"}
                    </td>
                    <td className={`${td} ${last ? "text-dim" : "text-mute"}`}>
                      {last ? <>{categoryLabel(last.category)} <span className="num text-[13px] text-mute">· {clock(last.stream_offset_seconds)}</span></> : "Nothing flagged yet"}
                    </td>
                    <td className={`${td} text-right`}>
                      <button type="button" onClick={() => void d.stop(s.id)} className={smallBtn}>Stop</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <section aria-labelledby="creators" className="flex flex-col gap-3">
          <div className="flex flex-col gap-1">
            <h2 id="creators" className="m-0 text-[22px] leading-[1.2] font-semibold">Creators</h2>
            <p className="m-0 max-w-[720px] text-[13px] leading-normal text-mute">From Supabase. Each creator sets up their own Stripe account once (Stripe Connect onboarding, <code className="num">python -m scripts.seed_demo</code> creates one). The tipper pays the creator whose handle matches the source.</p>
          </div>
          <div className="glass overflow-x-auto rounded-[10px] border border-white/10 bg-white/[.045] px-2 pt-3.5 pb-1">
            <table className="w-full min-w-[640px] border-collapse">
              <thead>
                <tr>
                  <th className={th}>Creator</th>
                  <th className={th}>Stripe account</th>
                  <th className={th}>Payouts</th>
                  <th className={`${th} text-right`}>Tips</th>
                  <th className={`${th} text-right`}>Tipped</th>
                </tr>
              </thead>
              <tbody>
                {creators.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-3 py-6 text-sm text-mute">No creators yet.</td>
                  </tr>
                )}
                {creators.map((c) => (
                  <tr key={c.id} className="group">
                    <td className={td}>
                      <span className="flex flex-col gap-0.5">
                        <span className="font-semibold">{c.handle ? `@${c.handle}` : c.display_name}</span>
                        {c.handle && <span className="text-xs text-mute">{c.display_name}</span>}
                      </span>
                    </td>
                    <td className={`${td} num text-[13px] ${c.stripe_account_id ? "text-dim" : "text-amber"}`}>{c.stripe_account_id ?? "Not set up"}</td>
                    <td className={td}>
                      <span className={`inline-flex rounded-md px-2 py-1 text-xs font-medium ${c.transfers_enabled ? "bg-accent/10 text-accent" : "bg-white/8 text-dim"}`}>{c.transfers_enabled ? "active" : "pending"}</span>
                    </td>
                    <td className={`${td} num text-right text-[13px]`}>{c.tips}</td>
                    <td className={`${td} num text-right text-[13px] ${c.tipped ? "text-accent" : "text-mute"}`}>{money(c.tipped)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </main>
  );
}
