import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  DEFAULT_ACCESS_MAX_AGE,
  DEFAULT_REFRESH_MAX_AGE,
  REFRESH_COOKIE,
  SESSION_COOKIE,
  sessionCookies,
  shouldRefresh,
} from "../src/lib/session-cookies.ts";

test("both tokens become httpOnly cookies and never reach the response body", () => {
  const { cookies, rest } = sessionCookies(
    { accessToken: "acesso", refreshToken: "renovacao", expiresIn: 1800, refreshExpiresIn: 2592000, role: "AGENT" },
    { secure: true },
  );
  assert.equal(cookies.length, 2);
  const [access, refresh] = cookies;
  assert.equal(access.name, SESSION_COOKIE);
  assert.equal(access.value, "acesso");
  assert.equal(access.options.maxAge, 1800);
  assert.equal(refresh.name, REFRESH_COOKIE);
  assert.equal(refresh.options.maxAge, 2592000);
  for (const cookie of cookies) {
    assert.equal(cookie.options.httpOnly, true);
    assert.equal(cookie.options.sameSite, "lax");
    assert.equal(cookie.options.path, "/");
    assert.equal(cookie.options.secure, true);
  }
  // The rest of the session payload still reaches the client.
  assert.equal(rest.accessToken, undefined);
  assert.equal(rest.refreshToken, undefined);
  assert.equal(rest.refreshExpiresIn, undefined);
  assert.equal(rest.role, "AGENT");
});

test("never falls back to a decade-long cookie when a lifetime is missing", () => {
  const { cookies } = sessionCookies({ accessToken: "a", refreshToken: "b" }, { secure: false });
  assert.equal(cookies[0].options.maxAge, DEFAULT_ACCESS_MAX_AGE);
  assert.equal(cookies[1].options.maxAge, DEFAULT_REFRESH_MAX_AGE);
  assert.equal(cookies[0].options.secure, false);
});

test("a payload without tokens sets nothing instead of an empty cookie", () => {
  const { cookies, rest } = sessionCookies({ role: "OWNER" }, { secure: true });
  assert.equal(cookies.length, 0);
  assert.equal(rest.role, "OWNER");
});

test("refreshes exactly once, and only when it can help", () => {
  const base = { status: 401, path: "conversations", hasRefreshToken: true, alreadyRetried: false };
  assert.equal(shouldRefresh(base), true);
  assert.equal(shouldRefresh({ ...base, status: 200 }), false);
  assert.equal(shouldRefresh({ ...base, hasRefreshToken: false }), false, "no refresh cookie means nothing to exchange");
  assert.equal(shouldRefresh({ ...base, alreadyRetried: true }), false, "a second attempt would loop");
  for (const path of ["auth/refresh", "auth/login", "auth/register", "auth/logout", "auth/password/reset"]) {
    assert.equal(shouldRefresh({ ...base, path }), false, `${path} must not trigger a refresh`);
  }
});

test("the proxy revokes the session on logout instead of only dropping the cookie", () => {
  const source = readFileSync(new URL("../src/app/api/backend/[...path]/route.ts", import.meta.url), "utf8");
  assert.match(source, /apiOrigin \+ "\/api\/auth\/logout"/);
  assert.match(source, /cookieStore\.delete\(REFRESH_COOKIE\)/);
  assert.match(source, /shouldRefresh\(/);
  assert.doesNotMatch(source, /maxAge: typeof payload\.expiresIn === "number" \? payload\.expiresIn : 28800/);
});
