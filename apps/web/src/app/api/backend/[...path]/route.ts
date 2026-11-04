import { limitedRequestBody, RequestBodyTooLarge, trustedRequestOrigin } from "../../../../lib/backend-request";
import { REFRESH_COOKIE, SESSION_COOKIE, sessionCookies, shouldRefresh } from "../../../../lib/session-cookies";
import { cookies } from "next/headers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type Context = { params: Promise<{ path: string[] }> };

async function proxyRequest(request: Request, context: Context) {
  const params = await context.params;
  const pathValue = (params.path || []).map((part) => encodeURIComponent(part)).join("/");
  const cookieStore = await cookies();
  const apiOrigin = (process.env.API_INTERNAL_URL || "http://api:3001").replace(/\/$/, "");
  const refreshToken = cookieStore.get(REFRESH_COOKIE)?.value;
  const secureCookie = process.env.NODE_ENV === "production";

  const applyCookies = (payload: Record<string, unknown>) => {
    const { cookies: jar, rest } = sessionCookies(payload, { secure: secureCookie });
    for (const cookie of jar) cookieStore.set(cookie.name, cookie.value, cookie.options);
    return rest;
  };

  /** Exchanges the refresh cookie. Returns the new access token, or null when the session is over. */
  const renewSession = async (): Promise<string | null> => {
    if (!refreshToken) return null;
    try {
      const response = await fetch(apiOrigin + "/api/auth/refresh", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ refreshToken }),
        cache: "no-store",
        signal: AbortSignal.timeout(15000),
      });
      if (!response.ok) return null;
      const payload = applyCookies((await response.json()) as Record<string, unknown>);
      return typeof payload.accessToken === "string" ? payload.accessToken : null;
    } catch {
      return null;
    }
  };

  if (pathValue === "auth/logout" && request.method === "POST") {
    // The refresh token is the durable credential: revoking it server-side is what actually ends
    // the session. Dropping the cookies alone would leave it usable until the TTL.
    if (refreshToken) {
      await fetch(apiOrigin + "/api/auth/logout", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ refreshToken }),
        cache: "no-store",
        signal: AbortSignal.timeout(8000),
      }).catch(() => undefined);
    }
    cookieStore.delete(SESSION_COOKIE);
    cookieStore.delete(REFRESH_COOKIE);
    return Response.json({ ok: true });
  }

  const requestUrl = new URL(request.url);
  const headers = new Headers();
  const contentType = request.headers.get("content-type");
  const accept = request.headers.get("accept");
  if (contentType) headers.set("content-type", contentType);
  if (accept) headers.set("accept", accept);

  const isSse = pathValue === "events";
  const hasBody = !["GET", "HEAD"].includes(request.method);
  if (hasBody && !trustedRequestOrigin(request, process.env.NEXT_PUBLIC_APP_URL)) return Response.json({ message: "Origem da solicitação não autorizada." }, { status: 403 });

  let bodyBuffer: ArrayBuffer | undefined;
  const timeoutFor = () => {
    const isAiGeneration = pathValue==='assistant/ask'||pathValue==='assistant/engine/create-flow'||pathValue==='marketing/drafts'||/^assistant\/agents\/[^/]+\/test$/.test(pathValue);
    return isAiGeneration?200000:pathValue==='department-resources'?180000:pathValue.startsWith('mail/accounts/')&&pathValue.endsWith('/sync')?120000:pathValue==='marketing/prepared/upload'?180000:pathValue.startsWith('assistant/voice/')?70000:30000;
  };

  const send = (token?: string) => {
    const upstreamHeaders = new Headers(headers);
    if (token) upstreamHeaders.set("authorization", "Bearer " + token);
    const init: RequestInit = {
      method: request.method,
      headers: upstreamHeaders,
      ...(bodyBuffer ? { body: bodyBuffer } : {}),
      cache: "no-store",
    };
    if (!isSse) init.signal = AbortSignal.timeout(timeoutFor());
    return fetch(apiOrigin + "/api/" + pathValue + requestUrl.search, init);
  };

  let upstream: Response;
  try {
    if (hasBody) bodyBuffer = await limitedRequestBody(request);
    upstream = await send(cookieStore.get(SESSION_COOKIE)?.value);
  } catch (error) {
    if (error instanceof RequestBodyTooLarge) return Response.json({ message: "Arquivo acima do limite de upload." }, { status: 413 });
    return Response.json({ error: "api_unavailable", message: "A API da Véxora está indisponível no momento." }, { status: 502 });
  }

  // Short access token, long session: the first 401 of an expired token is renewed here, so the
  // user never sees a session end just because the API token aged out.
  if (shouldRefresh({ status: upstream.status, path: pathValue, hasRefreshToken: Boolean(refreshToken), alreadyRetried: false })) {
    const renewed = await renewSession();
    if (renewed) {
      try {
        upstream = await send(renewed);
      } catch {
        return Response.json({ error: "api_unavailable", message: "A API da Véxora está indisponível no momento." }, { status: 502 });
      }
    }
  }

  const isAuth = request.method === "POST" && (["auth/login","auth/register","auth/companies","auth/switch","auth/refresh","auth/change-password"].includes(pathValue));
  if (isAuth && upstream.ok) {
    const payload = await upstream.json() as Record<string, unknown>;
    if (typeof payload.accessToken !== "string") return Response.json({ error: "invalid_auth_response" }, { status: 502 });
    // Both tokens become httpOnly cookies; the browser receives only the rest of the session.
    const rest = applyCookies(payload);
    return Response.json(rest, { status: upstream.status });
  }
  // A 401 after the refresh attempt means the session is really over: drop both cookies so the
  // client does not keep retrying with a dead pair.
  if (pathValue === "auth/me" && upstream.status === 401) {
    cookieStore.delete(SESSION_COOKIE);
    cookieStore.delete(REFRESH_COOKIE);
  }

  const responseHeaders = new Headers();
  const disposition = upstream.headers.get("content-disposition");
  if (disposition) responseHeaders.set("content-disposition", disposition);
  for(const name of ["content-security-policy","referrer-policy","x-ratelimit-limit","x-ratelimit-remaining","retry-after"]){const header=upstream.headers.get(name);if(header)responseHeaders.set(name,header);}
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

