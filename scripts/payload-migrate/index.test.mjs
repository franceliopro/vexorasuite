import test from "node:test";
import assert from "node:assert/strict";
import {
  COLLECTION_ORDER,
  mapProperty,
  mapSubmission,
  mapTaxonomy,
  migrate,
  parseArgs,
  readConfig,
  verifyMigration,
} from "./index.mjs";

const CONFIG = Object.freeze({
  directusUrl: "https://directus.example.com",
  directusToken: "directus-token",
  payloadUrl: "https://payload.example.com",
  payloadToken: "payload-token",
  tenantId: "tenant-1",
});

function emptyCollections() {
  return Object.fromEntries(COLLECTION_ORDER.map((slug) => [slug, []]));
}

function response(body, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 200 ? "OK" : "ERRO",
    json: async () => body,
  };
}

function makeFetch(source, target) {
  const calls = { posts: [], gets: [] };
  const fetchImpl = async (input, init = {}) => {
    const url = typeof input === "string" ? new URL(input) : input;
    const path = url.pathname.replace(/\/$/, "");
    const method = init.method ?? "GET";

    if (method === "POST") {
      const slug = path.split("/").pop();
      const body = JSON.parse(init.body);
      const doc = { id: `${slug}-${target[slug].length + 1}`, ...body };
      target[slug].push(doc);
      calls.posts.push({ slug, body, auth: init.headers.authorization });
      return response({ doc });
    }

    calls.gets.push({ path, search: url.search });
    if (path.startsWith("/items/")) {
      const slug = path.split("/").pop();
      return response({ data: source[slug] ?? [] });
    }

    if (path.startsWith("/api/")) {
      const slug = path.split("/")[2];
      const docs = target[slug] ?? [];
      if (url.searchParams.has("page")) return response({ docs, totalPages: 1 });
      const whereKey = [...url.searchParams.keys()].find((key) => /^where\[.+\]\[equals\]$/.test(key));
      if (whereKey) {
        const field = whereKey.match(/^where\[(.+)\]\[equals\]$/)[1];
        const value = url.searchParams.get(whereKey);
        return response({ docs: docs.filter((doc) => String(doc[field]) === value) });
      }
      return response({ docs });
    }

    throw new Error(`Rota inesperada no fetch falso: ${method} ${path}`);
  };
  return { fetchImpl, calls };
}

test("parseArgs mantém dry-run como padrão", () => {
  assert.deepEqual(parseArgs([]), { apply: false, verify: false, usersMapPath: null });
  assert.equal(parseArgs(["--apply", "--verify"]).apply, true);
  assert.equal(parseArgs(["--apply", "--verify"]).verify, true);
  assert.equal(parseArgs(["--users-map", "mapa.json"]).usersMapPath, "mapa.json");
});

test("readConfig exige HTTPS fora de localhost", () => {
  const base = {
    DIRECTUS_URL: "https://directus.example.com",
    DIRECTUS_TOKEN: "d",
    PAYLOAD_URL: "https://payload.example.com",
    PAYLOAD_TOKEN: "p",
    PAYLOAD_TENANT_ID: "t1",
  };
  assert.doesNotThrow(() => readConfig(base));
  assert.throws(() => readConfig({ ...base, PAYLOAD_URL: "http://payload.example.com" }), /HTTPS/);
  assert.throws(() => readConfig({ ...base, PAYLOAD_TOKEN: "" }), /obrigatório/);
});

test("taxonomia carrega tenantId e chave natural", () => {
  const row = mapTaxonomy("category", { id: "c1", name: "Urbano", slug: "urbano" }, "tenant-1");
  assert.equal(row.data.tenantId, "tenant-1");
  assert.equal(row.key, "urbano");
  assert.equal(row.data.legacyId, "c1");
});

test("submissão resolve property_id e preserva tenant", () => {
  const ids = { property: new Map([["p1", "property-target"]]) };
  const row = mapSubmission(
    { id: "s1", submission_key: "AA-1", property_id: { id: "p1" }, status: "approved" },
    "tenant-1",
    ids,
  );
  assert.equal(row.data.tenantId, "tenant-1");
  assert.equal(row.data.property_id, "property-target");
  assert.equal(row.data.status, "approved");
});

test("imóvel sem usuário mapeado é relatado, não inventado", () => {
  const row = mapProperty({ id: "p1", code: "AA-1", owner_id: "u1" }, "tenant-1", {});
  assert.equal(row.data.owner_id, null);
  assert.equal(row.unresolved.owner, true);
});

test("dry-run lê as duas pontas e não grava nada", async () => {
  const source = emptyCollections();
  source.category = [{ id: "c1", name: "Urbano", slug: "urbano" }];
  source.submission = [{ id: "s1", submission_key: "AA-1", name: "Ana", email: "ana@example.com", status: "pending" }];
  const { fetchImpl, calls } = makeFetch(source, emptyCollections());

  const report = await migrate(fetchImpl, CONFIG, {});

  assert.equal(report.mode, "dry-run");
  assert.equal(calls.posts.length, 0);
  assert.equal(report.counts.source.category, 1);
  assert.equal(report.counts.source.submission, 1);
  assert.equal(report.created, 0);
});

test("apply grava com tenantId e API key do Payload", async () => {
  const source = emptyCollections();
  source.category = [{ id: "c1", name: "Urbano", slug: "urbano" }];
  const { fetchImpl, calls } = makeFetch(source, emptyCollections());

  const report = await migrate(fetchImpl, CONFIG, { apply: true });

  assert.equal(report.mode, "apply");
  assert.equal(calls.posts.length, 1);
  assert.equal(calls.posts[0].slug, "category");
  assert.equal(calls.posts[0].body.tenantId, "tenant-1");
  assert.equal(calls.posts[0].auth, "users API-Key payload-token");
  assert.equal(report.created, 1);
});

test("apply reaproveita documento existente pela chave natural", async () => {
  const source = emptyCollections();
  source.category = [{ id: "c1", name: "Urbano", slug: "urbano" }];
  const target = emptyCollections();
  target.category = [{ id: "target-1", legacyId: "c1", slug: "urbano", name: "Urbano" }];
  const { fetchImpl, calls } = makeFetch(source, target);

  const report = await migrate(fetchImpl, CONFIG, { apply: true });

  assert.equal(calls.posts.length, 0);
  assert.equal(report.reused, 1);
  assert.equal(report.counts.target.category, 1);
});

test("verificação aponta contagem divergente e chave duplicada", () => {
  const report = verifyMigration(
    { submission: 2 },
    { submission: 1 },
    { submission: [{ key: "AA-1" }, { key: "AA-1" }] },
  );
  assert.equal(report.ok, false);
  assert.ok(report.issues.some((issue) => issue.includes("origem 2 / destino 1")));
  assert.ok(report.issues.some((issue) => issue.includes("duplicadas")));
});