import { DETECTOR } from "@/lib/detector-url";

// Starts, feeds and stops detector sessions with DETECTOR_KEY, which stays on the server. Reads, media and the
// WebSocket go to the detector directly (lib/detector.tsx). Not under /api: on Vercel that path is the payments API.
// ponytail: no login on the portal yet, so anyone with its URL can start sessions here; gate it once brands sign in.

async function forward(req: Request, ctx: RouteContext<"/detector/sessions/[[...path]]">) {
  const { path = [] } = await ctx.params;
  const headers: Record<string, string> = { "X-Detector-Key": process.env.DETECTOR_KEY ?? "" };
  const type = req.headers.get("content-type");
  if (type) headers["Content-Type"] = type;
  const r = await fetch([`${DETECTOR}/api/sessions`, ...path.map(encodeURIComponent)].join("/"), {
    method: req.method,
    headers,
    body: req.method === "DELETE" ? undefined : await req.arrayBuffer(),
  });
  return new Response(r.body, { status: r.status, headers: { "Content-Type": r.headers.get("content-type") ?? "application/json" } });
}

export { forward as POST, forward as DELETE };
