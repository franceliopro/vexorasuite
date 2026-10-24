import { createHmac } from "node:crypto";
import { ZernioService } from "./zernio.service";

describe("ZernioService webhook signature", () => {
  const service = new ZernioService();
  const secret = "test-webhook-secret";
  const rawBody = Buffer.from('{"event":"message.received","test":true}');

  it("accepts a matching HMAC-SHA256 signature over the raw request body", () => {
    const signature = createHmac("sha256", secret).update(rawBody).digest("hex");
    expect(service.verifyWebhook(rawBody, signature, secret)).toBe(true);
  });

  it("rejects a changed payload, wrong secret, and malformed signature", () => {
    const signature = createHmac("sha256", secret).update(rawBody).digest("hex");
    expect(service.verifyWebhook(Buffer.from(rawBody.toString() + " "), signature, secret)).toBe(false);
    expect(service.verifyWebhook(rawBody, signature, "another-secret")).toBe(false);
    expect(service.verifyWebhook(rawBody, "sha256=" + signature, secret)).toBe(false);
    expect(service.verifyWebhook(undefined, signature, secret)).toBe(false);
  });
});
