import { saveBrief } from "@/lib/supabase";

// The brand agent: two Exa deep-lite searches in parallel (what the brand is and looks like on camera; what brands pay
// streamers), then the Twitch categories Exa suggests are checked against Twitch, since the search agent looks there.
// About 6 s and 2.4¢ per run (2026-10-04).
// The brief is saved on the brand's row in Supabase (brands.brief), so the search agent also uses its categories when
// it replaces a live stream that ended (lib/detector.tsx, ReplaceEndedStreams).
// ponytail: anyone with the portal URL can spend Exa credit here, like /detector/sessions. Gate both once brands sign in.

export type Brief = { name: string; kind: string; product: string; fits: string[]; profile: [string, string][]; sources: number };

type Grounding = { citations: { url: string }[] }[];

async function exa<T>(query: string, properties: Record<string, object>): Promise<{ content: T; sources: string[] }> {
  const key = process.env.EXA_API_KEY;
  if (!key) throw new Error("Set EXA_API_KEY in the repo root .env");
  const r = await fetch("https://api.exa.ai/search", {
    method: "POST",
    headers: { "x-api-key": key, "Content-Type": "application/json" },
    body: JSON.stringify({
      query,
      type: "deep-lite",
      numResults: 5,
      systemPrompt: "You brief AI scouts that watch Twitch and YouTube live streams and tip the creator when this brand shows up. Be concrete and visual.",
      outputSchema: { type: "object", required: Object.keys(properties), properties },
    }),
  });
  const d = await r.json();
  if (!r.ok || !d.output?.content) throw new Error(d.error ?? `Exa answered ${r.status}`);
  return { content: d.output.content, sources: ((d.output.grounding ?? []) as Grounding).flatMap((g) => g.citations.map((c) => c.url)) };
}

// game(name:) is an exact match and answers null otherwise. searchCategories is fuzzier but maps "Travel" to "IRL".
async function onTwitch(names: string[]): Promise<string[]> {
  if (!names.length) return [];
  const r = await fetch("https://gql.twitch.tv/gql", {
    method: "POST",
    headers: { "Client-ID": "kimne78kx3ncx6brgo4mv6wki5h1ko", "Content-Type": "application/json" },
    body: JSON.stringify({
      query: `query(${names.map((_, i) => `$g${i}: String!`).join(" ")}) { ${names.map((_, i) => `g${i}: game(name: $g${i}) { name }`).join(" ")} }`,
      variables: Object.fromEntries(names.map((n, i) => [`g${i}`, n])),
    }),
  });
  const { data } = (await r.json()) as { data?: Record<string, { name: string } | null> };
  if (!data) throw new Error(`Twitch answered ${r.status}`);
  return [...new Set(names.flatMap((_, i) => data[`g${i}`]?.name ?? []))];
}

type About = { name: string; kind: string; item: string; product: string; looks_like: string; sounds_like: string; fits_with: string; twitch_categories: string[]; never_pay_for: string };
type Rates = { per_mention_usd: number; per_placement_usd: number; summary: string };

const BROAD = ["Just Chatting", "IRL"];
const s = (description: string) => ({ type: "string", description });
const usd = (n: number) => `$${Math.round(n).toLocaleString("en-US")}`;

export async function POST(req: Request) {
  // A name or a website.
  const { brand: raw } = (await req.json().catch(() => ({}))) as { brand?: unknown };
  const brand = (typeof raw === "string" ? raw : "").trim().slice(0, 100);
  if (!brand) return Response.json({ error: "brand is required" }, { status: 400 });

  try {
    const [about, rates] = await Promise.all([
      exa<About>(`${brand} brand: products, packaging, logo, how people refer to it, audience`, {
        name: s("The brand's usual short name"),
        kind: s("What it sells, 2 to 4 words"),
        item: s("The one physical thing a viewer would see on stream, one lowercase noun like bottle, can, bar or headset"),
        product: s("The product range and sizes, one sentence"),
        looks_like: s("What the product looks like on camera: shape, colours, logo, wordmark"),
        sounds_like: s("Names people say for it, quoted"),
        fits_with: s("Kinds of streams and audiences it fits"),
        twitch_categories: {
          type: "array",
          items: { type: "string" },
          description: "3 to 5 exact Twitch category names where streams fit the brand, such as Fitness & Health, Food & Drink, Travel & Outdoors, Sports, Co-working & Studying, or a game's exact title. Not broad ones like Just Chatting or IRL",
        },
        never_pay_for: s("Competitors in frame and other moments not to pay for"),
      }),
      exa<Rates>(`How much do brands like ${brand} pay Twitch and YouTube streamers per sponsored mention or product placement`, {
        per_mention_usd: { type: "number", description: "Typical USD a brand pays a mid-size streamer for one spoken mention" },
        per_placement_usd: { type: "number", description: "Typical USD for the product visibly on screen or used on camera during a stream" },
        summary: s("One or two sentences with the ranges and what they depend on"),
      }),
    ]);
    const a = about.content;
    // Just Chatting and IRL fit every brand, and ranked by viewers they bring the biggest unrelated streamers.
    const fits = (await onTwitch(a.twitch_categories.slice(0, 5).map((c) => c.slice(0, 60)))).filter((c) => !BROAD.includes(c));
    const brief: Brief = {
      name: a.name,
      kind: a.kind,
      product: a.item,
      fits,
      profile: [
        ["Product", a.product],
        ["Looks like", a.looks_like],
        ["Sounds like", a.sounds_like],
        ["Fits with", a.fits_with],
        ["Twitch categories", fits.join(", ") || "None found on Twitch, so the search looks for the name in stream titles only"],
        ["Never pay for", a.never_pay_for],
        ["Market rate", `${usd(rates.content.per_mention_usd)} per mention, ${usd(rates.content.per_placement_usd)} per placement. ${rates.content.summary}`],
      ],
      sources: new Set([...about.sources, ...rates.sources]).size,
    };
    await saveBrief(brief);
    return Response.json(brief);
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 502 });
  }
}
