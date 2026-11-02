import { HttpException, HttpStatus, Injectable, Inject } from "@nestjs/common";

interface Bucket {
  count: number;
  resetAt: number;
}

export const AUTH_MAX_ATTEMPTS = "AUTH_MAX_ATTEMPTS";
export const AUTH_WINDOW_MINUTES = "AUTH_WINDOW_MINUTES";
export const AUTH_NOW = "AUTH_NOW";

/**
 * Brute-force protection for credential endpoints.
 *
 * It keeps a small in-memory bucket per key (tenant + e-mail). This is enough for the
 * current single-replica deployment; when the API runs on more than one replica the
 * storage must move to Redis so every instance shares the same counter.
 */
@Injectable()
export class AuthThrottle {
  private readonly buckets = new Map<string, Bucket>();

  constructor(
    @Inject(AUTH_MAX_ATTEMPTS) private readonly maxAttempts: number = 10,
    @Inject(AUTH_WINDOW_MINUTES) private readonly windowMs: number = 15 * 60_000,
    @Inject(AUTH_NOW) private readonly now: () => number = () => Date.now(),
  ) {}

  /** Throws when the key already exhausted its attempts inside the current window. */
  assertAllowed(key: string): void {
    const bucket = this.buckets.get(key);
    const current = this.now();
    if (!bucket || bucket.resetAt <= current) {
      this.buckets.delete(key);
      return;
    }
    if (bucket.count >= this.maxAttempts) {
      const minutes = Math.max(1, Math.ceil((bucket.resetAt - current) / 60_000));
      throw new HttpException(
        Muitas tentativas. Tente novamente em  minuto(s).,
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }

  recordFailure(key: string): void {
    const current = this.now();
    const bucket = this.buckets.get(key);
    if (!bucket || bucket.resetAt <= current) {
      this.buckets.set(key, { count: 1, resetAt: current + this.windowMs });
    } else {
      bucket.count += 1;
    }
    this.prune(current);
  }

  clear(key: string): void {
    this.buckets.delete(key);
  }

  private prune(current: number): void {
    if (this.buckets.size < 500) return;
    for (const [key, bucket] of this.buckets) {
      if (bucket.resetAt <= current) this.buckets.delete(key);
    }
  }
}
