/** One bucket per class of request, so a busy workspace does not starve a login attempt. */
export interface RateLimitPolicy {
  name: string;
  limit: number;
  windowMs: number;
}

export const RATE_LIMIT_WINDOW_MS = 60_000;

const int = (value: string | undefined, fallback: number): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
};

/**
 * Credential endpoints are the cheapest place to guess passwords, so they get the tightest
 * limit and are counted by client IP (there is no user yet). Everything else is counted by
 * authenticated user and only falls back to IP for anonymous calls.
 */
export function policyFor(method: string, path: string, contentType = ""): RateLimitPolicy {
  const windowMs = RATE_LIMIT_WINDOW_MS;
  const normalised = path.replace(/^\/api(?=\/)/, "");
  if (/^\/auth\/(login|register|change-password)$/.test(normalised)) {
    return { name: "auth", limit: int(process.env.RATE_LIMIT_AUTH_PER_MIN, 10), windowMs };
  }
  if (normalised.startsWith("/auth/")) {
    return { name: "auth-aux", limit: int(process.env.RATE_LIMIT_AUTH_AUX_PER_MIN, 60), windowMs };
  }
  // Uploads are expensive and already bounded per request, so they get their own bucket.
  if (contentType.toLowerCase().startsWith("multipart/form-data")) {
    return { name: "upload", limit: int(process.env.RATE_LIMIT_UPLOAD_PER_MIN, 60), windowMs };
  }
  const verb = method.toUpperCase();
  if (verb === "GET" || verb === "HEAD" || verb === "OPTIONS") {
    return { name: "read", limit: int(process.env.RATE_LIMIT_READ_PER_MIN, 900), windowMs };
  }
  return { name: "write", limit: int(process.env.RATE_LIMIT_WRITE_PER_MIN, 240), windowMs };
}
