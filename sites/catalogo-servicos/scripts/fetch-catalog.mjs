#!/usr/bin/env node
/**
 * Busca o feed público da vitrine no build e grava um snapshot somente leitura.
 * O token fica apenas no ambiente do build: nunca entra em src/ nem no bundle.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const output = resolve(process.env.VEXORA_CATALOG_OUTPUT || join(root, "src/data/catalog.json"));
const origin = (process.env.VEXORA_API_ORIGIN || "").trim().replace(/\/+$/, "");
const token = (process.env.VEXORA_CATALOG_TOKEN || "").trim();
const timeoutMs = (() => {
  const value = Number(process.env.VEXORA_CATALOG_TIMEOUT_MS || 15000);
  return Number.isFinite(value) && value > 0 ? Math.min(value, 120000) : 15000;
})();

const MAX_ITEMS = 200;
const TOKEN_PATTERN = /^vx_store_[A-Za-z0-9_-]{43}$/;

const PUBLIC_NOTICE =
  "Preços e disponibilidade vêm do catálogo ativo da Véxora. Esta vitrine não confirma pagamento, pedido ou conexão com provedor.";
const UNAVAILABLE_NOTICE =
  "Catálogo indisponível ou não configurado. Nenhum serviço é exibido até o feed público da Véxora ser consultado com sucesso.";

function safeSnapshot(status, generatedAt = null, items = [], error = null) {
  return {
    status,
    source: status === "READY" ? "VEXORA_CATALOG" : "UNAVAILABLE",
    generatedAt,
    notice: status === "READY" ? PUBLIC_NOTICE : UNAVAILABLE_NOTICE,
    count: items.length,
    items,
    ...(error ? { error } : {}),
  };
}

function validOrigin(value) {
  try {
    const url = new URL(value);
    const local = ["localhost", "127.0.0.1", "::1"].includes(url.hostname);
    return url.protocol === "https:" || (local && url.protocol === "http:");
  } catch {
    return false;
  }
}

function safeHttpsUrl(value) {
  if (typeof value !== "string") return null;
  const raw = value.trim();
  if (!raw || raw.length > 2000) return null;
  try {
    const url = new URL(raw);
    if (url.protocol !== "https:" || url.username || url.password) return null;
    if (!url.hostname.includes(".")) return null;
    if (/^(localhost|127(?:\.\d{1,3}){3}|\[::1\])$/i.test(url.hostname)) return null;
    return raw;
  } catch {
    return null;
  }
}

const text = (value, max) => (typeof value === "string" ? value.trim().slice(0, max) : "");

function publicItem(raw) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const id = typeof raw.id === "string" ? raw.id.trim() : "";
  const name = text(raw.name, 120);
  if (!/^[A-Za-z0-9_-]{1,80}$/.test(id) || !name) return null;

  const priceCents = Number(raw.priceCents);
  if (!Number.isSafeInteger(priceCents) || priceCents < 0) return null;

  // Whitelist explícita: description e imageUrl são privados e não entram no snapshot.
  return {
    id,
    kind: text(raw.kind, 40) || "SERVICE",
    name,
    sku: text(raw.sku, 80),
    priceCents,
    currency: text(raw.currency, 10) || "BRL",
    unit: text(raw.unit, 20) || "un",
    category: text(raw.category, 80) || "Serviços",
    publicDescription: text(raw.publicDescription, 2000),
    publicImageUrl: safeHttpsUrl(raw.publicImageUrl),
    publicLink: safeHttpsUrl(raw.publicLink),
    updatedAt: text(raw.updatedAt, 40),
  };
}

async function fetchFeed() {
  if (!origin || !token) {
    return safeSnapshot("NOT_CONFIGURED", null, [], "VEXORA_API_ORIGIN ou VEXORA_CATALOG_TOKEN não informados.");
  }
  if (!validOrigin(origin)) {
    return safeSnapshot("UNAVAILABLE", null, [], "Origem da API inválida; use HTTPS ou localhost.");
  }
  if (!TOKEN_PATTERN.test(token)) {
    return safeSnapshot("UNAVAILABLE", null, [], "Token da vitrine em formato inválido.");
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(`${origin}/api/public/storefront/${token}`, {
      signal: controller.signal,
      headers: { accept: "application/json" },
    });
    if (!response.ok) {
      return safeSnapshot("UNAVAILABLE", null, [], `Feed respondeu HTTP ${response.status}.`);
    }
    const payload = await response.json();
    if (!payload || payload.source !== "VEXORA_CATALOG" || !Array.isArray(payload.items)) {
      return safeSnapshot("UNAVAILABLE", null, [], "Feed não é um catálogo Véxora válido.");
    }

    const seen = new Set();
    const items = [];
    for (const raw of payload.items) {
      const item = publicItem(raw);
      if (!item || seen.has(item.id)) continue;
      seen.add(item.id);
      items.push(item);
    }
    items.sort((a, b) => a.category.localeCompare(b.category, "pt-BR") || a.name.localeCompare(b.name, "pt-BR"));

    const generatedAt =
      typeof payload.generatedAt === "string" && !Number.isNaN(Date.parse(payload.generatedAt))
        ? payload.generatedAt
        : null;
    return safeSnapshot("READY", generatedAt, items.slice(0, MAX_ITEMS));
  } catch (error) {
    const reason = error?.name === "AbortError" ? "Tempo limite ao consultar o feed." : "Falha de rede ao consultar o feed.";
    return safeSnapshot("UNAVAILABLE", null, [], reason);
  } finally {
    clearTimeout(timer);
  }
}

const snapshot = await fetchFeed();
mkdirSync(dirname(output), { recursive: true });
writeFileSync(output, `${JSON.stringify(snapshot, null, 2)}\n`, "utf8");

const label = output.startsWith(root) ? output.slice(root.length + 1) : output;
console.log(`[catalog] ${snapshot.status}: ${snapshot.count} item(ns) -> ${label}`);
if (snapshot.error) console.warn(`[catalog] ${snapshot.error}`);
