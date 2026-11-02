import { HttpException } from "@nestjs/common";
import { AuthThrottle } from "./auth-throttle";

describe("AuthThrottle", () => {
  const build = (max = 3, windowMs = 60_000) => {
    let clock = 1_000_000;
    const throttle = new AuthThrottle(max, windowMs, () => clock);
    return { throttle, advance: (ms: number) => (clock += ms) };
  };

  it("allows attempts below the limit and blocks the next one", () => {
    const { throttle } = build(3);
    const key = "login:empresa:user@example.com";
    expect(() => throttle.assertAllowed(key)).not.toThrow();
    throttle.recordFailure(key);
    throttle.recordFailure(key);
    throttle.recordFailure(key);
    expect(() => throttle.assertAllowed(key)).toThrow(HttpException);
    try {
      throttle.assertAllowed(key);
    } catch (error) {
      expect((error as HttpException).getStatus()).toBe(429);
    }
  });

  it("unlocks after the window elapses", () => {
    const { throttle, advance } = build(2, 60_000);
    const key = "login:empresa:user@example.com";
    throttle.recordFailure(key);
    throttle.recordFailure(key);
    expect(() => throttle.assertAllowed(key)).toThrow(HttpException);
    advance(60_001);
    expect(() => throttle.assertAllowed(key)).not.toThrow();
  });

  it("clears the bucket after a successful authentication", () => {
    const { throttle } = build(1);
    const key = "login:empresa:user@example.com";
    throttle.recordFailure(key);
    throttle.clear(key);
    expect(() => throttle.assertAllowed(key)).not.toThrow();
  });

  it("keeps counters isolated per tenant and per e-mail", () => {
    const { throttle } = build(1);
    throttle.recordFailure("login:empresa-a:user@example.com");
    expect(() => throttle.assertAllowed("login:empresa-b:user@example.com")).not.toThrow();
    expect(() => throttle.assertAllowed("login:empresa-a:user@example.com")).toThrow(HttpException);
  });
});
