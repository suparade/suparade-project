"use client";

// Live connection to the Gemini detector (backend/main.py): sessions, analyzed clips, flagged moments, chat.
// One WebSocket per tab, shared through context. Contract: backend/models.py (BeverageEvent, ChunkStatus).
// Starting, feeding and stopping sessions goes through app/detector/sessions, which adds DETECTOR_KEY on the server.
import { createContext, useContext, useEffect, useRef, useState } from "react";

export const DETECTOR = (process.env.NEXT_PUBLIC_DETECTOR_URL || "http://localhost:8000").replace(/\/$/, "");

/** Evidence, clips and audio are served by the detector under relative paths like /evidence/... */
export const detectorUrl = (path?: string | null) => (path ? (path.startsWith("http") ? path : DETECTOR + path) : undefined);

export type TipEvent = {
  event_id: string;
  session_id: string;
  streamer_id: string;
  category: string;
  confidence: number;
  description: string;
  quote?: string | null;
  brand?: string | null;
  stream_offset_seconds: number;
  detected_at?: string;
  suggested_tip_cents: number;
  sentiment?: string | null;
  is_competitor?: boolean;
  status: "tipped" | "blocked" | "pending_verification" | "rejected_by_verifier" | "paying" | "payment_failed";
  block_reasons?: string[];
  verification_reason?: string | null;
  thumbnail_url?: string | null;
  clip_url?: string | null;
  boxes?: { label: string; box_2d: number[] }[];
  audience_reaction?: string | null;
  reaction_summary?: string | null;
  chat_highlights?: string[];
  reaction_multiplier?: number | null;
  alert_message?: string | null;
  alert_audio_url?: string | null;
  card_url?: string | null;
  payment_status?: "paid" | "pending" | "failed" | "simulated" | null;
  payment_error?: string | null;
  stripe_transfer_id?: string | null;
  requested_tip_cents?: number | null;
};

export type Session = {
  id: string;
  source: "url" | "browser";
  streamer_id: string;
  url: string | null;
  chunks_analyzed: number;
  events_detected: number;
  source_exited: boolean;
  exit_reason: string | null;
  started_at: number;
  tips_cents: number;
  demo_alerts: boolean;
  chat_messages: number;
  local_file: boolean;
};

export type Chunk = {
  session_id: string;
  chunk_index: number;
  status: "analyzing" | "nothing_found" | "detected" | "error" | "skipped";
  summary?: string | null;
};

export type ChatMsg = { session_id: string; user: string; text: string; at: number };

export type Health = { model: string; verify_model: string | null; chunk_seconds: number; api_key_set: boolean; sponsor_brand: string; payments_enabled: boolean };

export type NewSession = { source: "url" | "browser"; url?: string; streamer_id: string; demo_alerts?: boolean; chat_script?: string | null };

/** The demo clip shipped with the detector, replayed in real time with scripted chat and spoken thank-you alerts. Paths are relative to the repo root. */
export const DEMO_STREAM: NewSession = {
  source: "url",
  url: "backend/demo/demo_stream.mp4",
  streamer_id: "demo-streamer",
  demo_alerts: true,
  chat_script: "backend/demo/chat_demo.json",
};

type Detector = {
  connected: boolean;
  health: Health | null;
  /** Newest first. */
  events: TipEvent[];
  sessions: Session[];
  chunks: Record<string, Chunk[]>;
  chat: Record<string, ChatMsg[]>;
  /** Webcam or tab captures running in this tab, by session id. */
  streams: Record<string, MediaStream>;
  start: (body: NewSession) => Promise<Session>;
  stop: (id: string) => Promise<void>;
  capture: (kind: "webcam" | "screen", body: Omit<NewSession, "source">, onError: (e: string) => void) => Promise<void>;
};

const Ctx = createContext<Detector | null>(null);

export function useDetector() {
  const d = useContext(Ctx);
  if (!d) throw new Error("useDetector needs a <DetectorProvider>");
  return d;
}

