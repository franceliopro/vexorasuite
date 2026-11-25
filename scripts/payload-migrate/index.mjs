/**
 * Migra dados do Directus para o Payload CMS.
 *
 * O modo padrão é dry-run: somente leitura, mapeamento e validação. A gravação
 * exige --apply explícito. Em nenhum caminho este script executa DELETE.
 * Nenhum segredo é lido de arquivo versionado.
 */
import { pathToFileURL } from "node:url";

export const COLLECTION_ORDER = Object.freeze([
  "category",
  "purpose",
  "location",
  "property",
  "submission",
  "media",
]);

const TAXONOMIES = Object.freeze(["category", "purpose", "location"]);
const SOURCE_PAGE_SIZE = 200;
const TARGET_PAGE_SIZE = 200;
const TARGET_KEY_FIELD = Object.freeze({
  category: "slug",
  purpose: "slug",
  location: "naturalKey",
  property: "code",
  submission: "submission_key",
  media: "legacyId",
});
const PROPERTY_STATUS = new Set(["draft", "pending", "published", "rejected"]);
const SUBMISSION_STATUS = new Set(["pending", "approved", "rejected"]);

export function parseArgs(argv = process.argv.slice(2)) {
  const index = argv.indexOf("--users-map");
  return {
    apply: argv.includes("--apply"),
    verify: argv.includes("--verify"),
    usersMapPath: index === -1 ? null : argv[index + 1] ?? null,
  };
}

function required(env, name) {
  const value = typeof env[name] === "string" ? env[name].trim() : "";
  if (!value) throw new Error(`${name} é obrigatório.`);
  return value;
}

function safeBaseUrl(value, name) {
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`${name} não é uma URL válida.`);
  }
  if (!["http:", "https:"].includes(url.protocol) || url.username || url.password) {
    throw new Error(`${name} não é uma URL segura.`);
  }
  if (url.protocol === "http:" && !["localhost", "127.0.0.1"].includes(url.hostname)) {
    throw new Error(`${name} exige HTTPS fora de localhost.`);
  }
  return value.replace(/\/+$/, "");
}

export function readConfig(env = process.env) {
  return {
    directusUrl: safeBaseUrl(required(env, "DIRECTUS_URL"), "DIRECTUS_URL"),
    directusToken: required(env, "DIRECTUS_TOKEN"),
    payloadUrl: safeBaseUrl(required(env, "PAYLOAD_URL"), "PAYLOAD_URL"),
    payloadToken: required(env, "PAYLOAD_TOKEN"),
    tenantId: required(env, "PAYLOAD_TENANT_ID"),
  };
}

export function payloadAuthorization(token) {
  const clean = token.trim();
  if (clean.startsWith("users API-Key ") || clean.startsWith("Bearer ")) return clean;
  return `users API-Key ${clean}`;
}

async function jsonResponse(fetchImpl, url, init) {
  const response = await fetchImpl(url, init);
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    const detail = typeof body?.errors?.[0]?.message === "string" ? body.errors[0].message : response.statusText;
    throw new Error(`CMS respondeu ${response.status}: ${detail}`);
  }
  return body;
}

async function listDirectus(fetchImpl, config, slug) {
  const rows = [];
  for (let offset = 0; ; offset += SOURCE_PAGE_SIZE) {
    const url = new URL(`${config.directusUrl}/items/${slug}`);
    url.searchParams.set("limit", String(SOURCE_PAGE_SIZE));
    url.searchParams.set("offset", String(offset));
    url.searchParams.set("fields", "*.*");
    const body = await jsonResponse(fetchImpl, url, {
      headers: { authorization: `Bearer ${config.directusToken}` },
    });
    const page = Array.isArray(body?.data) ? body.data : [];
    rows.push(...page);
    if (page.length < SOURCE_PAGE_SIZE) return rows;
  }
}

