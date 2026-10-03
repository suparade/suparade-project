export const money = (cents: number) => "$" + (cents / 100).toFixed(2);

/** Seconds as hh:mm:ss. */
export const clock = (sec: number) =>
  [Math.floor(sec / 3600), Math.floor((sec % 3600) / 60), Math.floor(sec % 60)].map((n) => String(n).padStart(2, "0")).join(":");

// Labels for the Gemini detector's categories and tip-policy reasons (backend/models.py, backend/tip_policy.py).
export const CATEGORY: Record<string, string> = {
  sports_drink_mention: "Sports drink mention",
  drinking_water: "Drinking water",
  drinking_other: "Drinking the product",
  holding_or_showing_beverage: "Showing a beverage",
  verbal_beverage_mention: "Talks about drinks",
  sponsor_screen_time: "Brand on screen",
};

export const categoryLabel = (c: string) => CATEGORY[c] ?? c.replaceAll("_", " ");

export function reasonLabel(r: string) {
  const [kind, value] = r.split(":");
  if (kind === "safety") return `unsafe content (${value})`;
  if (kind === "sentiment") return `${value} sentiment`;
  if (kind === "subject") return value === "video_playback" ? "a video playing on screen" : "not a real person";
  return r.replaceAll("_", " ");
}

// Error codes from the payments API (app/services/tips.py, app/services/stream_events.py).
const PAYMENT_ERRORS: Record<string, string> = {
  insufficient_budget: "the wallet is empty",
  unknown_streamer: "this creator has no Stripe account yet",
  creator_not_payable: "the creator's Stripe account can't receive payouts yet",
  campaign_not_active: "the campaign is paused",
  campaign_not_found: "the campaign doesn't exist",
};

export const paymentError = (e?: string | null) => (e ? (PAYMENT_ERRORS[e] ?? e.replaceAll("_", " ")) : "unknown error");
