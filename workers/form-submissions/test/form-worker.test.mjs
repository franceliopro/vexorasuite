import test from "node:test";
import assert from "node:assert/strict";
import { handleRequest } from "../index.mjs";

const ORIGIN = "https://altoaraguaiaimoveis.com.br";
const URL_BASE = "https://directus.example.test";
const PAYLOAD_BASE = "https://payload.example.test";
const TENANT = "22222222-2222-4222-8222-222222222222";
const FIXED_NOW = () => new Date("2026-11-24T12:34:00.000Z");

function memoryKv() {
  const store = new Map();
  let ttl = null;
  return {
    store,
    get ttl() {
      return ttl;
    },
    get: async (key) => store.get(key) ?? null,
    put: async (key, value, options) => {
      store.set(key, value);
      ttl = options?.expirationTtl ?? null;
    },
  };
}

function env(overrides = {}) {
  return {
    SUBMISSIONS_PROVIDER: "directus",
    DIRECTUS_URL: URL_BASE,
    DIRECTUS_TOKEN: "token-apenas-no-servidor",
    PAYLOAD_URL: PAYLOAD_BASE,
    PAYLOAD_TOKEN: "payload-token-apenas-no-servidor",
    PAYLOAD_TENANT_ID: TENANT,
    ALLOWED_ORIGIN: ORIGIN,
    RATE_LIMIT_KV: memoryKv(),
    ...overrides,
  };
}

