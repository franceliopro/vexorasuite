type Context = { params: Promise<{ tenantId: string }> };

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** A InfinitePay não assina o webhook; a validação ocorre no payment_check da API. */
export async function POST(request: Request, context: Context) {
  const { tenantId } = await context.params;
  const apiOrigin = (process.env.API_INTERNAL_URL || "http://api:3001").replace(/\/$/, "");
  const contentType = request.headers.get("content-type");
  const headers = new Headers();
  if (contentType) headers.set("content-type", contentType);
  try {
    const upstream = await fetch(
      `${apiOrigin}/api/webhooks/infinitepay/${encodeURIComponent(tenantId)}`,
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
    return new Response(await upstream.text(), { status: upstream.status, headers: responseHeaders });
  } catch {
    return Response.json({ ok: false, reason: "Webhook não pôde ser encaminhado." }, { status: 502 });
  }
}
