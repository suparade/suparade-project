"use server";

import type { Session } from "@/lib/detector";
import { DETECTOR } from "@/lib/detector-url";
import { archiveVideo, brandFits } from "@/lib/supabase";

/**
 * The portal calls this when a session's source exits. If it was a live stream that ended, the stream is kept in
 * Supabase's videos as history, and the answer says which brand the scouts look for, the Twitch categories it fits
 * (saved by the brand agent in onboarding) and which creators are already watched, so the caller can search for a
 * replacement. Null for anything else, including a session another tab already removed. Checked against the detector,
 * so a caller can only archive streams that really ended.
 */
export async function archiveEnded(id: string) {
  const r = await fetch(`${DETECTOR}/api/sessions`, { cache: "no-store" });
  if (!r.ok) throw new Error(`Detector answered ${r.status}`);
  const sessions: Session[] = await r.json();
  const s = sessions.find((x) => x.id === id);
  if (!s?.url || !["stream ended", "stream offline"].includes(s.exit_reason ?? "")) return null;
  await archiveVideo(s.url, s.streamer_id);
  return { brand: s.sponsor_brand, fits: await brandFits(s.sponsor_brand), watched: sessions.map((x) => x.streamer_id.toLowerCase()) };
}
