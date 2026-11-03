import type { Redis } from "ioredis";

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
}

export interface RateLimitStore {
  readonly kind: "memory" | "redis";
  consume(key: string, limit: number, windowMs: number): Promise<RateLimitResult>;
}

/**
 * Per-process fixed window counter.
 *
 * Used in development, in tests and as the fallback when Redis is configured but unreachable.
 * It is only correct for a single process: two replicas keep two independent counters.
 */
export class MemoryRateLimitStore implements RateLimitStore {
  readonly kind = "memory" as const;
  private readonly buckets = new Map<string, { count: number; resetAt: number }>();

  constructor(private readonly now: () => number = () => Date.now()) {}

  async consume(key: string, limit: number, windowMs: number): Promise<RateLimitResult> {
    const current = this.now();
    const bucket = this.buckets.get(key);
    if (!bucket || bucket.resetAt <= current) {
      const resetAt = current + windowMs;
      this.buckets.set(key, { count: 1, resetAt });
      this.prune(current);
      return { allowed: true, remaining: Math.max(0, limit - 1), resetAt };
    }
    bucket.count += 1;
    return {
      allowed: bucket.count <= limit,
      remaining: Math.max(0, limit - bucket.count),
      resetAt: bucket.resetAt,
    };
  }

  /** Keeps the map bounded when many distinct clients hit the process. */
  private prune(current: number): void {
    if (this.buckets.size < 5000) return;
    for (const [key, bucket] of this.buckets) {
      if (bucket.resetAt <= current) this.buckets.delete(key);
    }
  }
}

/** Shared counter for every replica, so the limit is global and not per container. */
export class RedisRateLimitStore implements RateLimitStore {
  readonly kind = "redis" as const;

  constructor(private readonly client: Redis) {}

  async consume(key: string, limit: number, windowMs: number): Promise<RateLimitResult> {
    const redisKey = `ratelimit:${key}`;
    const pipeline = this.client.multi();
    pipeline.incr(redisKey);
    // NX keeps the window that the first hit created instead of extending it on every request.
    pipeline.pexpire(redisKey, windowMs, "NX");
    pipeline.pttl(redisKey);
    const result = await pipeline.exec();
    const count = Number(result?.[0]?.[1] ?? 1);
    const ttl = Number(result?.[2]?.[1] ?? windowMs);
    const resetAt = Date.now() + Math.max(0, ttl);
    return { allowed: count <= limit, remaining: Math.max(0, limit - count), resetAt };
  }
}