function fetchMock({ provider = "directus", existing = [], createStatus = 200, throwOnCreate = false } = {}) {
  const calls = [];
  const impl = async (url, init) => {
    calls.push({ url, init });
    if (init?.method !== "POST") {
      const envelope = provider === "payload" ? { docs: existing } : { data: existing };
      return new Response(JSON.stringify(envelope), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }
    if (throwOnCreate) throw new Error("rede indisponível");
    return new Response(JSON.stringify({ data: { id: "s1" } }), {
      status: createStatus,
      headers: { "content-type": "application/json" },
    });
  };
  impl.calls = calls;
  return impl;
}

function validBody(overrides = {}) {
  return {
    name: "Ana Souza",
    email: "ana@example.com",
    phone: "(66) 9 9999-9999",
    propertyType: "Casa",
    city: "Alto Araguaia - MT",
    message: "Casa de tres quartos, 300m2, valor R$ 480.000.",
    consent: true,
    source: "Anúncio de imóvel",
    website: "",
    ...overrides,
  };
}

function request(body = validBody(), options = {}) {
  const { method = "POST", headers = {}, rawBody } = options;
  return new Request(`${ORIGIN}/api/forms/anunciar`, {
    method,
    headers: {
      "content-type": "application/json",
      origin: ORIGIN,
      "cf-connecting-ip": "203.0.113.10",
      ...headers,
    },
    body: method === "POST" ? (rawBody ?? JSON.stringify(body)) : undefined,
  });
}

async function jsonBody(response) {
  return response.json();
}

test("configuração ausente responde 503 sem tocar no CMS", async () => {
  const fetchImpl = fetchMock();
  const response = await handleRequest(
    request(),
    env({ DIRECTUS_TOKEN: "" }),
    { fetch: fetchImpl, now: FIXED_NOW },
  );
  assert.equal(response.status, 503);
  assert.match((await jsonBody(response)).error, /não está configurado/);
  assert.equal(fetchImpl.calls.length, 0);
});

test("sem KV de limite o Worker não libera envios", async () => {
  const fetchImpl = fetchMock();
  const settings = env();
  delete settings.RATE_LIMIT_KV;
  const response = await handleRequest(request(), settings, { fetch: fetchImpl, now: FIXED_NOW });
  assert.equal(response.status, 503);
  assert.equal(fetchImpl.calls.length, 0);
});

test("honeypot preenchido responde sem gravar submissão", async () => {
  const fetchImpl = fetchMock();
  const response = await handleRequest(
    request(validBody({ website: "sou-um-robo" })),
    env(),
    { fetch: fetchImpl, now: FIXED_NOW },
  );
  assert.equal(response.status, 200);
  assert.equal((await jsonBody(response)).submissionKey, null);
  assert.equal(fetchImpl.calls.length, 0);
});

test("campos obrigatórios e consentimento são validados antes do CMS", async () => {
  const fetchImpl = fetchMock();
  const response = await handleRequest(
    request(validBody({ name: "A", email: "invalido", message: "oi", consent: false })),
    env(),
    { fetch: fetchImpl, now: FIXED_NOW },
  );
  assert.equal(response.status, 400);
  const body = await jsonBody(response);
  assert.ok(body.fields.length >= 4);
  assert.equal(fetchImpl.calls.length, 0);
});

test("submissão válida é gravada como pending com chave determinística", async () => {
  const firstFetch = fetchMock();
  const first = await handleRequest(request(), env(), { fetch: firstFetch, now: FIXED_NOW });
  assert.equal(first.status, 200);
  assert.equal(first.headers.get("cache-control"), "no-store");

  const firstBody = await jsonBody(first);
  assert.equal(firstBody.status, "pending");
  assert.equal(firstBody.duplicate, false);
  assert.match(firstBody.submissionKey, /^AA-[0-9a-f]{32}$/);
  assert.ok(!JSON.stringify(firstBody).includes("token-apenas-no-servidor"));

  assert.equal(firstFetch.calls.length, 2);
  const [lookup, create] = firstFetch.calls;
  assert.match(lookup.url, /filter\[submission_key\]\[_eq\]/);
  assert.equal(create.init.method, "POST");
  assert.equal(create.init.headers.authorization, "Bearer token-apenas-no-servidor");

  const created = JSON.parse(create.init.body);
  assert.equal(created.status, "pending");
  assert.equal(created.email, "ana@example.com");
  assert.equal(created.payload.consent, true);
  assert.equal(created.payload.receivedAt, FIXED_NOW().toISOString());

  const secondFetch = fetchMock();
  const second = await handleRequest(request(), env(), { fetch: secondFetch, now: FIXED_NOW });
  assert.equal((await jsonBody(second)).submissionKey, firstBody.submissionKey);
});

test("chave já existente é reaproveitada sem segundo POST", async () => {
  const fetchImpl = fetchMock({ existing: [{ id: "s1", submission_key: "AA-existente" }] });
  const response = await handleRequest(request(), env(), { fetch: fetchImpl, now: FIXED_NOW });
  assert.equal(response.status, 200);
  const body = await jsonBody(response);
  assert.equal(body.duplicate, true);
  assert.equal(fetchImpl.calls.length, 1);
  assert.notEqual(fetchImpl.calls[0].init.method, "POST");
});

test("payload: submissão usa API key, filtra por tenant e grava tenantId", async () => {
  const fetchImpl = fetchMock({ provider: "payload" });
  const settings = env({ SUBMISSIONS_PROVIDER: "payload" });
  const response = await handleRequest(request(), settings, { fetch: fetchImpl, now: FIXED_NOW });

  assert.equal(response.status, 200);
  const body = await jsonBody(response);
  assert.equal(body.status, "pending");
  assert.equal(body.duplicate, false);
  assert.match(body.submissionKey, /^AA-[0-9a-f]{32}$/);
  assert.ok(!JSON.stringify(body).includes("payload-token-apenas-no-servidor"));

  assert.equal(fetchImpl.calls.length, 2);
  const [lookup, create] = fetchImpl.calls;
  const lookupUrl = new URL(lookup.url);
  assert.equal(lookupUrl.pathname, "/api/submission");
  assert.equal(lookupUrl.searchParams.get("where[tenantId][equals]"), TENANT);
  assert.ok(lookupUrl.searchParams.get("where[submission_key][equals]"));
  assert.equal(lookupUrl.searchParams.get("limit"), "1");
  assert.equal(lookup.init.headers.authorization, "users API-Key payload-token-apenas-no-servidor");
  assert.equal(create.init.method, "POST");
  assert.equal(create.init.headers.authorization, "users API-Key payload-token-apenas-no-servidor");

  const created = JSON.parse(create.init.body);
  assert.equal(created.tenantId, TENANT);
  assert.equal(created.status, "pending");
  assert.equal(created.email, "ana@example.com");
  assert.equal(created.payload.consent, true);
  assert.equal(created.payload.receivedAt, FIXED_NOW().toISOString());
});

test("payload: resposta docs com chave existente evita segundo POST", async () => {
  const fetchImpl = fetchMock({
    provider: "payload",
    existing: [{ id: "s1", submission_key: "AA-existente" }],
  });
  const response = await handleRequest(
    request(),
    env({ SUBMISSIONS_PROVIDER: "payload" }),
    { fetch: fetchImpl, now: FIXED_NOW },
  );
  assert.equal(response.status, 200);
  assert.equal((await jsonBody(response)).duplicate, true);
  assert.equal(fetchImpl.calls.length, 1);
  assert.notEqual(fetchImpl.calls[0].init.method, "POST");
});

test("payload sem tenant é recusado sem chamar o CMS", async () => {
  const fetchImpl = fetchMock({ provider: "payload" });
  const response = await handleRequest(
    request(),
    env({ SUBMISSIONS_PROVIDER: "payload", PAYLOAD_TENANT_ID: "" }),
    { fetch: fetchImpl, now: FIXED_NOW },
  );
  assert.equal(response.status, 503);
  assert.match((await jsonBody(response)).error, /não está configurado/);
  assert.equal(fetchImpl.calls.length, 0);
});

test("provedor inválido é recusado sem chamar o CMS", async () => {
  const fetchImpl = fetchMock();
  const response = await handleRequest(
    request(),
    env({ SUBMISSIONS_PROVIDER: "outro" }),
    { fetch: fetchImpl, now: FIXED_NOW },
  );
  assert.equal(response.status, 503);
  assert.match((await jsonBody(response)).error, /não está configurado/);
  assert.equal(fetchImpl.calls.length, 0);
});

test("limite de cinco envios por IP por hora é aplicado", async () => {
  const settings = env();
  const fetchImpl = fetchMock();
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const response = await handleRequest(request(), settings, { fetch: fetchImpl, now: FIXED_NOW });
    assert.equal(response.status, 200);
  }
  assert.equal(settings.RATE_LIMIT_KV.ttl, 3600);

  const blocked = await handleRequest(request(), settings, { fetch: fetchImpl, now: FIXED_NOW });
  assert.equal(blocked.status, 429);
  assert.equal(blocked.headers.get("retry-after"), "3600");
  assert.equal(fetchImpl.calls.length, 10);
});

