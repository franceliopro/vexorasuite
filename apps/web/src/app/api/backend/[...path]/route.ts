import { limitedRequestBody, RequestBodyTooLarge, trustedRequestOrigin } from "../../../../lib/backend-request";
import { cookies } from "next/headers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type Context = { params: Promise<{ path: string[] }> };
const COOKIE_NAME = "vexora_session";

async function proxyRequest(request: Request, context: Context) {
  const params = await context.params;
  const pathValue = (params.path || []).map((part) => encodeURIComponent(part)).join("/");
  const cookieStore = await cookies();
  if (pathValue === "auth/logout" && request.method === "POST") {
    cookieStore.delete(COOKIE_NAME);
    return Response.json({ ok: true });
  }

  const apiOrigin = (process.env.API_INTERNAL_URL || "http://api:3001").replace(/\/$/, "");
  const requestUrl = new URL(request.url);
  const headers = new Headers();
  const contentType = request.headers.get("content-type");
  const accept = request.headers.get("accept");
  if (contentType) headers.set("content-type", contentType);
  if (accept) headers.set("accept", accept);
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (token) headers.set("authorization", "Bearer " + token);

  const isSse = pathValue === "events";
  const hasBody = !["GET", "HEAD"].includes(request.method);
  if (hasBody && !trustedRequestOrigin(request, process.env.NEXT_PUBLIC_APP_URL)) return Response.json({ message: "Origem da solicitação não autorizada." }, { status: 403 });

  let upstream: Response;
  try {
    const init: RequestInit = {
      method: request.method,
      headers,
      ...(hasBody ? { body: await limitedRequestBody(request) } : {}),
      cache: "no-store",
    };
    if (!isSse) init.signal = AbortSignal.timeout(pathValue==='department-resources'?180000:pathValue.startsWith('mail/accounts/')&&pathValue.endsWith('/sync')?120000:pathValue==='marketing/prepared/upload'?180000:pathValue.startsWith('assistant/voice/')?70000:30000);
    upstream = await fetch(apiOrigin + "/api/" + pathValue + requestUrl.search, init);
  } catch (error) {
    if (error instanceof RequestBodyTooLarge) return Response.json({ message: "Arquivo acima do limite de upload." }, { status: 413 });
    return Response.json({ error: "api_unavailable", message: "A API da Véxora está indisponível no momento." }, { status: 502 });
  }

  const isAuth = request.method === "POST" && (["auth/login","auth/register","auth/companies","auth/switch"].includes(pathValue));
  if (isAuth && upstream.ok) {
    const payload = await upstream.json() as Record<string, unknown>;
    const accessToken = payload.accessToken;
    if (typeof accessToken !== "string") return Response.json({ error: "invalid_auth_response" }, { status: 502 });
    cookieStore.set(COOKIE_NAME, accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: typeof payload.expiresIn === "number" ? payload.expiresIn : 28800,
    });
    delete payload.accessToken;
    return Response.json(payload, { status: upstream.status });
  }
  if (pathValue === "auth/me" && upstream.status === 401) cookieStore.delete(COOKIE_NAME);

  const responseHeaders = new Headers();
  const disposition = upstream.headers.get("content-disposition");
  if (disposition) responseHeaders.set("content-disposition", disposition);
  for(const name of ["content-security-policy","referrer-policy"]){const header=upstream.headers.get(name);if(header)responseHeaders.set(name,header);}
  const upstreamType = upstream.headers.get("content-type");
  if (upstreamType) responseHeaders.set("content-type", upstreamType);
  if (isSse) {
    responseHeaders.set("cache-control", "no-cache, no-transform");
    responseHeaders.set("connection", "keep-alive");
    responseHeaders.set("x-accel-buffering", "no");
  } else {
    const cacheControl = upstream.headers.get("cache-control");
    if (cacheControl) responseHeaders.set("cache-control", cacheControl);
  }
  return new Response(upstream.body, { status: upstream.status, headers: responseHeaders });
}

export const GET = proxyRequest;
export const POST = proxyRequest;
export const PUT = proxyRequest;
export const PATCH = proxyRequest;
export const DELETE = proxyRequest;

