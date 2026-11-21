import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const approval = read("src/app/design-approval/[token]/page.tsx");
const styles = read("src/app/vexora.css");

function classValues(source) {
  const constants = new Map();
  for (const match of source.matchAll(/\bconst\s+([A-Za-z_$][\w$]*)\s*=\s*"([^"]*)"/g)) {
    constants.set(match[1], match[2]);
  }
  const values = [];
  for (const match of source.matchAll(/className\s*=\s*(?:"([^"]*)"|\{([\s\S]*?)\})/g)) {
    if (match[1] !== undefined) {
      values.push(match[1]);
      continue;
    }
    for (const literal of match[2].matchAll(/(["'])([^"']*)\1/g)) values.push(literal[2]);
    for (const [name, value] of constants) {
      if (new RegExp(`\\b${name}\\b`).test(match[2])) values.push(value);
    }
  }
  return values.join("\n");
}

const classes = classValues(approval);
const tokens = classes.split(/\s+/).filter(Boolean);

test("a aprovacao publica nao usa classes componente decorativas", () => {
  for (const token of tokens) {
    assert.equal(
      /^(?:design-approval-|sites-field-label$|is-checked$|primary-button$|secondary-button$|danger-button$|vx-spin$)/.test(token),
      false,
      `classe decorativa no JSX: ${token}`,
    );
  }
  assert.doesNotMatch(approval, /className="design-approval-/);
  assert.doesNotMatch(approval, /" is-checked"/);
  assert.doesNotMatch(styles, /\.design-approval-/, "o CSS legado da aprovacao publica nao pode voltar");
});

test("a aprovacao publica usa so utilities, sem remendos", () => {
  for (const forbidden of [
    /\[[a-z-]+:\s*[^]\s]+\]/,
    /#[0-9a-fA-F]{3,8}\b/,
    /color-mix\(/,
    /!important/,
    /@apply/,
    /@tailwind\s+base/,
  ]) {
    const match = classes.match(forbidden);
    assert.equal(match, null, `remendo visual encontrado: ${match?.[0]}`);
  }
  for (const utility of [
    "min-h-dvh place-items-center bg-surface-page p-4 text-ink",
    "rounded-token-lg border border-line bg-surface p-4",
    "grid w-full grid-cols-2 justify-items-center gap-3 sm:grid-cols-3",
    "border-blue-600 bg-blue-50 text-ink",
    "border-line bg-surface-2 text-ink-secondary hover:border-line-strong",
    "rounded-token-sm border border-red-600 bg-red-100 p-3 text-body font-semibold text-danger",
  ]) {
    assert.ok(classes.includes(utility), `falta a utility ${utility}`);
  }
});

test("os contratos da aprovacao publica permanecem intactos", () => {
  for (const token of [
    "/api/backend/public/design-approvals/", "/slide/", 'role="status"', 'role="alert"',
    "Rejeitar", "Aprovar e publicar agora", "Aprovar (publicar no sistema)",
    "Publicado com sucesso nas contas escolhidas!", "Design rejeitado.",
    "Nenhuma rede Zernio conectada ainda", "Já publicado", "Legenda da publicação",
    "selected[c.id]", "Object.values(selected).every(v => !v)", "publishNow", "animate-spin",
  ]) {
    assert.ok(approval.includes(token), `aprovacao perdeu ${token}`);
  }
});