test("falha do CMS vira 502 sem afirmar registro", async () => {
  const fetchImpl = fetchMock({ createStatus: 500 });
  const response = await handleRequest(request(), env(), { fetch: fetchImpl, now: FIXED_NOW });
  assert.equal(response.status, 502);
  const body = await jsonBody(response);
  assert.match(body.error, /Não foi possível registrar/);
  assert.ok(!JSON.stringify(body).match(/enviad|publicad|aprovad/i));
});

test("falha de transporte não vaza detalhes", async () => {
  const fetchImpl = fetchMock({ throwOnCreate: true });
  const response = await handleRequest(request(), env(), { fetch: fetchImpl, now: FIXED_NOW });
  assert.equal(response.status, 502);
  assert.ok(!JSON.stringify(await jsonBody(response)).includes("rede indisponível"));
});

test("origem não autorizada é recusada", async () => {
  const fetchImpl = fetchMock();
  const response = await handleRequest(
    request(validBody(), { headers: { origin: "https://outro-exemplo.test" } }),
    env(),
    { fetch: fetchImpl, now: FIXED_NOW },
  );
  assert.equal(response.status, 403);
  assert.equal(fetchImpl.calls.length, 0);
});

test("preflight e método indevido têm respostas explícitas", async () => {
  const settings = env();
  const preflight = await handleRequest(
    request(undefined, { method: "OPTIONS", headers: { origin: ORIGIN } }),
    settings,
    { now: FIXED_NOW },
  );
  assert.equal(preflight.status, 204);
  assert.equal(preflight.headers.get("access-control-allow-methods"), "POST, OPTIONS");

  const get = await handleRequest(request(undefined, { method: "GET" }), settings, { now: FIXED_NOW });
  assert.equal(get.status, 405);
  assert.equal(get.headers.get("allow"), "POST, OPTIONS");
});

test("JSON inválido ou corpo não objeto são recusados", async () => {
  const settings = env();
  const malformed = await handleRequest(request(undefined, { rawBody: "{" }), settings, { now: FIXED_NOW });
  assert.equal(malformed.status, 400);
  const array = await handleRequest(request(undefined, { rawBody: "[]" }), settings, { now: FIXED_NOW });
  assert.equal(array.status, 400);
});
