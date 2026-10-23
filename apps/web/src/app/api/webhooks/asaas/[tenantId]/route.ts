type Context = { params: Promise<{ tenantId: string }> };

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request, context: Context) {
  const { tenantId } = await context.params;
  const apiOrigin = (process.env.API_INTERNAL_URL || "http://api:3001").replace(/\/$/, "");
  const contentType = request.headers.get("content-type");
  const token = request.headers.get("asaas-access-token");
  const headers = new Headers();
  if (contentType) headers.set("content-type", contentType);
  if (token) headers.set("asaas-access-token", token);
  try {
    const upstream = await fetch(
      `${apiOrigin}/api/webhooks/asaas/${encodeURIComponent(tenantId)}`,
      {
        method: "POST",
        headers,
        body: await request.arrayBuffer(),
        cache: "no-store",
        signal: AbortSignal.timeout(25000),
      },
    );
    const responseHeaders = new Headers();
    const upstreamType = upstream.headers.get("content-type");
    if (upstreamType) responseHeaders.set("content-type", upstreamType);
    responseHeaders.set("cache-control", "no-store");
    return new Response(upstream.body, { status: upstream.status, headers: responseHeaders });
  } catch {
    return Response.json(
      { error: "api_unavailable", message: "A API da Véxora está indisponível no momento." },
      { status: 502 },
    );
  }
}
