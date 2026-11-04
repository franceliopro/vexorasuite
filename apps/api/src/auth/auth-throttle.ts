import { HttpException, HttpStatus, Injectable, Logger, OnModuleDestroy } from "@nestjs/common";

interface Bucket {
  count: number;
  resetAt: number;
}

interface RedisClient {
  get(key: string): Promise<string | null>;
  incr(key: string): Promise<number>;
  pttl(key: string): Promise<number>;
  pexpire(key: string, milliseconds: number): Promise<unknown>;
  del(key: string): Promise<unknown>;
  disconnect?: () => void;
  quit?: () => Promise<unknown>;
}

export const AUTH_MAX_ATTEMPTS = "AUTH_MAX_ATTEMPTS";
export const AUTH_WINDOW_MINUTES = "AUTH_WINDOW_MINUTES";
export const AUTH_NOW = "AUTH_NOW";

/**
 * Brute-force protection for credential endpoints.
 *
 * Redis is the shared source of truth when REDIS_URL is available, so every API replica
 * observes the same bucket. A bounded in-memory fallback keeps the endpoint available when
 * Redis is temporarily unavailable; the global request limiter applies the same fallback.
 */
@Injectable()
export class AuthThrottle implements OnModuleDestroy {
  private readonly logger = new Logger(AuthThrottle.name);
  private readonly buckets = new Map<string, Bucket>();
  private redis?: RedisClient;
  private connecting?: Promise<RedisClient | undefined>;
  private warned = false;

  constructor(
    private readonly maxAttempts: number = Number(process.env.AUTH_MAX_ATTEMPTS ?? 10),
    private readonly windowMs: number = Number(process.env.AUTH_WINDOW_MINUTES ?? 15) * 60_000,
    private readonly now: () => number = () => Date.now(),
  ) {}

  async assertAllowed(key: string): Promise<void> {
    const redis = await this.store();
    if (redis) {
      try {
        const redisKey = this.redisKey(key);
        const [count, ttl] = await Promise.all([redis.get(redisKey), redis.pttl(redisKey)]);
        if (ttl <= 0) {
          if (count !== null) await redis.del(redisKey);
          return;
        }
        if (Number(count ?? 0) >= this.maxAttempts) {
          const minutes = Math.max(1, Math.ceil(ttl / 60_000));
          throw new HttpException(
            "Muitas tentativas. Tente novamente em " + minutes + " minuto(s).",
            HttpStatus.TOO_MANY_REQUESTS,
          );
        }
        return;
      } catch (error) {
        if (error instanceof HttpException) throw error;
        this.disableRedis(error);
      }
    }

    this.assertMemoryAllowed(key);
  }

  async recordFailure(key: string): Promise<void> {
    const redis = await this.store();
    if (redis) {
      try {
        const redisKey = this.redisKey(key);
        const count = await redis.incr(redisKey);
        if (count === 1) await redis.pexpire(redisKey, this.windowMs);
        return;
      } catch (error) {
        this.disableRedis(error);
      }
    }

    this.recordMemoryFailure(key);
  }

  async clear(key: string): Promise<void> {
    this.buckets.delete(key);
    const redis = await this.store();
    if (!redis) return;
    try {
      await redis.del(this.redisKey(key));
    } catch (error) {
      this.disableRedis(error);
    }
  }

  async onModuleDestroy(): Promise<void> {
    const redis = this.redis;
    this.redis = undefined;
    if (redis?.quit) {
      await redis.quit().catch(() => redis.disconnect?.());
    } else {
      redis?.disconnect?.();
    }
  }

  private async store(): Promise<RedisClient | undefined> {
    if (process.env.NODE_ENV === "test" || !process.env.REDIS_URL) return undefined;
    if (this.redis) return this.redis;
    this.connecting ??= this.connect();
    return this.connecting;
  }

  private async connect(): Promise<RedisClient | undefined> {
    try {
      const { default: Redis } = await import("ioredis");
      const client = new Redis(process.env.REDIS_URL, {
        lazyConnect: false,
        maxRetriesPerRequest: 1,
        enableOfflineQueue: false,
        connectTimeout: 2_000,
      }) as unknown as RedisClient;
      await client.get(this.redisKey("healthcheck"));
      this.redis = client;
      this.logger.log("Proteção de autenticação usando contador compartilhado no Redis.");
      return client;
    } catch (error) {
      this.logger.warn(
        "Redis indisponível para proteção de autenticação; usando contador local: " +
          (error instanceof Error ? error.message : String(error)),
      );
      return undefined;
    }
  }

  private redisKey(key: string): string {
    return "auth-throttle:" + key;
  }

  private assertMemoryAllowed(key: string): void {
    const bucket = this.buckets.get(key);
    const current = this.now();
    if (!bucket || bucket.resetAt <= current) {
      this.buckets.delete(key);
      return;
    }
    if (bucket.count >= this.maxAttempts) {
      const minutes = Math.max(1, Math.ceil((bucket.resetAt - current) / 60_000));
      throw new HttpException(
        "Muitas tentativas. Tente novamente em " + minutes + " minuto(s).",
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }

  private recordMemoryFailure(key: string): void {
    const current = this.now();
    const bucket = this.buckets.get(key);
    if (!bucket || bucket.resetAt <= current) {
      this.buckets.set(key, { count: 1, resetAt: current + this.windowMs });
    } else {
      bucket.count += 1;
    }
    this.prune(current);
  }

  private disableRedis(error: unknown): void {
    if (!this.warned) {
      this.warned = true;
      this.logger.warn(
        "Redis indisponível durante a proteção de autenticação; usando contador local: " +
          (error instanceof Error ? error.message : String(error)),
      );
    }
    this.redis?.disconnect?.();
    this.redis = undefined;
  }

  private prune(current: number): void {
    if (this.buckets.size < 500) return;
    for (const [key, bucket] of this.buckets) {
      if (bucket.resetAt <= current) this.buckets.delete(key);
    }
  }
}
