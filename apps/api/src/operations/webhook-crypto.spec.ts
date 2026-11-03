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
});
