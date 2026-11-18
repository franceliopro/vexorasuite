type Context = { params: Promise<{ channelId: string }> };

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request, context: Context) {
  const { channelId } = await context.params;
  const apiOrigin = (process.env.API_INTERNAL_URL || "http://api:3001").replace(/\/$/, "");
  const search = new URL(request.url).search; // preserva hub.mode, hub.verify_token e hub.challenge
  try {
    const upstream = await fetch(`${apiOrigin}/api/webhooks/meta/${encodeURIComponent(channelId)}${search}`, {
      method: "GET",
      cache: "no-store",
      signal: AbortSignal.timeout(15000),
    });
    const body = await upstream.text();
    return new Response(body, {
      status: upstream.status,
      headers: {
        "content-type": upstream.headers.get("content-type") || "text/plain; charset=utf-8",
        "cache-control": "no-store",
      },
    });
  } catch {
    return Response.json({ error: "api_unavailable", message: "A API da Véxora está indisponível no momento." }, { status: 502 });
  }
}

export async function POST(request: Request, context: Context) {
  const { channelId } = await context.params;
  const apiOrigin = (process.env.API_INTERNAL_URL || "http://api:3001").replace(/\/$/, "");
  const contentType = request.headers.get("content-type");
  const headers = new Headers();
  if (contentType) headers.set("content-type", contentType);
  const signature = request.headers.get("x-hub-signature-256");
  if (signature) headers.set("x-hub-signature-256", signature);
  try {
    const upstream = await fetch(`${apiOrigin}/api/webhooks/meta/${encodeURIComponent(channelId)}`, {
      method: "POST",
      headers,
      body: await request.arrayBuffer(),
      cache: "no-store",
      signal: AbortSignal.timeout(25000),
    });
    const responseHeaders = new Headers();
    const upstreamType = upstream.headers.get("content-type");
    if (upstreamType) responseHeaders.set("content-type", upstreamType);
    responseHeaders.set("cache-control", "no-store");
    return new Response(upstream.body, { status: upstream.status, headers: responseHeaders });
  } catch {
    return Response.json({ error: "api_unavailable", message: "A API da Véxora está indisponível no momento." }, { status: 502 });
  }
}
