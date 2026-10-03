"use client";

import { useEffect, useRef, useState } from "react";
import { StreamMedia } from "@/components/mission-control";
import { DetectorProvider, detectorUrl, useDetector } from "@/lib/detector";
import { money } from "@/lib/format";

const W = 1280;
const H = 720;
const SHOW_MS = 15000;
const frost = "frost rounded bg-[rgba(12,14,18,0.5)]";
/** Tips from the last two minutes still get spoken when the page opens; older ones don't. */
const fresh = (iso?: string) => Date.now() - Date.parse(iso ?? "") < 120_000;

export default function Page() {
  return (
    <DetectorProvider>
      <Alert />
    </DetectorProvider>
  );
}

/** What the streamer sees: the newest stream with each paid tip dropping in, spoken in demo mode. Scaled down to fit narrow screens. */
function Alert() {
  const d = useDetector();
  const [scale, setScale] = useState(1);
  useEffect(() => {
    const fit = () => setScale(Math.min(1, window.innerWidth / W));
    fit();
    window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  }, []);

  const session = d.sessions.at(-1);
  const tip = d.events.find((e) => e.status === "tipped" && (!session || e.session_id === session.id));
  const tipId = tip?.event_id;
  const audio = tip?.alert_audio_url;
  const sponsor = d.health?.sponsor_brand ?? "Gatorade";

  const [hidden, setHidden] = useState<string | null>(null);
  useEffect(() => {
    if (!tipId) return;
    const t = setTimeout(() => setHidden(tipId), SHOW_MS);
    return () => clearTimeout(t);
  }, [tipId]);

  // Speak each fresh alert once (the detector adds the audio a few seconds after the payment).
  const spoken = useRef(new Set<string>());
  const detectedAt = tip?.detected_at;
  useEffect(() => {
    if (!tipId || !audio || spoken.current.has(tipId) || !fresh(detectedAt)) return;
    spoken.current.add(tipId);
    new Audio(detectorUrl(audio)).play().catch(() => {});
  }, [tipId, audio, detectedAt]);

  const showing = tip && tip.event_id !== hidden ? tip : null;
  const chat = session ? (d.chat[session.id] ?? []).slice(-6) : [];

  return (
    <div className="overflow-hidden" style={{ width: W * scale, height: H * scale }}>
      <div
        className="relative origin-top-left overflow-hidden"
        style={{
          width: W,
          height: H,
          transform: `scale(${scale})`,
          background: "radial-gradient(ellipse 26% 50% at 50% 74%, hsl(265 30% 46% / 0.55), transparent 70%), radial-gradient(120% 90% at 30% 15%, hsl(265 45% 30%) 0%, hsl(265 40% 13%) 55%, #0C0E12 100%)",
        }}
      >
        {session && <StreamMedia s={session} stream={d.streams[session.id]} poster={detectorUrl(tip?.thumbnail_url)} />}

        <div className="absolute top-6 left-6 flex items-center gap-2">
          <span className={`${frost} flex items-center gap-1.5 px-[9px] py-1 text-xs font-semibold`}><span className={`size-[7px] rounded-full ${session ? "bg-live" : "bg-mute"}`} />{session ? "LIVE" : "OFFLINE"}</span>
          <span className={`${frost} px-[9px] py-1 text-xs text-dim`}>{session ? `@${session.streamer_id}` : d.connected ? "Waiting for a stream" : "Detector offline"}</span>
        </div>

        {(chat.length > 0 || showing) && (
          <aside aria-label="Stream chat" className="glass absolute top-0 right-0 bottom-0 flex w-[300px] flex-col justify-end gap-3 border-l border-white/8 bg-[rgba(12,14,18,0.45)] px-[18px] py-5 text-[13px] leading-[1.45]">
            {chat.map((m, i) => (
              <p key={`${m.at}-${i}`} className="m-0"><span className="font-semibold text-amber">{m.user}</span> <span className="text-dim">{m.text}</span></p>
            ))}
            {showing && (
              <div className="flex flex-col gap-1 rounded-md border border-accent/25 bg-accent/8 px-3 py-2.5">
                <span className="text-[13px] font-semibold text-accent">{sponsor} tipped <span className="num">{money(showing.suggested_tip_cents)}</span></span>
                {showing.alert_message && <span>{showing.alert_message}</span>}
              </div>
            )}
          </aside>
        )}

        {showing && (
          <div key={showing.event_id} role="status" className="alert-drop glass absolute top-9 left-[490px] flex w-[520px] items-center gap-4 rounded-[10px] border border-accent bg-[rgba(19,22,28,0.5)] px-5 py-[18px]">
            <span className="flex size-14 flex-none items-center justify-center rounded-lg bg-accent">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#0C0E12" strokeWidth="2" strokeLinejoin="round" aria-hidden="true"><path d="M13 2L4 14h7l-1 8 9-12h-7l1-8z" /></svg>
            </span>
            <div className="flex min-w-0 flex-auto flex-col gap-1">
              <span className="text-[22px] leading-[1.15] font-bold font-stretch-85%">{sponsor} tipped you <span className="num font-semibold">{money(showing.suggested_tip_cents)}</span></span>
              <span className="text-[17px] leading-[1.3]">{showing.alert_message ?? showing.description}</span>
              <span className="flex flex-wrap items-center gap-2 text-xs text-dim">
                <span className="rounded border border-white/24 px-1.5 py-0.5 font-semibold text-ink">Paid placement</span>
                Paid to your Stripe account · via GTM.si
              </span>
            </div>
            {/* eslint-disable-next-line @next/next/no-img-element -- Gemini's thank-you card, served by the local detector */}
            {showing.card_url && <img src={detectorUrl(showing.card_url)} alt={`${sponsor} thank-you card`} className="size-20 flex-none rounded-md object-cover" />}
          </div>
        )}
      </div>
    </div>
  );
}
