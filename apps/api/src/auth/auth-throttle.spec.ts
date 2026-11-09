import { HttpException } from "@nestjs/common";
import { AuthThrottle } from "./auth-throttle";

describe("AuthThrottle", () => {
  beforeEach(() => {
    delete process.env.REDIS_URL;
    process.env.NODE_ENV = "test";
  });

  const build = (max = 3, windowMs = 60_000) => {
    let clock = 1_000_000;
    const throttle = new AuthThrottle(max, windowMs, () => clock);
    return { throttle, advance: (ms: number) => (clock += ms) };
  };

  it("allows attempts below the limit and blocks the next one", async () => {
    const { throttle } = build(3);
    const key = "login:empresa:user@example.com";
    await expect(throttle.assertAllowed(key)).resolves.toBeUndefined();
    await throttle.recordFailure(key);
    await throttle.recordFailure(key);
    await throttle.recordFailure(key);
    await expect(throttle.assertAllowed(key)).rejects.toBeInstanceOf(HttpException);
  });

  it("unlocks after the window elapses", async () => {
    const { throttle, advance } = build(2, 60_000);
    const key = "login:empresa:user@example.com";
    await throttle.recordFailure(key);
    await throttle.recordFailure(key);
    await expect(throttle.assertAllowed(key)).rejects.toBeInstanceOf(HttpException);
    advance(60_001);
    await expect(throttle.assertAllowed(key)).resolves.toBeUndefined();
  });

  it("clears the bucket after a successful authentication", async () => {
    const { throttle } = build(1);
    const key = "login:empresa:user@example.com";
    await throttle.recordFailure(key);
    await throttle.clear(key);
    await expect(throttle.assertAllowed(key)).resolves.toBeUndefined();
  });

  it("keeps counters isolated per tenant and per e-mail", async () => {
    const { throttle } = build(1);
    await throttle.recordFailure("login:empresa-a:user@example.com");
    await expect(throttle.assertAllowed("login:empresa-b:user@example.com")).resolves.toBeUndefined();
    await expect(throttle.assertAllowed("login:empresa-a:user@example.com")).rejects.toBeInstanceOf(HttpException);
  });
});
