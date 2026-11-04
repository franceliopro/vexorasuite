import { RateLimitService } from "./rate-limit.service";
import { RedisRateLimitStore } from "./rate-limit.store";

type RedisBackend = Map<string, { count: number; expiresAt: number }>;

function fakeRedis(backend: RedisBackend) {
  return {
    multi() {
      const commands: Array<() => number> = [];
      return {
        incr(key: string) {
          commands.push(() => {
            const current = backend.get(key);
            const now = Date.now();
            if (!current || current.expiresAt <= now) {
              backend.set(key, { count: 1, expiresAt: now + 60_000 });
              return 1;
            }
            current.count += 1;
            return current.count;
          });
          return this;
        },
        pexpire(key: string, ttl: number) {
          commands.push(() => {
            const current = backend.get(key);
            if (current) current.expiresAt = Date.now() + ttl;
            return 1;
          });
          return this;
        },
        pttl(key: string) {
          commands.push(() => {
            const current = backend.get(key);
            return current ? Math.max(0, current.expiresAt - Date.now()) : -2;
          });
          return this;
        },
        async exec() {
          return commands.map((command) => [null, command()] as [null, number]);
        },
      };
    },
  };
}

describe("RedisRateLimitStore", () => {
  it("shares a single counter between two replicas", async () => {
    const backend: RedisBackend = new Map();
    const replicaA = new RedisRateLimitStore(fakeRedis(backend) as never);
    const replicaB = new RedisRateLimitStore(fakeRedis(backend) as never);

    const first = await replicaA.consume("write:user:1", 2, 60_000);
    const second = await replicaB.consume("write:user:1", 2, 60_000);
    const third = await replicaA.consume("write:user:1", 2, 60_000);

    expect(first.allowed).toBe(true);
    expect(second.allowed).toBe(true);
    expect(third.allowed).toBe(false);
  });
});

describe("RateLimitService Redis fallback", () => {
  it("uses the local counter explicitly when Redis becomes unwritable", async () => {
    const service = new RateLimitService();
    const disconnect = jest.fn();
    const failingStore = {
      kind: "redis" as const,
      consume: jest.fn().mockRejectedValue(new Error("Stream isn't writeable")),
    };
    const internals = service as unknown as {
      redis: typeof failingStore;
      redisClient: { disconnect: () => void };
    };
    internals.redis = failingStore;
    internals.redisClient = { disconnect };

    const request = { method: "POST", path: "/api/messages", ip: "203.0.113.10" };
    const decision = await service.check(request);

    expect(decision.allowed).toBe(true);
    expect(disconnect).toHaveBeenCalledTimes(1);
    expect(failingStore.consume).toHaveBeenCalledTimes(1);

    const nextDecision = await service.check(request);
    expect(nextDecision.allowed).toBe(true);
    expect(failingStore.consume).toHaveBeenCalledTimes(1);
  });
});
