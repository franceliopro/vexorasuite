#!/usr/bin/env node
/** Verificações determinísticas da vitrine: whitelist, privacidade, honestidade e output estático. */
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const problems = [];
const fail = (message) => problems.push(message);

const snapshotPath = join(root, "src/data/catalog.json");
let rawSnapshot = "";
let snapshot = null;
try {
  rawSnapshot = readFileSync(snapshotPath, "utf8");
  snapshot = JSON.parse(rawSnapshot);
} catch (error) {
  fail(`snapshot ausente ou inválido: ${error.message}`);
}

const statuses = new Set(["READY", "NOT_CONFIGURED", "UNAVAILABLE"]);
const allowedTop = new Set(["status", "source", "generatedAt", "notice", "count", "items", "error"]);
const allowedItem = new Set([
  "id", "kind", "name", "sku", "priceCents", "currency", "unit", "category",
  "publicDescription", "publicImageUrl", "publicLink", "updatedAt",
]);

function isHttps(value) {
  if (typeof value !== "string" || !value.trim()) return false;
  try {
    const url = new URL(value);
    return (
      url.protocol === "https:" &&
      !url.username &&
      !url.password &&
      url.hostname.includes(".") &&
      !/^(localhost|127(?:\.\d{1,3}){3}|\[::1\])$/i.test(url.hostname)
    );
  } catch {
    return false;
  }
}

if (snapshot && typeof snapshot === "object" && !Array.isArray(snapshot)) {
  for (const key of Object.keys(snapshot)) {
    if (!allowedTop.has(key)) fail(`snapshot com chave não permitida: ${key}`);
  }
  if (!statuses.has(snapshot.status)) fail(`status inválido no snapshot: ${snapshot.status}`);
  if (snapshot.status === "READY" && snapshot.source !== "VEXORA_CATALOG") {
    fail("snapshot READY sem source VEXORA_CATALOG");
  }
  if (!Array.isArray(snapshot.items) || snapshot.count !== snapshot.items.length) {
    fail("count não confere com items");
  }
  if (snapshot.status !== "READY" && Array.isArray(snapshot.items) && snapshot.items.length > 0) {
    fail("snapshot não READY com itens preenchidos");
  }

  for (const item of Array.isArray(snapshot.items) ? snapshot.items : []) {
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      fail("item do snapshot inválido");
      continue;
    }
    for (const key of Object.keys(item)) {
      if (!allowedItem.has(key)) fail(`item com chave privada/não permitida: ${key}`);
    }
    for (const field of ["publicDescription", "publicImageUrl", "publicLink"]) {
      if (!Object.hasOwn(item, field)) fail(`item sem campo público obrigatório: ${field}`);
    }
    if (item.publicDescription !== null && typeof item.publicDescription !== "string") {
      fail(`publicDescription inválido no item ${item.id}`);
    }
    for (const field of ["publicImageUrl", "publicLink"]) {
      if (item[field] !== null && !isHttps(item[field])) {
        fail(`${field} não é HTTPS seguro no item ${item.id}`);
      }
    }
    if (typeof item.id !== "string" || !/^[A-Za-z0-9_-]{1,80}$/.test(item.id)) {
      fail(`id de item inseguro: ${item.id}`);
    }
    if (!Number.isSafeInteger(item.priceCents) || item.priceCents < 0) {
      fail(`preço inválido no item ${item.id}`);
    }
  }
} else {
  fail("snapshot não é um objeto");
}

if (/\bvx_store_[A-Za-z0-9_-]{43}\b/i.test(rawSnapshot)) {
  fail("token da vitrine no snapshot");
}
if (/"description"\s*:|data-description|\bimageUrl\b/i.test(rawSnapshot)) {
  fail("snapshot expõe campo privado");
}

const dist = join(root, "dist");
const required = [
  "index.html",
  "sobre/index.html",
  "contato/index.html",
  "404.html",
  "sitemap.xml",
  "robots.txt",
  "servicos/index.html",
];
for (const file of required) {
  if (!existsSync(join(dist, file))) fail(`output ausente: dist/${file}`);
}
if (existsSync(join(dist, "carrinho"))) fail("dist/carrinho não deve existir");

function walk(dir) {
  const out = [];
  if (!existsSync(dir)) return out;
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...walk(full));
    else out.push(full);
  }
  return out;
}

const htmlFiles = walk(dist).filter((file) => file.endsWith(".html"));
const forbiddenHtml = [
  [/\bvx_store_[A-Za-z0-9_-]{43}\b/i, "token da vitrine no HTML"],
  [/"description"\s*:|data-description|\bimageUrl\b/i, "campo privado no HTML"],
  [/\bhref\s*=\s*["'][^"']*\/carrinho/i, "link para carrinho no HTML"],
  [/\bcheckout\b/i, "fluxo de checkout no HTML"],
  [/pague agora/i, "chamada para pagamento real"],
  [/finalizar compra/i, "chamada para finalizar compra"],
  [/pagamento confirmado/i, "afirmação de pagamento confirmado"],
  [/pedido confirmado/i, "afirmação de pedido confirmado"],
  [/mailto:contato@example\.com/i, "link de e-mail placeholder no HTML"],
];

const decodeHtml = (html) =>
  html
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");

for (const file of htmlFiles) {
  const html = decodeHtml(readFileSync(file, "utf8"));
  for (const [pattern, message] of forbiddenHtml) {
    if (pattern.test(html)) fail(`${message}: ${file.replace(root + "\\", "")}`);
  }
  if (/[\\/]servicos[\\/]/.test(file) && !html.includes("não confirma pagamento")) {
    fail(`aviso público ausente: ${file.replace(root + "\\", "")}`);
  }
}

if (snapshot?.status === "READY" && Array.isArray(snapshot.items)) {
  const listFile = join(dist, "servicos/index.html");
  const listHtml = existsSync(listFile) ? decodeHtml(readFileSync(listFile, "utf8")) : "";
  for (const item of snapshot.items) {
    if (typeof item?.id !== "string") continue;
    if (typeof item.name === "string" && !listHtml.includes(item.name)) {
      fail(`item ausente na listagem: ${item.name}`);
    }
    const detailFile = join(dist, "servicos", item.id, "index.html");
    if (!existsSync(detailFile)) {
      fail(`página de detalhe ausente: ${item.id}`);
      continue;
    }
    const detailHtml = decodeHtml(readFileSync(detailFile, "utf8"));
    if (typeof item.name === "string" && !detailHtml.includes(item.name)) {
      fail(`nome ausente na página de detalhe: ${item.id}`);
    }
    if (typeof item.publicDescription === "string" && item.publicDescription.trim() && !detailHtml.includes(item.publicDescription.trim())) {
      fail(`descrição pública ausente na página de detalhe: ${item.id}`);
    }
  }
}

if (snapshot && snapshot.status !== "READY") {
  const listFile = join(dist, "servicos/index.html");
  const listHtml = existsSync(listFile) ? decodeHtml(readFileSync(listFile, "utf8")) : "";
  if (!/Nenhum serviço disponível|não foi possível carregar|não foram disponibilizados/i.test(listHtml)) {
    fail("estado vazio honesto ausente na listagem");
  }
}

if (problems.length) {
  console.error(`[verify] ${problems.length} problema(s) encontrado(s):`);
  for (const problem of [...new Set(problems)].slice(0, 40)) console.error(`  - ${problem}`);
  process.exit(1);
}

const count = Array.isArray(snapshot?.items) ? snapshot.items.length : 0;
console.log(
  `[verify] OK — ${count} item(ns), ${htmlFiles.length} página(s) HTML, whitelist e avisos públicos verificados.`,
);
