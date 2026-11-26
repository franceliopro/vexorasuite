import test from "node:test";
import assert from "node:assert/strict";
import { signWebhook, verifyWebhook } from "../dist/webhook.js";
import { decideConsent } from "../dist/consent.js";
import { idempotencyKey, mediaForEvent, normalizeCallEvent, partyHash } from "../dist/events.js";
import { createWebhookHandler } from "../dist/handler.js";

const tenantId = "11111111-1111-4111-8111-111111111111";
const secret = "ci-webhook-secret-not-a-production-secret";
const nowSeconds = 1_800_000_000;
const phone = "+5511999999999";

function envelope(event, payload, overrides = {}) {
  const raw = Buffer.from(JSON.stringify({ event, payload }));
  const timestamp = String(nowSeconds);
  return {
    raw,
    headers: {
      "x-vexora-timestamp": timestamp,
      "x-vexora-signature": signWebhook(raw, secret, timestamp),
      "x-vexora-correlation-id": "corr-1",
      ...overrides,
    },
  };
}

function callPayload(extra = {}) {
  return {
    externalCallId: "call-123",
    direction: "INBOUND",
    from: phone,
    to: "+5511888888888",
    recordingUrl: "https://example.com/recording.wav",
    transcript: "Cliente pediu ajuda",
    ...extra,
  };
}

function fakeStore(options = {}) {
  const inserts = [];
  return {
    inserts,
    consentFor: async () => options.consent ?? null,
    insertEvent: async (event, media, reason) => {
      inserts.push({ event, media, reason });
      return { duplicate: options.duplicate ?? false, id: options.duplicate ? null : "event-1" };
    },
  };
}

test("webhook exige assinatura HMAC fresca e correlacionada", () => {
  const valid = envelope("call.ended", callPayload());
  const verified = verifyWebhook(valid.raw, valid.headers, secret, 300, nowSeconds * 1000);
  assert.equal(verified.event, "call.ended");
  assert.equal(verified.correlationId, "corr-1");

  assert.throws(
    () => verifyWebhook(Buffer.from('{"event":"x"}'), valid.headers, secret, 300, nowSeconds * 1000),
    /Assinatura do webhook inválida/,
  );
  assert.throws(
    () => verifyWebhook(valid.raw, valid.headers, secret, 300, (nowSeconds + 600) * 1000),
    /fora da janela/,
  );
  const noCorrelation = envelope("call.ended", callPayload(), { "x-vexora-correlation-id": "" });
  assert.throws(
    () => verifyWebhook(noCorrelation.raw, noCorrelation.headers, secret, 300, nowSeconds * 1000),
    /correlação/,
  );
});

test("consentimento é default-deny e revogação/opt-out prevalecem", () => {
  const base = { tenantId, channel: "PHONE", partyHash: "hash", revokedAt: null, optedOut: false };
  assert.equal(decideConsent(null, "PHONE").reason, "NO_CONSENT");
  assert.equal(decideConsent({ ...base, grantedAt: null }, "PHONE").allowed, false);
  assert.equal(decideConsent({ ...base, grantedAt: new Date(), revokedAt: new Date() }, "PHONE").reason, "REVOKED");
  assert.equal(decideConsent({ ...base, grantedAt: new Date(), optedOut: true }, "PHONE").reason, "OPTED_OUT");
  assert.equal(decideConsent({ ...base, grantedAt: new Date() }, "SMS").reason, "CHANNEL_MISMATCH");
  assert.deepEqual(
    { ...decideConsent({ ...base, grantedAt: new Date() }, "PHONE") },
    { allowed: true, reason: "GRANTED", allowRecording: true, allowTranscription: true, allowAi: true },
  );
});

