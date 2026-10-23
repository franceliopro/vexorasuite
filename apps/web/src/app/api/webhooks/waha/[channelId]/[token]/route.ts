export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request, context: { params: Promise<{ channelId: string; token: string }> }) {
  const { channelId, token } = await context.params;
  const apiOrigin = (process.env.API_INTERNAL_URL || "http://api:3001").replace(/\/$/, "");
  let upstream: Response;
  try {
    upstream = await fetch(`${apiOrigin}/api/webhooks/waha/${encodeURIComponent(channelId)}/${encodeURIComponent(token)}`, {
      method: "POST",
      headers: { "content-type": request.headers.get("content-type") || "application/json" },
      body: await request.arrayBuffer(),
      cache: "no-store",
      signal: AbortSignal.timeout(12000),
    });
  } catch {
    return Response.json({ error: "webhook_upstream_unavailable" }, { status: 502 });
  }
  return new Response(await upstream.arrayBuffer(), {
    status: upstream.status,
    headers: { "content-type": upstream.headers.get("content-type") || "application/json" },
  });
}
