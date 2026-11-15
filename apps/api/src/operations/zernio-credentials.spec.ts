import { BadRequestException, ServiceUnavailableException } from "@nestjs/common";
import { encryptZernioCredential, zernioApiKeyFor, zernioWebhookSecretFor, zernioConnectionStatus } from "./zernio-credentials";

describe("BYO Zernio credentials", () => {
  const tenant = "11111111-1111-1111-1111-111111111111";
  const other = "22222222-2222-2222-2222-222222222222";
  const KEY = "znx_test_api_key_1234567890abcdef";
  const SECRET = "whsec_test_secret_abcdef0123456789";
  const credsOf = (t: string) => ({
    apiKey: { encryptedKey: encryptZernioCredential(t, "apiKey", KEY), updatedAt: new Date().toISOString() },
    webhookSecret: { encryptedKey: encryptZernioCredential(t, "webhookSecret", SECRET), updatedAt: new Date().toISOString() },
  });
  const integrationsOf = (c: Record<string, { encryptedKey: string; updatedAt: string }>) => ({ zernioCredentials: c });

  const envBackup: Record<string, string | undefined> = {};
  const savedJwt = process.env.JWT_ACCESS_SECRET;
  beforeAll(() => { process.env.JWT_ACCESS_SECRET = "test-encryption-secret-value-with-more-than-thirty-two-bytes"; });
  afterAll(() => { if (savedJwt === undefined) delete process.env.JWT_ACCESS_SECRET; else process.env.JWT_ACCESS_SECRET = savedJwt; });
  beforeEach(() => {
    envBackup.ZERNIO_API_KEY = process.env.ZERNIO_API_KEY;
    envBackup.ZERNIO_WEBHOOK_SECRET = process.env.ZERNIO_WEBHOOK_SECRET;
    delete process.env.ZERNIO_API_KEY;
    delete process.env.ZERNIO_WEBHOOK_SECRET;
  });
  afterEach(() => {
    if (envBackup.ZERNIO_API_KEY === undefined) delete process.env.ZERNIO_API_KEY; else process.env.ZERNIO_API_KEY = envBackup.ZERNIO_API_KEY;
    if (envBackup.ZERNIO_WEBHOOK_SECRET === undefined) delete process.env.ZERNIO_WEBHOOK_SECRET; else process.env.ZERNIO_WEBHOOK_SECRET = envBackup.ZERNIO_WEBHOOK_SECRET;
  });

  it("roundtrip encrypts and decrypts per tenant", () => {
    const integrations = integrationsOf(credsOf(tenant));
    expect(zernioApiKeyFor(integrations, tenant)).toBe(KEY);
    expect(zernioWebhookSecretFor(integrations, tenant)).toBe(SECRET);
  });

  it("does not leak another tenant's credential", () => {
    const integrations = integrationsOf(credsOf(tenant));
    expect(() => zernioApiKeyFor(integrations, other)).toThrow(ServiceUnavailableException);
  });

  it("falls back to the shared server key only when the tenant has none", () => {
    process.env.ZERNIO_API_KEY = "shared-server-key";
    process.env.ZERNIO_WEBHOOK_SECRET = "shared-secret";
    expect(zernioApiKeyFor({}, tenant)).toBe("shared-server-key");
    expect(zernioWebhookSecretFor({}, tenant)).toBe("shared-secret");
    const integrations = integrationsOf(credsOf(tenant));
    expect(zernioApiKeyFor(integrations, tenant)).toBe(KEY); // BYO prevalece sobre a compartilhada
  });

  it("throws a repair message on corrupted ciphertext instead of falling back", () => {
    const integrations = integrationsOf({ apiKey: { encryptedKey: "v1.corrupted.corrupt.corrupt", updatedAt: "x" }, webhookSecret: undefined as any });
    expect(() => zernioApiKeyFor(integrations, tenant)).toThrow(ServiceUnavailableException);
  });

  it("reports connection status honestly", () => {
    expect(zernioConnectionStatus({})).toEqual(expect.objectContaining({ source: null, tenantConfigured: false }));
    process.env.ZERNIO_API_KEY = "shared-server-key";
    expect(zernioConnectionStatus({})).toEqual(expect.objectContaining({ source: "server", tenantConfigured: false }));
    expect(zernioConnectionStatus(integrationsOf(credsOf(tenant)))).toEqual(expect.objectContaining({ source: "tenant", tenantConfigured: true }));
  });
});