test("o tenant da rota vence qualquer tenant enviado no corpo", () => {
  const event = normalizeCallEvent({
    tenantId,
    provider: "NVOIP",
    event: "call.answered",
    payload: callPayload({ tenantId: "22222222-2222-4222-8222-222222222222" }),
    correlationId: "corr-1",
  });
  assert.equal(event.tenantId, tenantId);
  assert.equal(event.provider, "NVOIP");
  assert.equal(event.channel, "PHONE");
  assert.equal(event.partyHash, partyHash(tenantId, phone));
  assert.match(idempotencyKey(event), /^11111111-1111-4111-8111-111111111111:NVOIP:call-123:call\.answered$/);
  assert.throws(
    () => normalizeCallEvent({ tenantId, provider: "NVOIP", event: "unknown", payload: callPayload(), correlationId: "c" }),
    /não suportado/,
  );
});

test("gravação e transcrição só existem com consentimento correspondente", () => {
  const payload = callPayload();
  const denied = mediaForEvent(payload, decideConsent(null, "PHONE"));
  assert.deepEqual(denied, { recordingUrl: null, transcript: null, aiAllowed: false });

  const granted = decideConsent(
    { tenantId, channel: "PHONE", partyHash: "hash", grantedAt: new Date(), revokedAt: null, optedOut: false },
    "PHONE",
  );
  assert.deepEqual(mediaForEvent(payload, granted), {
    recordingUrl: "https://example.com/recording.wav",
    transcript: "Cliente pediu ajuda",
    aiAllowed: true,
  });
  assert.equal(mediaForEvent({ ...payload, recordingUrl: "http://inseguro/exemplo" }, granted).recordingUrl, null);
});

test("o handler não chama IA nem grava mídia sem consentimento", async () => {
  const store = fakeStore();
  const handler = createWebhookHandler({
    tenants: new Map([[tenantId, { tenantId, provider: "NVOIP", webhookSecret: secret }]]),
    store,
    toleranceSeconds: 300,
    mode: "simulation",
    now: () => nowSeconds * 1000,
  });
  const valid = envelope("recording.ready", callPayload());

  const result = await handler(tenantId, valid.raw, valid.headers);

  assert.equal(result.status, 200);
  assert.deepEqual(
    {
      consent: result.body.consent,
      recordingStored: result.body.recordingStored,
      transcriptStored: result.body.transcriptStored,
      aiInvoked: result.body.aiInvoked,
    },
    { consent: "NO_CONSENT", recordingStored: false, transcriptStored: false, aiInvoked: false },
  );
  assert.equal(store.inserts[0].media.recordingUrl, null);
  assert.equal(store.inserts[0].media.transcript, null);
});

test("com consentimento a mídia é preservada, mas IA continua sem chamada", async () => {
  const granted = {
    tenantId,
    channel: "PHONE",
    partyHash: partyHash(tenantId, phone),
    grantedAt: new Date(),
    revokedAt: null,
    optedOut: false,
  };
  const store = fakeStore({ consent: granted });
  const handler = createWebhookHandler({
    tenants: new Map([[tenantId, { tenantId, provider: "NVOIP", webhookSecret: secret }]]),
    store,
    toleranceSeconds: 300,
    mode: "real",
    now: () => nowSeconds * 1000,
  });
  const valid = envelope("transcript.ready", callPayload());

  const result = await handler(tenantId, valid.raw, valid.headers);

  assert.equal(result.body.consent, "GRANTED");
  assert.equal(result.body.recordingStored, true);
  assert.equal(result.body.transcriptStored, true);
  assert.equal(result.body.aiInvoked, false);
  assert.equal(store.inserts[0].media.aiAllowed, true);
});

test("eventos repetidos e tenants não configurados são tratados sem duplicar auditoria", async () => {
  const store = fakeStore({ duplicate: true });
  const tenants = new Map([[tenantId, { tenantId, provider: "NVOIP", webhookSecret: secret }]]);
  const handler = createWebhookHandler({ tenants, store, toleranceSeconds: 300, mode: "simulation", now: () => nowSeconds * 1000 });
  const valid = envelope("call.started", callPayload());

  const duplicate = await handler(tenantId, valid.raw, valid.headers);
  assert.equal(duplicate.body.duplicate, true);
  assert.equal(store.inserts.length, 1);

  const unknown = await handler("22222222-2222-4222-8222-222222222222", valid.raw, valid.headers);
  assert.equal(unknown.status, 404);
  assert.equal(store.inserts.length, 1);
});
