import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const read = (file) => fs.readFileSync(new URL(`../${file}`, import.meta.url), "utf8");
const source = read("../api/src/operations/lead-attribution-normalizer.ts");
const spec = read("../api/src/operations/lead-attribution-normalizer.spec.ts");
const contract = read("../../docs/lead-attribution-normalization-contract.md");
const foundation = read("../../docs/lead-attribution-foundation.md");

const escape = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

test("o normalizador é puro: sem importações, rede, relógio, aleatoriedade ou persistência", () => {
  assert.match(source, /export function normalizeAttribution/);
  assert.doesNotMatch(source, /^\s*import\s/m);
  assert.doesNotMatch(source, /require\s*\(/);

  for (const forbidden of [
    "fetch(",
    "XMLHttpRequest",
    "axios",
    "prisma",
    "PrismaClient",
    "Date.now",
    "new Date",
    "Math.random",
    "process.env",
    "window.",
    "document.",
    "fs.",
    "create(",
    "update(",
    "save(",
  ]) {
    assert.doesNotMatch(source, new RegExp(escape(forbidden)), `efeito colateral não permitido: ${forbidden}`);
  }
});

test("a saída nunca inventa campanha, primeiro toque ou origem", () => {
  assert.match(source, /UNKNOWN_ORIGIN = "unknown"/);
  assert.match(source, /campaignId: null/);
  assert.match(source, /firstTouchAt: null/);
  assert.match(source, /result\.origin = result\.source \?\? UNKNOWN_ORIGIN/);
  assert.match(source, /CLICK_ID_KEYS = \["gclid", "fbclid", "msclkid", "ttclid", "dclid"\]/);
  assert.match(source, /MAX_VALUE_LENGTH = 200/);
});

test("os testes da API cobrem os limites do contrato", () => {
  for (const phrase of [
    "origem desconhecida",
    "não infere campanha",
    "primeira ocorrência",
    "valores excessivos",
    "URLSearchParams",
    "entradas inválidas",
  ]) {
    assert.match(spec, new RegExp(escape(phrase)), `cenário ausente: ${phrase}`);
  }
});

test("o documento declara o escopo e o que fica de fora", () => {
  for (const phrase of [
    "Nenhum dado é gravado",
    "Nenhum envio",
    "Nenhuma IA",
    "Nenhum scraping",
    "origem desconhecida",
    "canal de atendimento",
    "chave canônica",
    "default-deny",
  ]) {
    assert.match(contract, new RegExp(escape(phrase), "i"), `cláusula ausente: ${phrase}`);
  }
  assert.match(foundation, /normalizador puro/);
  assert.match(foundation, /lead-attribution-normalization-contract\.md/);
});
