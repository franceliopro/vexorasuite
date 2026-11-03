/**
 * Session cookies and the refresh decision, kept out of the route handler so they can be tested.
 *
 * The access token lives in a short-lived httpOnly cookie; the refresh token lives in another one.
 * The browser never reads either — the proxy attaches the access token and, when the API answers
 * 401 with a valid refresh cookie, exchanges it and repeats the request once.
 */

export const SESSION_COOKIE = "vexora_session";
export const REFRESH_COOKIE = "vexora_refresh";

/** Fallbacks mirror the API defaults, so a missing field cannot create a decade-long cookie. */
export const DEFAULT_ACCESS_MAX_AGE = 1800;
export const DEFAULT_REFRESH_MAX_AGE = 30 * 24 * 60 * 60;

/** Routes where a 401 is the answer, not a stale token: never worth a refresh round trip. */
const NO_REFRESH_PATHS = ["auth/refresh", "auth/login", "auth/register", "auth/logout", "auth/password/forgot", "auth/password/reset"];

export interface TokenCookie {
  name: string;
  value: string;
  options: {
    httpOnly: true;
    secure: boolean;
    sameSite: "lax";
    path: string;
    maxAge: number;
  };
}

export function sessionCookies(
  payload: Record<string, unknown>,
  options: { secure: boolean },
): { cookies: TokenCookie[]; rest: Record<string, unknown> } {
  const cookies: TokenCookie[] = [];
  const base = { httpOnly: true as const, secure: options.secure, sameSite: "lax" as const, path: "/" };

  if (typeof payload.accessToken === "string" && payload.accessToken) {
    const maxAge = typeof payload.expiresIn === "number" && payload.expiresIn > 0 ? payload.expiresIn : DEFAULT_ACCESS_MAX_AGE;
    cookies.push({ name: SESSION_COOKIE, value: payload.accessToken, options: { ...base, maxAge } });
  }
  if (typeof payload.refreshToken === "string" && payload.refreshToken) {
    const maxAge =
      typeof payload.refreshExpiresIn === "number" && payload.refreshExpiresIn > 0
        ? payload.refreshExpiresIn
        : DEFAULT_REFRESH_MAX_AGE;
    cookies.push({ name: REFRESH_COOKIE, value: payload.refreshToken, options: { ...base, maxAge } });
  }

  // The tokens must not also reach the browser as JSON.
  const rest = { ...payload };
  delete rest.accessToken;
  delete rest.refreshToken;
  delete rest.refreshExpiresIn;
  return { cookies, rest };
}

export function shouldRefresh(input: {
  status: number;
  path: string;
  hasRefreshToken: boolean;
  alreadyRetried: boolean;
}): boolean {
  if (input.alreadyRetried) return false;
  if (input.status !== 401) return false;
  if (!input.hasRefreshToken) return false;
  return !NO_REFRESH_PATHS.includes(input.path);
}
