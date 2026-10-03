import type { NextRequest } from "next/server";

// The search agent: live streams on Twitch and YouTube that say the brand in their title, plus Twitch streams live in a
// category where it fits. YouTube has no categories, and a live search for "Sports" returns news channels. No API keys: Twitch's public web GraphQL client ID (the one streamlink uses) and YouTube's web search
// endpoint (the one yt-dlp uses).
// ponytail: live streams only. url_source.py reads URLs as fast as they arrive, and a YouTube recording arrives far
// faster than real time, so the scouts would skip most of it. Add recordings with ffmpeg -readrate there.
// ponytail: unofficial endpoints; move to Twitch Helix and the YouTube Data API with our own keys if they break.

export type Found = { platform: "Twitch" | "YouTube"; url: string; handle: string; title: string; viewers: number; topic: string; mentions: boolean };

const says = (title: string, brand: string) => title.toLowerCase().includes(brand.toLowerCase());

type TwitchNode = { title: string | null; viewersCount: number; broadcaster: { login: string } | null; game: { name: string } | null };
type Edges = { edges: { node: TwitchNode }[] };

async function twitch(brand: string, fits: string[]): Promise<Found[]> {
  const node = "title viewersCount broadcaster { login } game { name }";
  const games = fits.map((_, i) => `g${i}: game(name: $g${i}) { streams(first: 4) { edges { node { ${node} } } } }`).join(" ");
  const r = await fetch("https://gql.twitch.tv/gql", {
    method: "POST",
    headers: { "Client-ID": "kimne78kx3ncx6brgo4mv6wki5h1ko", "Content-Type": "application/json" },
    body: JSON.stringify({
      query: `query($q: String! ${fits.map((_, i) => `$g${i}: String!`).join(" ")}) { s: searchStreams(userQuery: $q, first: 10) { edges { node { ${node} } } } ${games} }`,
      variables: { q: brand, ...Object.fromEntries(fits.map((f, i) => [`g${i}`, f])) },
    }),
  });
  const { data, errors } = (await r.json()) as { data?: Record<string, (Edges & { streams?: Edges }) | null>; errors?: { message: string }[] };
  if (!data) throw new Error(errors?.[0]?.message ?? `Twitch answered ${r.status}`);
  // searchStreams also matches channel names (gatorade2008), so keep only titles that say the brand.
  const named = (data.s?.edges ?? []).filter((e) => says(e.node.title ?? "", brand));
  const fitting = fits.flatMap((_, i) => data[`g${i}`]?.streams?.edges ?? []);
  return [...named, ...fitting].flatMap(({ node: n }) => {
    if (!n.broadcaster) return [];
    const title = n.title ?? "";
    return [{ platform: "Twitch" as const, url: `https://www.twitch.tv/${n.broadcaster.login}`, handle: n.broadcaster.login, title, viewers: n.viewersCount, topic: n.game?.name ?? "", mentions: says(title, brand) }];
  });
}

type Runs = { simpleText?: string; runs?: { text: string; navigationEndpoint?: { browseEndpoint?: { canonicalBaseUrl?: string } } }[] };
type Video = { videoId: string; title: Runs; ownerText: Runs; viewCountText?: Runs; badges?: { metadataBadgeRenderer?: { style?: string } }[] };
const text = (r?: Runs) => r?.simpleText ?? r?.runs?.map((x) => x.text).join("") ?? "";

async function youtube(brand: string): Promise<Found[]> {
  const r = await fetch("https://www.youtube.com/youtubei/v1/search?prettyPrint=false", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    // params is YouTube's "Live" search filter.
    body: JSON.stringify({ context: { client: { clientName: "WEB", clientVersion: "2.20250101.00.00", hl: "en", gl: "US" } }, query: brand, params: "EgJAAQ%3D%3D" }),
  });
  if (!r.ok) throw new Error(`YouTube answered ${r.status}`);
  const d = await r.json();
  const items: { videoRenderer?: Video }[] = (d.contents?.twoColumnSearchResultsRenderer?.primaryContents?.sectionListRenderer?.contents ?? []).flatMap(
    (s: { itemSectionRenderer?: { contents: unknown[] } }) => s.itemSectionRenderer?.contents ?? [],
  );
  return items.flatMap(({ videoRenderer: v }) => {
    if (!v?.badges?.some((b) => b.metadataBadgeRenderer?.style === "BADGE_STYLE_TYPE_LIVE_NOW")) return [];
    const title = text(v.title);
    if (!says(title, brand)) return [];
    const owner = v.ownerText.runs?.[0];
    const path = owner?.navigationEndpoint?.browseEndpoint?.canonicalBaseUrl ?? "";
    const handle = path.startsWith("/@") ? decodeURIComponent(path.slice(2)) : text(v.ownerText).replace(/\s+/g, "");
    return [{ platform: "YouTube" as const, url: `https://www.youtube.com/watch?v=${v.videoId}`, handle, title, viewers: Number(text(v.viewCountText).replace(/\D/g, "")) || 0, topic: "", mentions: true }];
  });
}

export async function GET(req: NextRequest) {
  const p = req.nextUrl.searchParams;
  const brand = (p.get("brand") ?? "").trim().slice(0, 60);
  const fits = p.getAll("fit").slice(0, 4).map((f) => f.slice(0, 60));
  if (!brand) return Response.json({ error: "brand is required" }, { status: 400 });

  const results = await Promise.allSettled([twitch(brand, fits), youtube(brand)]);
  const all = results.flatMap((r) => (r.status === "fulfilled" ? r.value : []));
  const failed = ["Twitch", "YouTube"].filter((_, i) => results[i].status === "rejected");
  if (results.every((r) => r.status === "rejected")) return Response.json({ error: `${failed.join(" and ")} didn't answer` }, { status: 502 });

  // One stream per creator. Streams that say the brand come first, then the biggest audiences.
  // 24/7 streams are loops, which the tip policy never pays for.
  const seen = new Set<string>();
  const streams = all
    .filter((s) => !/24\s*\/\s*7/.test(s.title))
    .sort((a, b) => Number(b.mentions) - Number(a.mentions) || b.viewers - a.viewers)
    .filter((s) => !seen.has(s.handle.toLowerCase()) && seen.add(s.handle.toLowerCase()))
    .slice(0, 6);
  return Response.json({ streams, checked: all.length, failed });
}
