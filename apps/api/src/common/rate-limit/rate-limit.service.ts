import { Injectable, Logger, OnModuleDestroy } from "@nestjs/common";
import { MemoryRateLimitStore, RateLimitStore, RedisRateLimitStore } from "./rate-limit.store";
import { policyFor } from "./rate-limit.policy";

export interface RateLimitDecision {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetAt: number;
  policy: string;
}

interface RequestLike {
  method?: string;
  path?: string;
  ip?: string;
  headers?: Record<string, unknown>;
  user?: { sub?: string };
}

/**
 * Request rate limiting for the whole API.
 *
 * With REDIS_URL the counter is shared by every replica; without it (or if Redis stops
 * answering) the process keeps a local counter and logs a warning once. RATE_LIMIT_ENABLED=false
 * turns the feature off entirely.
 */
@Injectable()
export class RateLimitService implements OnModuleDestroy {
  private readonly logger = new Logger(RateLimitService.name);
  private readonly memory = new MemoryRateLimitStore();
  private redis?: RedisRateLimitStore;
  private redisClient?: { disconnect?: () => void; quit?: () => Promise<unknown> };
  private connecting?: Promise<void>;
  private warned = false;
  readonly enabled = process.env.RATE_LIMIT_ENABLED !== "false" && process.env.NODE_ENV !== "test";

  onModuleDestroy(): void {
    const client = this.redisClient;
    this.redisClient = undefined;
    this.redis = undefined;
    if (client?.quit) void client.quit().catch(() => client.disconnect?.());
  }

  async check(request: RequestLike): Promise<RateLimitDecision> {
    const contentType = typeof request.headers?.["content-type"] === "string" ? String(request.headers["content-type"]) : "";
    const policy = policyFor(request.method ?? "GET", request.path ?? "/", contentType);
    const actor = policy.name === "auth" || !request.user?.sub
      ? `ip:${request.ip ?? "unknown"}`
      : `user:${request.user.sub}`;
    const store = await this.store();
    const result = await store.consume(`${policy.name}:${actor}`, policy.limit, policy.windowMs);
    return { ...result, limit: policy.limit, policy: policy.name };
  }

  private async store(): Promise<RateLimitStore> {
    if (this.redis) return this.redis;
    const url = process.env.REDIS_URL;
    if (!url) return this.memory;
    this.connecting ??= this.connect(url);
    await this.connecting;
    return this.redis ?? this.memory;
  }

  private async connect(url: string): Promise<void> {
    let candidate: { disconnect?: () => void; ping: () => Promise<string>; on: (event: string, cb: (error: Error) => void) => void } | undefined;
    try {
      const { default: Redis } = await import("ioredis");
      const client = new Redis(url, {
        lazyConnect: false,
        maxRetriesPerRequest: 1,
        enableOfflineQueue: false,
        connectTimeout: 2000,
      });
      candidate = client;
      client.on("error", (error: Error) => {
        if (this.warned) return;
        this.warned = true;
        this.logger.warn(`Redis indisponível para rate limit; usando contador local: ${error.message}`);
      });
      await client.ping();
      this.redisClient = client;
      this.redis = new RedisRateLimitStore(client);
      this.logger.log("Rate limit usando contador compartilhado no Redis.");
    } catch (error) {
      // Stop the reconnect loop: a limiter must never hold the process open or retry forever.
      candidate?.disconnect?.();
      this.logger.warn(
        `Não foi possível usar o Redis para rate limit (${error instanceof Error ? error.message : String(error)}). Contador local em uso.`,
      );
    }
  }
}