async function listPayload(fetchImpl, config, slug) {
  const rows = [];
  for (let page = 1; ; page += 1) {
    const url = new URL(`${config.payloadUrl}/api/${slug}`);
    url.searchParams.set("limit", String(TARGET_PAGE_SIZE));
    url.searchParams.set("page", String(page));
    url.searchParams.set("depth", "0");
    const body = await jsonResponse(fetchImpl, url, {
      headers: { authorization: payloadAuthorization(config.payloadToken) },
    });
    const docs = Array.isArray(body?.docs) ? body.docs : [];
    rows.push(...docs);
    if (docs.length < TARGET_PAGE_SIZE) return rows;
  }
}

async function findTarget(fetchImpl, config, slug, keyValue) {
  const url = new URL(`${config.payloadUrl}/api/${slug}`);
  url.searchParams.set(`where[${TARGET_KEY_FIELD[slug]}][equals]`, String(keyValue));
  url.searchParams.set("limit", "1");
  url.searchParams.set("depth", "0");
  const body = await jsonResponse(fetchImpl, url, {
    headers: { authorization: payloadAuthorization(config.payloadToken) },
  });
  return Array.isArray(body?.docs) ? body.docs[0] ?? null : null;
}

async function createTarget(fetchImpl, config, slug, data) {
  const body = await jsonResponse(fetchImpl, `${config.payloadUrl}/api/${slug}`, {
    method: "POST",
    headers: {
      authorization: payloadAuthorization(config.payloadToken),
      "content-type": "application/json",
    },
    body: JSON.stringify(data),
  });
  return body?.doc ?? null;
}

function text(value) {
  return typeof value === "string" || typeof value === "number" ? String(value).trim() : "";
}

function nullableText(value) {
  const clean = text(value);
  return clean || null;
}

