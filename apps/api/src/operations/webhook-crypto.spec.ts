import { decryptWebhookSecret, encryptWebhookSecret, validateWebhookUrl } from "./webhook-crypto";

describe("webhook target security", () => {
  it("rejects local and private destinations before delivery", () => {
    expect(() => validateWebhookUrl("http://127.0.0.1:8080/hook")).toThrow();
    expect(() => validateWebhookUrl("https://10.0.0.8/hook")).toThrow();
    expect(() => validateWebhookUrl("https://metadata.google.internal/compute")).toThrow();
    expect(() => validateWebhookUrl("https://localhost/hook")).toThrow();
  });

  it("requires HTTPS without embedded credentials", () => {
    expect(() => validateWebhookUrl("http://example.com/hook")).toThrow();
    expect(() => validateWebhookUrl("https://user:pass@example.com/hook")).toThrow();
    expect(validateWebhookUrl("https://example.com/hook").protocol).toBe("https:");
  });

  it("keeps webhook secrets encrypted and reversible", () => {
    const encrypted = encryptWebhookSecret("secret-value");
    expect(encrypted).not.toContain("secret-value");
    expect(decryptWebhookSecret(encrypted)).toBe("secret-value");
  });
  it("fails closed when production has no encryption key", () => {
    const previous = {
      nodeEnv: process.env.NODE_ENV,
      webhookKey: process.env.WEBHOOK_ENCRYPTION_KEY,
      integrationKey: process.env.INTEGRATION_ENCRYPTION_KEY,
      jwt: process.env.JWT_ACCESS_SECRET,
    };
    try {
      process.env.NODE_ENV = "production";
      delete process.env.WEBHOOK_ENCRYPTION_KEY;
      delete process.env.INTEGRATION_ENCRYPTION_KEY;
      delete process.env.JWT_ACCESS_SECRET;
      expect(() => encryptWebhookSecret("secret-value")).toThrow("WEBHOOK_ENCRYPTION_KEY");
    } finally {
      if (previous.nodeEnv === undefined) delete process.env.NODE_ENV; else process.env.NODE_ENV = previous.nodeEnv;
      if (previous.webhookKey === undefined) delete process.env.WEBHOOK_ENCRYPTION_KEY; else process.env.WEBHOOK_ENCRYPTION_KEY = previous.webhookKey;
      if (previous.integrationKey === undefined) delete process.env.INTEGRATION_ENCRYPTION_KEY; else process.env.INTEGRATION_ENCRYPTION_KEY = previous.integrationKey;
      if (previous.jwt === undefined) delete process.env.JWT_ACCESS_SECRET; else process.env.JWT_ACCESS_SECRET = previous.jwt;
    }
  });

});
