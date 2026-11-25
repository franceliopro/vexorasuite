import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

const panel = read("src/app/site-submissions-panel.tsx");
const workspace = read("src/app/sites-workspace.tsx");

test("o painel de anúncios fica na Aba Sites e usa apenas a API da plataforma", () => {
  assert.ok(workspace.includes('import { SiteSubmissionsPanel } from "./site-submissions-panel";'));
  assert.ok(workspace.includes("<SiteSubmissionsPanel canManage={canManage} />"));
  assert.ok(panel.includes("`/api/backend/sites/hub/submissions"));
  assert.ok(!panel.includes("DIRECTUS_TOKEN"));
  assert.ok(!panel.includes("DIRECTUS_URL"));
});

test("a rejeição exige motivo e a decisão não afirma envio", () => {
  for (const token of [
    "Motivo (obrigatório para rejeitar)",
    "disabled={busy || !reason.trim()}",
    "Decisão registrada na Véxora. Envio ao anunciante ainda não confirmado.",
    "o Directus cria o imóvel e notifica o anunciante",
    'role="status"',
    'role="alert"',
    "animate-spin",
    "Tentar novamente",
  ]) {
    assert.ok(panel.includes(token), `o painel perdeu ${token}`);
  }
});

test("o painel usa apenas utilities do preset", () => {
  for (const forbidden of [
    /\[[a-z-]+:\s*[^]\s]+\]/,
    /#[0-9a-fA-F]{3,8}\b/,
    /color-mix\(/,
    /!important/,
    /@apply/,
  ]) {
    const match = panel.match(forbidden);
    assert.equal(match, null, `remendo visual encontrado: ${match?.[0]}`);
  }
});