function numberOrNull(value) {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function refId(value) {
  if (value && typeof value === "object") return text(value.id);
  return text(value);
}

export function mapTaxonomy(slug, doc, tenantId) {
  const legacyId = text(doc?.id);
  if (!legacyId) throw new Error(`${slug} sem id de origem.`);
  if (slug === "category" || slug === "purpose") {
    const name = text(doc.name);
    const value = text(doc.slug);
    if (!name || !value) throw new Error(`${slug} ${legacyId} incompleto.`);
    return { slug, legacyId, key: value, data: { tenantId, name, slug: value, legacyId } };
  }
  if (slug === "location") {
    const city = text(doc.city);
    if (!city) throw new Error(`location ${legacyId} sem city.`);
    const state = text(doc.state);
    const neighborhood = text(doc.neighborhood);
    const key = [city, state, neighborhood].join("|");
    return {
      slug,
      legacyId,
      key,
      data: {
        tenantId,
        city,
        state: state || null,
        region: nullableText(doc.region),
        neighborhood: neighborhood || null,
        naturalKey: key,
        legacyId,
      },
    };
  }
  throw new Error(`Coleção não mapeada como taxonomia: ${slug}.`);
}

export function mapProperty(doc, tenantId, idMaps, usersMap = {}) {
  const legacyId = text(doc?.id);
  const code = text(doc?.code);
  if (!code) throw new Error(`property ${legacyId || "sem id"} sem code.`);
  const category = idMaps.category?.get(refId(doc.category)) ?? null;
  const purpose = idMaps.purpose?.get(refId(doc.purpose)) ?? null;
  const location = idMaps.location?.get(refId(doc.location)) ?? null;
  const ownerRef = refId(doc.owner_id);
  const owner = usersMap[ownerRef] ?? null;
  const status = PROPERTY_STATUS.has(text(doc.status)) ? text(doc.status) : "draft";
  return {
    slug: "property",
    legacyId,
    key: code,
    data: {
      tenantId,
      legacyId,
      code,
      title: text(doc.title) || code,
      type: nullableText(doc.type),
      category,
      purpose,
      location,
      owner_id: owner,
      price: numberOrNull(doc.price),
      condominium: numberOrNull(doc.condominium),
      bedrooms: numberOrNull(doc.bedrooms),
      bathrooms: numberOrNull(doc.bathrooms),
      parking: numberOrNull(doc.parking),
      area: numberOrNull(doc.area),
      status,
      gallery: Array.isArray(doc.gallery) ? doc.gallery : [],
      description: text(doc.description),
      rejection_reason: nullableText(doc.rejection_reason),
      legacyUpdatedAt: nullableText(doc.updated_at),
    },
    unresolved: {
      category: Boolean(refId(doc.category)) && !category,
      purpose: Boolean(refId(doc.purpose)) && !purpose,
      location: Boolean(refId(doc.location)) && !location,
      owner: Boolean(ownerRef) && !owner,
    },
  };
}

export function mapSubmission(doc, tenantId, idMaps) {
  const legacyId = text(doc?.id);
  const key = text(doc?.submission_key);
  if (!key) throw new Error(`submission ${legacyId || "sem id"} sem submission_key.`);
  const status = SUBMISSION_STATUS.has(text(doc.status)) ? text(doc.status) : "pending";
  const property = idMaps.property?.get(refId(doc.property_id)) ?? null;
  return {
    slug: "submission",
    legacyId,
    key,
    data: {
      tenantId,
      legacyId,
      submission_key: key,
      name: text(doc.name),
      email: text(doc.email),
      phone: nullableText(doc.phone),
      payload: doc.payload && typeof doc.payload === "object" ? doc.payload : {},
      status,
      rejection_reason: nullableText(doc.rejection_reason),
      property_id: property,
      legacyCreatedAt: nullableText(doc.created_at ?? doc.createdAt),
    },
    unresolved: { property: Boolean(refId(doc.property_id)) && !property },
  };
}

export function mapMedia(doc, tenantId) {
  const legacyId = text(doc?.id);
  if (!legacyId) throw new Error("media sem id de origem.");
  return {
    slug: "media",
    legacyId,
    key: legacyId,
    data: {
      tenantId,
      legacyId,
      filename: nullableText(doc.filename),
      url: nullableText(doc.url),
      alt: nullableText(doc.alt),
      mimeType: nullableText(doc.mime_type ?? doc.mimeType),
      filesize: numberOrNull(doc.filesize),
      width: numberOrNull(doc.width),
      height: numberOrNull(doc.height),
      source: doc && typeof doc === "object" ? doc : {},
    },
  };
}

export function verifyMigration(sourceCounts, targetCounts, mapped) {
  const issues = [];
  for (const slug of COLLECTION_ORDER) {
    const source = sourceCounts[slug] ?? 0;
    const target = targetCounts[slug] ?? 0;
    if (source !== target) issues.push(`${slug}: origem ${source} / destino ${target}`);
    const keys = (mapped[slug] ?? []).map((row) => row.key).filter(Boolean);
    if (new Set(keys).size !== keys.length) issues.push(`${slug}: chaves naturais duplicadas na origem`);
  }
  return { ok: issues.length === 0, issues };
}

function collectIssues(mapped) {
  const issues = [];
  for (const slug of COLLECTION_ORDER) {
    for (const row of mapped[slug] ?? []) {
      if (!row.key) issues.push(`${slug} ${row.legacyId}: chave natural vazia`);
      for (const [field, missing] of Object.entries(row.unresolved ?? {})) {
        if (missing) issues.push(`${slug} ${row.legacyId}: ${field} não resolvido`);
      }
    }
  }
  return issues;
}

function idMapFromDocs(docs) {
  const map = new Map();
  for (const doc of docs ?? []) {
    const legacy = text(doc?.legacyId);
    const id = text(doc?.id);
    if (legacy && id) map.set(legacy, id);
  }
  return map;
}

async function loadOrCreate(fetchImpl, config, slug, rows, idMaps, stats) {
  for (const row of rows) {
    const existing = await findTarget(fetchImpl, config, slug, row.key);
    if (existing) {
      stats.reused += 1;
      if (row.legacyId && text(existing.id)) idMaps[slug]?.set(row.legacyId, text(existing.id));
      continue;
    }
    const created = await createTarget(fetchImpl, config, slug, row.data);
    if (!created || !text(created.id)) throw new Error(`${slug} ${row.key} criado sem id no Payload.`);
    stats.created += 1;
    if (row.legacyId) idMaps[slug]?.set(row.legacyId, text(created.id));
  }
}

export async function migrate(fetchImpl, config, options = {}) {
  const tenantId = config.tenantId;
  const usersMap = options.usersMap ?? {};
  const source = {};
  const target = {};
  for (const slug of COLLECTION_ORDER) {
    source[slug] = await listDirectus(fetchImpl, config, slug);
    target[slug] = await listPayload(fetchImpl, config, slug);
  }

  const idMaps = {
    category: idMapFromDocs(target.category),
    purpose: idMapFromDocs(target.purpose),
    location: idMapFromDocs(target.location),
    property: idMapFromDocs(target.property),
  };

  const mapped = {};
  for (const slug of TAXONOMIES) mapped[slug] = source[slug].map((doc) => mapTaxonomy(slug, doc, tenantId));

  const stats = { created: 0, reused: 0 };
  if (options.apply) {
    for (const slug of TAXONOMIES) await loadOrCreate(fetchImpl, config, slug, mapped[slug], idMaps, stats);
  }

  mapped.property = source.property.map((doc) => mapProperty(doc, tenantId, idMaps, usersMap));
  if (options.apply) await loadOrCreate(fetchImpl, config, "property", mapped.property, idMaps, stats);

  mapped.submission = source.submission.map((doc) => mapSubmission(doc, tenantId, idMaps));
  if (options.apply) await loadOrCreate(fetchImpl, config, "submission", mapped.submission, idMaps, stats);

  mapped.media = source.media.map((doc) => mapMedia(doc, tenantId));
  if (options.apply) await loadOrCreate(fetchImpl, config, "media", mapped.media, idMaps, stats);

  const sourceCounts = Object.fromEntries(COLLECTION_ORDER.map((slug) => [slug, source[slug].length]));
  const targetCounts = options.apply
    ? Object.fromEntries(await Promise.all(COLLECTION_ORDER.map(async (slug) => [slug, (await listPayload(fetchImpl, config, slug)).length])))
    : Object.fromEntries(COLLECTION_ORDER.map((slug) => [slug, target[slug].length]));

  return {
    mode: options.apply ? "apply" : "dry-run",
    counts: { source: sourceCounts, target: targetCounts },
    mapped: Object.fromEntries(COLLECTION_ORDER.map((slug) => [slug, mapped[slug].length])),
    created: stats.created,
    reused: stats.reused,
    issues: collectIssues(mapped),
    verification: verifyMigration(sourceCounts, targetCounts, mapped),
  };
}

async function readUsersMap(filePath) {
  if (!filePath) return {};
  const { readFile } = await import("node:fs/promises");
  const parsed = JSON.parse(await readFile(filePath, "utf8"));
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("--users-map deve ser um objeto JSON email -> id.");
  }
  return parsed;
}

async function main() {
  const args = parseArgs();
  const config = readConfig();
  const usersMap = await readUsersMap(args.usersMapPath);
  const report = await migrate(globalThis.fetch, config, { apply: args.apply, usersMap });
  console.log(JSON.stringify(report, null, 2));
  if (report.issues.length > 0 || (args.verify && !report.verification.ok)) process.exitCode = 1;
}

const invoked = process.argv[1]
  ? import.meta.url === pathToFileURL(process.argv[1]).href
  : false;
if (invoked) main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});