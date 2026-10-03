"use server";

import { redirect } from "next/navigation";
import { campaignId, updateCampaign } from "@/lib/supabase";

// ponytail: no login on the portal yet, so anyone with its URL can run these. They're bounded (test-mode Stripe, max tip
// up to $100, guidance up to 1000 characters); check the brand owner here once brands sign in.

/** "$10.00" -> 1000 */
const cents = (v: FormDataEntryValue | null) => Math.round(parseFloat(String(v ?? "").replace(/[^0-9.]/g, "")) * 100);

export async function saveSettings(form: FormData) {
  const maxTip = cents(form.get("maxtip"));
  if (!(maxTip >= 1 && maxTip <= 10_000)) redirect("/settings?error=maxtip");
  await updateCampaign({ max_tip_cents: maxTip, tipper_instructions: String(form.get("guidance") ?? "").trim().slice(0, 1000) });
  redirect("/settings?saved=1");
}

/** Opens a Stripe Checkout (test mode) that tops up the budget; the payments API's webhook credits it once paid. */
export async function fundWallet(form: FormData) {
  const amount = cents(form.get("fund"));
  if (!(amount >= 100 && amount <= 500_000)) redirect("/settings?error=fund");
  const api = process.env.SUPARADE_API_URL;
  if (!api) throw new Error("Set SUPARADE_API_URL (the payments API) for the portal");
  const r = await fetch(`${api.replace(/\/$/, "")}/agent/campaigns/${campaignId()}/fund`, {
    method: "POST",
    headers: { "X-Agent-Key": process.env.AGENT_API_KEY ?? "", "Content-Type": "application/json" },
    body: JSON.stringify({ amount_cents: amount }),
  });
  if (!r.ok) throw new Error(`Payments API answered ${r.status}: ${await r.text()}`);
  redirect((await r.json()).checkout_url);
}
