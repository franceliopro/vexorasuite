import { HttpException } from "@nestjs/common";
import { of } from "rxjs";
import { MemoryRateLimitStore, RedisRateLimitStore } from "./rate-limit.store";
import { policyFor } from "./rate-limit.policy";
import { RateLimitService } from "./rate-limit.service";
import { RateLimitInterceptor } from "./rate-limit.interceptor";

describe("MemoryRateLimitStore", () => {
  it("allows up to the limit and blocks the next request", async () => {
    const store = new MemoryRateLimitStore();
    await expect(store.consume("k", 2, 60_000)).resolves.toMatchObject({ allowed: true, remaining: 1 });
    await expect(store.consume("k", 2, 60_000)).resolves.toMatchObject({ allowed: true, remaining: 0 });
    await expect(store.consume("k", 2, 60_000)).resolves.toMatchObject({ allowed: false });
  });

  it("opens a new window after it expires", async () => {
    let clock = 1_000_000;
    const store = new MemoryRateLimitStore(() => clock);
    await store.consume("k", 1, 60_000);
    await expect(store.consume("k", 1, 60_000)).resolves.toMatchObject({ allowed: false });
    clock += 60_001;
    await expect(store.consume("k", 1, 60_000)).resolves.toMatchObject({ allowed: true });
  });

  it("keeps keys isolated", async () => {
    const store = new MemoryRateLimitStore();
    await store.consume("a", 1, 60_000);
    await expect(store.consume("b", 1, 60_000)).resolves.toMatchObject({ allowed: true });
  });
});

describe("RedisRateLimitStore", () => {
  it("reads the atomic counter and ttl from the pipeline", async () => {
    const exec = jest.fn().mockResolvedValue([
      [null, 3],
      [null, 0],
      [null, 42_000],
    ]);
    const multi = { incr: jest.fn().mockReturnThis(), pexpire: jest.fn().mockReturnThis(), pttl: jest.fn().mockReturnThis(), exec };
    const store = new RedisRateLimitStore({ multi: () => multi } as any);
    const result = await store.consume("k", 5, 60_000);
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(2);
    // The window is created once, never extended by later hits.
    expect(multi.pexpire).toHaveBeenCalledWith("ratelimit:k", 60_000, "NX");
  });
});

describe("policyFor", () => {
  afterEach(() => {
    delete process.env.RATE_LIMIT_AUTH_PER_MIN;
    delete process.env.RATE_LIMIT_WRITE_PER_MIN;
  });

  it("gives credential endpoints the tightest bucket", () => {
    expect(policyFor("POST", "/api/auth/login")).toMatchObject({ name: "auth", limit: 10 });
    expect(policyFor("POST", "/auth/register")).toMatchObject({ name: "auth" });
  });

  it("separates reads from writes", () => {
    expect(policyFor("GET", "/api/contacts").name).toBe("read");
    expect(policyFor("PATCH", "/api/contacts/1").name).toBe("write");
    expect(policyFor("DELETE", "/api/contacts/1").name).toBe("write");
  });

  it("gives multipart uploads their own smaller bucket", () => {
    expect(policyFor("POST", "/api/creative-references", "multipart/form-data; boundary=x").name).toBe("upload");
    expect(policyFor("POST", "/api/creative-references", "multipart/form-data; boundary=x").limit).toBe(60);
  });

  it("honours the configured limits", () => {
    process.env.RATE_LIMIT_AUTH_PER_MIN = "3";
    process.env.RATE_LIMIT_WRITE_PER_MIN = "7";
    expect(policyFor("POST", "/api/auth/login").limit).toBe(3);
    expect(policyFor("POST", "/api/tasks").limit).toBe(7);
  });
});

describe("RateLimitService", () => {
  it("counts an authenticated request by user, not by proxy address", async () => {
    process.env.RATE_LIMIT_WRITE_PER_MIN = "1";
    const service = new RateLimitService();
    const request = { method: "POST", path: "/api/tasks", ip: "10.0.0.1", user: { sub: "user-1" } };
    await expect(service.check(request)).resolves.toMatchObject({ allowed: true, policy: "write" });
    await expect(service.check(request)).resolves.toMatchObject({ allowed: false });
    // A different user behind the same proxy still has their own budget.
    await expect(service.check({ ...request, user: { sub: "user-2" } })).resolves.toMatchObject({ allowed: true });
    delete process.env.RATE_LIMIT_WRITE_PER_MIN;
  });

  it("counts anonymous credential attempts by client ip", async () => {
    process.env.RATE_LIMIT_AUTH_PER_MIN = "1";
    const service = new RateLimitService();
    const request = { method: "POST", path: "/api/auth/login", ip: "203.0.113.9" };
    await expect(service.check(request)).resolves.toMatchObject({ allowed: true });
    await expect(service.check(request)).resolves.toMatchObject({ allowed: false });
    await expect(service.check({ ...request, ip: "203.0.113.10" })).resolves.toMatchObject({ allowed: true });
    delete process.env.RATE_LIMIT_AUTH_PER_MIN;
  });

  it("falls back to the local counter when Redis cannot be reached", async () => {
    process.env.REDIS_URL = "redis://127.0.0.1:6399";
    const service = new RateLimitService();
    process.env.RATE_LIMIT_READ_PER_MIN = "1";
    const request = { method: "GET", path: "/api/tasks", ip: "203.0.113.9" };
    await expect(service.check(request)).resolves.toMatchObject({ allowed: true });
    await expect(service.check(request)).resolves.toMatchObject({ allowed: false });
    service.onModuleDestroy();
    delete process.env.REDIS_URL;
    delete process.env.RATE_LIMIT_READ_PER_MIN;
  });
});

describe("RateLimitInterceptor", () => {
  const contextFor = (request: any) => ({
    switchToHttp: () => ({
      getRequest: () => request,
      getResponse: () => response,
    }),
  }) as any;
  const response: any = { setHeader: jest.fn() };

  it("answers 429 with Retry-After once the budget is gone", async () => {
    process.env.RATE_LIMIT_WRITE_PER_MIN = "1";
    const service = new RateLimitService();
    (service as any).enabled = true;
    const interceptor = new RateLimitInterceptor(service);
    const request = { method: "POST", path: "/api/tasks", ip: "203.0.113.9", user: { sub: "u1" } };
    await interceptor.intercept(contextFor(request), { handle: () => of("ok") });
    await expect(interceptor.intercept(contextFor(request), { handle: () => of("ok") })).rejects.toBeInstanceOf(HttpException);
    expect(response.setHeader).toHaveBeenCalledWith("Retry-After", expect.any(String));
    delete process.env.RATE_LIMIT_WRITE_PER_MIN;
  });

  it("lets requests through while the feature is disabled", async () => {
    const service = new RateLimitService();
    const interceptor = new RateLimitInterceptor(service);
    const request = { method: "POST", path: "/api/tasks", ip: "203.0.113.9" };
    const result = await interceptor.intercept(contextFor(request), { handle: () => of("ok") });
    expect(result).toBeDefined();
  });
});
