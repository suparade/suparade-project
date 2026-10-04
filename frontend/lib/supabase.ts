import "server-only";

// Server-side reads from Supabase (PostgREST) with the service role key, for the campaign the detector pays from.
// The key never reaches the browser: this module only runs in Server Components.
// ponytail: no login yet, so every visitor sees this campaign. Move to the publishable key + RLS once brands sign in.
import type { Brief } from "@/app/onboarding/brand/route";
import { BRANDS } from "./brands";
import type { TipEvent } from "./detector";

async function rest<T>(path: string, init?: { method: string; body: string; prefer?: string }): Promise<T> {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in the repo root .env");
  const r = await fetch(`${url}/rest/v1/${path}`, {
    ...init,
    headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json", Prefer: init?.prefer ?? "return=representation" },
    cache: "no-store",
  });
  if (!r.ok) throw new Error(`Supabase ${r.status} on ${path.split("?")[0]}: ${await r.text()}`);
  return r.json();
}

export function campaignId() {
  const id = process.env.SUPARADE_CAMPAIGN_ID;
  if (!id) throw new Error("Set SUPARADE_CAMPAIGN_ID in the repo root .env");
  return id;
}

export type Summary = {
  brand: string;
  balance: number;
  funded: number;
  maxTip: number;
  /** campaigns.tipper_instructions, the "How to tip" guidance the tipper writes its messages with. */
  guidance: string;
  tips: number;
  tipped: number;
  creatorsPaid: number;
  creators: number;
};

type TipRow = {
  id: string;
  amount_cents: number;
  message: string;
  status: "pending" | "paid" | "failed";
  stripe_transfer_id: string | null;
  failure_reason: string | null;
  created_at: string;
  creator_id: string;
  detections: { category: string | null; brand: string | null; quote: string | null; description: string; confidence: number; timestamp_seconds: number; meta: Partial<TipEvent> } | null;
  creators: { handle: string | null; display_name: string } | null;
};

/** A paid (or failed) tip in the same shape as a live detector event, so the feed treats both alike. */
function toEvent(t: TipRow): TipEvent {
  const d = t.detections;
  const m = d?.meta ?? {};
  return {
    ...m,
    event_id: m.event_id ?? t.id,
    session_id: m.session_id ?? "",
    streamer_id: t.creators?.handle ?? m.streamer_id ?? t.creators?.display_name ?? "creator",
    category: d?.category ?? m.category ?? "moment",
    confidence: Number(d?.confidence ?? m.confidence ?? 0),
    description: d?.description ?? "",
    quote: d?.quote ?? m.quote,
    brand: d?.brand ?? m.brand,
    stream_offset_seconds: Number(d?.timestamp_seconds ?? 0),
    detected_at: m.detected_at ?? t.created_at,
    suggested_tip_cents: t.amount_cents,
    status: t.status === "paid" ? "tipped" : t.status === "failed" ? "payment_failed" : "paying",
    payment_status: t.status,
    payment_error: t.failure_reason,
    stripe_transfer_id: t.stripe_transfer_id,
    alert_message: m.alert_message ?? t.message,
  };
}

