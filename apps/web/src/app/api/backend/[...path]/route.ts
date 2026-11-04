import { limitedRequestBody, RequestBodyTooLarge, trustedRequestOrigin } from "../../../../lib/backend-request";
import { LEGACY_REFRESH_COOKIE, LEGACY_SESSION_COOKIE, REFRESH_COOKIE, SESSION_COOKIE, sessionCookies, shouldRefresh } from "../../../../lib/session-cookies";
import { cookies } from "next/headers";
import { applyResponseRequestId, getProxyRequestId, getResponseRequestId } from "../../../../lib/proxy-request-id";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type Context = { params: Promise<{ path: string[] }> };

// Share one refresh rotation between concurrent requests in this web process. Without this,
// parallel 401s reuse the same refresh token and trigger family-wide reuse revocation.
const refreshInFlight = new Map<string, Promise<Record<string, unknown> | null>>();

async function proxyRequest(request: Request, context: Context) {
  const params = await context.params;
  const pathValue = (params.path || []).map((part) => encodeURIComponent(part)).join("/");
  const requestId = getProxyRequestId(request);
  const cookieStore = await cookies();
  const apiOrigin = (process.env.API_INTERNAL_URL || "http://api:3001").replace(/\/$/, "");
  const secureCookie = process.env.NODE_ENV === "production";
  const readCookie = (primary: string, legacy: string) => cookieStore.get(primary)?.value ?? cookieStore.get(legacy)?.value;
  const refreshToken = readCookie(REFRESH_COOKIE, LEGACY_REFRESH_COOKIE);

  const applyCookies = (payload: Record<string, unknown>) => {
    const { cookies: jar, rest } = sessionCookies(payload, { secure: secureCookie });
    for (const cookie of jar) cookieStore.set(cookie.name, cookie.value, cookie.options);
    if (secureCookie) {
      cookieStore.delete(LEGACY_SESSION_COOKIE);
      cookieStore.delete(LEGACY_REFRESH_COOKIE);
    }
    return rest;
  };

  /** Exchanges the refresh cookie. Returns the new access token, or null when the session is over. */
  const renewSession = async (): Promise<string | null> => {
    if (!refreshToken) return null;
    const existing = refreshInFlight.get(refreshToken);
    const task = existing ?? (async () => {
      try {
        const response = await fetch(apiOrigin + "/api/auth/refresh", {
          method: "POST",
          headers: { "content-type": "application/json", "x-request-id": requestId },
          body: JSON.stringify({ refreshToken }),
          cache: "no-store",
          signal: AbortSignal.timeout(15000),
        });
        if (!response.ok) return null;
        return (await response.json()) as Record<string, unknown>;
      } catch {
        return null;
      }
    })();
    if (!existing) refreshInFlight.set(refreshToken, task);
    try {
      const payload = await task;
      if (!payload) return null;
      const applied = applyCookies(payload);
      return typeof applied.accessToken === "string" ? applied.accessToken : null;
    } finally {
      if (!existing && refreshInFlight.get(refreshToken) === task) refreshInFlight.delete(refreshToken);
    }
  };

  if (pathValue === "auth/logout" && request.method === "POST") {
    // The refresh token is the durable credential: revoking it server-side is what actually ends
    // the session. Dropping the cookies alone would leave it usable until the TTL.
    if (refreshToken) {
      await fetch(apiOrigin + "/api/auth/logout", {
        method: "POST",
        headers: { "content-type": "application/json", "x-request-id": requestId },
        body: JSON.stringify({ refreshToken }),
        cache: "no-store",
        signal: AbortSignal.timeout(8000),
      }).catch(() => undefined);
    }
    cookieStore.delete(SESSION_COOKIE);
    cookieStore.delete(REFRESH_COOKIE);
    cookieStore.delete(LEGACY_SESSION_COOKIE);
    cookieStore.delete(LEGACY_REFRESH_COOKIE);
    return applyResponseRequestId(Response.json({ ok: true }), requestId);
  }

  const requestUrl = new URL(request.url);
  const headers = new Headers();
  const contentType = request.headers.get("content-type");
  const accept = request.headers.get("accept");
  if (contentType) headers.set("content-type", contentType);
  if (accept) headers.set("accept", accept);
  headers.set("x-request-id", requestId);

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
    upstream = await send(readCookie(SESSION_COOKIE, LEGACY_SESSION_COOKIE));
  } catch (error) {
    if (error instanceof RequestBodyTooLarge) return applyResponseRequestId(Response.json({ message: "Arquivo acima do limite de upload." }, { status: 413 }), requestId);
    return applyResponseRequestId(Response.json({ error: "api_unavailable", message: "A API da Véxora está indisponível no momento." }, { status: 502 }), requestId);
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
    if (typeof payload.accessToken !== "string") return applyResponseRequestId(Response.json({ error: "invalid_auth_response" }, { status: 502 }), requestId);
    // Both tokens become httpOnly cookies; the browser receives only the rest of the session.
    const rest = applyCookies(payload);
    return applyResponseRequestId(Response.json(rest, { status: upstream.status }), getResponseRequestId(upstream.headers, requestId));
  }
  // A 401 after the refresh attempt means the session is really over: drop both cookies so the
  // client does not keep retrying with a dead pair.
  if (pathValue === "auth/me" && upstream.status === 401) {
    cookieStore.delete(SESSION_COOKIE);
    cookieStore.delete(REFRESH_COOKIE);
    cookieStore.delete(LEGACY_SESSION_COOKIE);
    cookieStore.delete(LEGACY_REFRESH_COOKIE);
  }

  const responseHeaders = new Headers();
  const disposition = upstream.headers.get("content-disposition");
  if (disposition) responseHeaders.set("content-disposition", disposition);
  for(const name of ["content-security-policy","referrer-policy","x-ratelimit-limit","x-ratelimit-remaining","retry-after"]){const header=upstream.headers.get(name);if(header)responseHeaders.set(name,header);}
  const upstreamType = upstream.headers.get("content-type");
  if (upstreamType) responseHeaders.set("content-type", upstreamType);
  responseHeaders.set("x-request-id", getResponseRequestId(upstream.headers, requestId));
  if (isSse) {
    responseHeaders.set("cache-control", "no-cache, no-transform");
    responseHeaders.set("connection", "keep-alive");
    responseHeaders.set("x-accel-buffering", "no");
  } else {
    const cacheControl = upstream.headers.get("cache-control");
    if (cacheControl) responseHeaders.set("cache-control", cacheControl);
  }
  return applyResponseRequestId(new Response(upstream.body, { status: upstream.status, headers: responseHeaders }), getResponseRequestId(upstream.headers, requestId));
}

export const GET = proxyRequest;
export const POST = proxyRequest;
export const PUT = proxyRequest;
export const PATCH = proxyRequest;
export const DELETE = proxyRequest;