export function DetectorProvider({ children }: { children: React.ReactNode }) {
  const [connected, setConnected] = useState(false);
  const [health, setHealth] = useState<Health | null>(null);
  const [events, setEvents] = useState<TipEvent[]>([]);
  const [sessions, setSessions] = useState<Record<string, Session>>({});
  const [chunks, setChunks] = useState<Record<string, Chunk[]>>({});
  const [chat, setChat] = useState<Record<string, ChatMsg[]>>({});
  const [streams, setStreams] = useState<Record<string, MediaStream>>({});
  const stoppers = useRef<Record<string, () => void>>({});

  useEffect(() => {
    let ws: WebSocket | undefined;
    let closed = false;
    let retry: ReturnType<typeof setTimeout>;

    // Events are re-sent as they move along (verifying -> paying -> tipped), so update them in place.
    const upsert = (ev: TipEvent) =>
      setEvents((prev) => {
        const i = prev.findIndex((p) => p.event_id === ev.event_id);
        if (i === -1) return [ev, ...prev].slice(0, 200);
        const next = [...prev];
        next[i] = ev;
        return next;
      });

    const connect = () => {
      ws = new WebSocket(DETECTOR.replace(/^http/, "ws") + "/ws/events");
      ws.onopen = () => {
        // The detector re-sends every live session and recent chat on connect.
        setSessions({});
        setChat({});
        setConnected(true);
        fetch(`${DETECTOR}/api/health`).then((r) => r.json()).then(setHealth).catch(() => {});
      };
      ws.onclose = () => {
        setConnected(false);
        if (!closed) retry = setTimeout(connect, 2000);
      };
      ws.onmessage = (e) => {
        const msg = JSON.parse(e.data);
        const data = msg.data;
        if (msg.type === "event" || msg.type === "alert") upsert(data);
        else if (msg.type === "session") setSessions((p) => ({ ...p, [data.id]: data }));
        else if (msg.type === "session_stopped")
          setSessions((p) => {
            const next = { ...p };
            delete next[data.id];
            return next;
          });
        else if (msg.type === "chunk")
          setChunks((p) => {
            const list = (p[data.session_id] ?? []).filter((c) => c.chunk_index !== data.chunk_index);
            return { ...p, [data.session_id]: [...list, data].sort((a, b) => a.chunk_index - b.chunk_index).slice(-30) };
          });
        else if (msg.type === "chat") setChat((p) => ({ ...p, [data.session_id]: [...(p[data.session_id] ?? []), data].slice(-40) }));
      };
    };

    fetch(`${DETECTOR}/api/events`)
      .then((r) => r.json())
      .then((recent: { data: TipEvent }[]) =>
        setEvents((prev) => {
          const seen = new Set(prev.map((p) => p.event_id));
          return [...prev, ...recent.map((m) => m.data).reverse().filter((e) => !seen.has(e.event_id))];
        }),
      )
      .catch(() => {});
    connect();
    return () => {
      closed = true;
      clearTimeout(retry);
      ws?.close();
    };
  }, []);

  const start = async (body: NewSession) => {
    const r = await fetch("/detector/sessions", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    if (!r.ok) throw new Error((await r.json().catch(() => null))?.detail || `Detector answered ${r.status}`);
    return (await r.json()) as Session;
  };

  const stop = async (id: string) => {
    stoppers.current[id]?.();
    delete stoppers.current[id];
    setStreams((p) => {
      const next = { ...p };
      delete next[id];
      return next;
    });
    await fetch(`/detector/sessions/${id}`, { method: "DELETE" });
  };

  const capture: Detector["capture"] = async (kind, body, onError) => {
    const stream =
      kind === "webcam"
        ? await navigator.mediaDevices.getUserMedia({ video: { width: 854, height: 480 }, audio: true })
        : await navigator.mediaDevices.getDisplayMedia({ video: { frameRate: 15 }, audio: true });
    let s: Session;
    try {
      s = await start({ ...body, source: "browser" });
    } catch (e) {
      stream.getTracks().forEach((t) => t.stop());
      throw e;
    }
    const stopUploads = uploadClips(stream, s.id, health?.chunk_seconds ?? 10, onError);
    stoppers.current[s.id] = () => {
      stopUploads();
      stream.getTracks().forEach((t) => t.stop());
    };
    stream.getVideoTracks()[0].addEventListener("ended", () => void stop(s.id));
    setStreams((p) => ({ ...p, [s.id]: stream }));
  };

  const list = Object.values(sessions).sort((a, b) => a.started_at - b.started_at);
  return <Ctx value={{ connected, health, events, sessions: list, chunks, chat, streams, start, stop, capture }}>{children}</Ctx>;
}

/**
 * Records a MediaStream in fixed-length clips and uploads each one to the detector. The recorder restarts per clip
 * (instead of a timeslice) so every upload is a standalone, decodable file.
 */
function uploadClips(stream: MediaStream, sessionId: string, seconds: number, onError: (e: string) => void) {
  const mimeType = ["video/webm;codecs=vp8,opus", "video/webm;codecs=vp9,opus", "video/webm", "video/mp4"].find((m) => MediaRecorder.isTypeSupported(m)) ?? "";
  let stopped = false;
  let recorder: MediaRecorder;

  const recordOne = () => {
    if (stopped) return;
    const parts: Blob[] = [];
    const startedAt = performance.now();
    const rec = (recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 800_000 }));
    rec.ondataavailable = (e) => void (e.data.size && parts.push(e.data));
    rec.onstop = async () => {
      const duration = (performance.now() - startedAt) / 1000;
      if (!stopped) recordOne();
      const blob = new Blob(parts, { type: rec.mimeType || "video/webm" });
      if (!blob.size) return;
      const form = new FormData();
      form.append("file", blob, blob.type.includes("mp4") ? "clip.mp4" : "clip.webm");
      form.append("duration", String(duration));
      try {
        const r = await fetch(`/detector/sessions/${sessionId}/chunk`, { method: "POST", body: form });
        if (!r.ok) onError(`Clip upload failed (${r.status})`);
      } catch (err) {
        onError(String(err));
      }
    };
    rec.start();
    setTimeout(() => rec.state === "recording" && rec.stop(), seconds * 1000);
  };

  recordOne();
  return () => {
    stopped = true;
    if (recorder?.state === "recording") recorder.stop();
  };
}