// ponytail: sums in JS over every ledger row and tip; fine at hackathon volume, move to a SQL view when it grows.
export async function missionData(): Promise<{ summary: Summary; history: TipEvent[] }> {
  const id = campaignId();
  const [campaigns, ledger, tips, creators, recent] = await Promise.all([
    rest<{ max_tip_cents: number; tipper_instructions: string; brands: { name: string } | null }[]>(
      `campaigns?select=max_tip_cents,tipper_instructions,brands(name)&id=eq.${id}`,
    ),
    rest<{ kind: string; amount_cents: number }[]>(`wallet_ledger?select=kind,amount_cents&campaign_id=eq.${id}`),
    rest<{ amount_cents: number; creator_id: string }[]>(`tips?select=amount_cents,creator_id&status=eq.paid&campaign_id=eq.${id}`),
    rest<{ id: string }[]>("creators?select=id"),
    rest<TipRow[]>(
      `tips?select=id,amount_cents,message,status,stripe_transfer_id,failure_reason,created_at,creator_id,` +
        `detections(category,brand,quote,description,confidence,timestamp_seconds,meta),creators(handle,display_name)` +
        `&campaign_id=eq.${id}&order=created_at.desc&limit=20`,
    ),
  ]);
  if (!campaigns.length) throw new Error(`Campaign ${id} not found in Supabase`);
  const sum = (rows: { amount_cents: number }[]) => rows.reduce((n, r) => n + r.amount_cents, 0);
  return {
    summary: {
      brand: campaigns[0].brands?.name ?? "",
      balance: sum(ledger),
      funded: sum(ledger.filter((l) => l.kind === "funding")),
      maxTip: campaigns[0].max_tip_cents,
      guidance: campaigns[0].tipper_instructions,
      tips: tips.length,
      tipped: sum(tips),
      creatorsPaid: new Set(tips.map((t) => t.creator_id)).size,
      creators: creators.length,
    },
    history: recent.map(toEvent),
  };
}

export type Creator = {
  id: string;
  handle: string | null;
  display_name: string;
  stripe_account_id: string | null;
  transfers_enabled: boolean;
  tips: number;
  tipped: number;
};

export async function creatorsData(): Promise<Creator[]> {
  const [creators, tips] = await Promise.all([
    rest<Omit<Creator, "tips" | "tipped">[]>("creators?select=id,handle,display_name,stripe_account_id,transfers_enabled&order=created_at"),
    rest<{ creator_id: string; amount_cents: number }[]>(`tips?select=creator_id,amount_cents&status=eq.paid&campaign_id=eq.${campaignId()}`),
  ]);
  return creators.map((c) => {
    const mine = tips.filter((t) => t.creator_id === c.id);
    return { ...c, tips: mine.length, tipped: mine.reduce((n, t) => n + t.amount_cents, 0) };
  });
}

/** Settings page: the campaign fields the agents read (the payments API caps tips at max_tip_cents, the tipper writes with the guidance). */
export async function updateCampaign(fields: { max_tip_cents: number; tipper_instructions: string }) {
  const rows = await rest<unknown[]>(`campaigns?id=eq.${campaignId()}`, { method: "PATCH", body: JSON.stringify(fields) });
  if (!rows.length) throw new Error("Campaign not found in Supabase");
}

/** A live stream that ended leaves the dashboard but stays in videos as history, keyed by its URL like the payments API's rows. */
export async function archiveVideo(url: string, handle: string) {
  await rest("videos?on_conflict=url", {
    method: "POST",
    body: JSON.stringify({ url, title: `@${handle}`, status: "done" }),
    prefer: "resolution=merge-duplicates,return=representation",
  });
}

/** What the brand agent learned in onboarding, kept on the brand row with that name (any case), added if missing. */
export async function saveBrief(brief: Brief) {
  // ilike treats these as wildcards, so the PATCH could overwrite other brands' briefs.
  if (/[%_*]/.test(brief.name)) throw new Error(`Can't save a brand named "${brief.name}": it contains %, _ or *`);
  const rows = await rest<unknown[]>(`brands?name=ilike.${encodeURIComponent(brief.name)}`, { method: "PATCH", body: JSON.stringify({ brief }) });
  if (!rows.length) await rest("brands", { method: "POST", body: JSON.stringify({ name: brief.name, brief }) });
}

/** The Twitch categories the search agent looks in for a brand: the brand agent's, else the sample brand's. */
export async function brandFits(name: string): Promise<string[]> {
  const rows = await rest<{ brief: Brief }[]>(`brands?select=brief&brief=not.is.null&name=ilike.${encodeURIComponent(name)}&limit=1`);
  return rows[0]?.brief.fits ?? BRANDS.find((b) => b.short === name)?.fits ?? [];
}
