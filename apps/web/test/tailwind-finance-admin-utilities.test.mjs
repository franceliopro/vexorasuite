import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

/** Guard puro (sem jsdom) da fatia Financeiro + painel da plataforma. */
const read = (file) => fs.readFileSync(new URL(`../${file}`, import.meta.url), "utf8");
const finance = read("src/app/finance-workspace.tsx");
const admin = read("src/app/platform-admin-workspace.tsx");
const sources = [
  ["finance-workspace.tsx", finance],
  ["platform-admin-workspace.tsx", admin],
];

/** Classes efetivas: literais de JSX, constantes TW e mapas Record<string,string>. */
function classValues(source) {
  const constants = new Map();
  for (const match of source.matchAll(/\bconst\s+([A-Za-z_$][\w$]*)\s*=\s*"([^"]*)"/g)) {
    constants.set(match[1], [match[2]]);
  }
  const resolve = (expression) => {
    const text = expression.trim();
    if (/^"[^"]*"$/.test(text)) return [text.slice(1, -1)];
    if (constants.has(text)) return constants.get(text);
    const parts = text.split("+").map((part) => part.trim());
    if (parts.length > 1) return parts.flatMap(resolve);
    return [];
  };
  for (const match of source.matchAll(/\bconst\s+([A-Za-z_$][\w$]*)\s*:\s*Record<string,string>\s*=\s*\{([^}]*)\}/g)) {
    constants.set(match[1], [...match[2].matchAll(/(?:["']?)([A-Za-z_$][\w$]*)(?:["']?)\s*:\s*([^,}]+)/g)]
      .flatMap((entry) => resolve(entry[2])));
  }
  const values = [];
  for (const match of source.matchAll(/className\s*=\s*(?:"([^"]*)"|\{([\s\S]*?)\})/g)) {
    if (match[1] !== undefined) {
      values.push(match[1]);
      continue;
    }
    for (const literal of match[2].matchAll(/(["'])([^"']*)\1/g)) values.push(literal[2]);
    for (const id of match[2].matchAll(/\b([A-Za-z_$][\w$]*)\b/g)) {
      if (constants.has(id[1])) values.push(...constants.get(id[1]));
    }
  }
  return values.join("\n");
}

const financeClasses = classValues(finance);
const adminClasses = classValues(admin);

test("a fatia não usa tokens de classe legados", () => {
  const forbidden = [
    /^ov-(?!laptop:)[a-z0-9-]+/,
    /^vx-[a-z0-9-]+/,
    /^ib-(?!narrow:)[a-z0-9-]+/,
    /^rw-(?!laptop:)[a-z0-9-]+/,
    /^(?:auth|alarm|platform-admin|vx-rich|vx-post|vx-gallery|design-approval)-[a-z0-9-]+/,
    /^(?:content-card|settings-card|primary-button|secondary-button|text-button|icon-button|vx-spin)$/,
  ];
  for (const [name, classes] of [
    ["finance-workspace.tsx", financeClasses],
    ["platform-admin-workspace.tsx", adminClasses],
  ]) {
    for (const token of classes.split(/\s+/).filter(Boolean)) {
      for (const pattern of forbidden) {
        assert.equal(pattern.test(token), false, `${name}: classe legada ${token}`);
      }
    }
  }
});

test("as classes são literais completas, sem remendos visuais", () => {
  for (const [name, classes] of [
    ["finance-workspace.tsx", financeClasses],
    ["platform-admin-workspace.tsx", adminClasses],
  ]) {
    for (const pattern of [
      /\[[a-z-]+:\s*[^]\s]+\]/,
      /#[0-9a-fA-F]{3,8}\b/,
      /color-mix\(/,
      /!important/,
      /@apply/,
      /@tailwind\s+base/,
      /bg-(?:blue|indigo)-(?:800|900|950)\b/,
    ]) {
      assert.equal(pattern.test(classes), false, `${name}: remendo visual ${pattern.source}`);
    }
  }
});

test("os overlays e diálogos usam slate real", () => {
  for (const classes of [financeClasses, adminClasses]) {
    for (const utility of [
      "fixed inset-0 z-50 grid place-items-center bg-slate-900/80 p-4 backdrop-blur-sm",
      "max-h-dvh",
      "dark:border-slate-700",
      "dark:bg-slate-900",
      "dark:text-slate-50",
    ]) {
      assert.ok(classes.includes(utility), `falta a utility slate ${utility}`);
    }
  }
});

test("as janelas financeiras usam largura imponente", () => {
  for (const utility of ["max-w-fin-window", "max-w-fin-subscription"]) {
    assert.ok(financeClasses.includes(utility), `falta a utility ${utility}`);
  }
  assert.doesNotMatch(finance, /max-w-lg/);
  assert.doesNotMatch(finance, /max-w-fin-drawer/);
});

test("as exceções de breakpoint do Financeiro permanecem", () => {
  assert.ok(finance.includes("ov-laptop:grid-cols-fin-metrics-tablet"));
  assert.ok(finance.includes("ov-laptop:grid-cols-2"));
  assert.ok(financeClasses.includes("ov-laptop:grid-cols-fin-metrics-tablet"));
  assert.ok(financeClasses.includes("ov-laptop:grid-cols-2"));
});

test("os contratos funcionais das duas telas permanecem", () => {
  for (const marker of [
    'fetch("/api/backend/finance/portfolio?"',
    'fetch("/api/backend/finance/executive?"',
    'fetch("/api/backend/finance/subscriptions"',
    'link.download="cobrancas-filtro-pagina.csv"',
    'role="dialog" aria-modal="true" aria-labelledby="new-sub-title"',
    '<h2 id="new-sub-title">Nova assinatura</h2>',
    'role="dialog" aria-modal="true" aria-label="Preparar cobrança"',
    '<span>Produto/serviço do catálogo *</span>',
    'const body:Record<string,unknown>={catalogItemId:selectedItem!.id',
    'aria-labelledby="confirm-delete-title"',
    'EXCLUIR',
    'data-tone={item.tone}',
    'data-selected={customerId===item.id?"true":"false"}',
    'aria-pressed={rangeMode==="preset"&&months===n}',
    'aria-label="Áreas do Financeiro"',
    "Array.from({length:100}",
  ]) {
    assert.ok(finance.includes(marker), `o financeiro perdeu ${marker}`);
  }
  for (const marker of [
    'role="tablist"',
    "aria-selected={tab === \"plans\"}",
    'aria-label="Arquivar plano"',
    'aria-label="Abrir empresa"',
    'role="group" aria-label="Módulos liberados"',
    "PLAN_PRESETS",
    "LIMIT_FIELDS",
    "assignPlan(c.id, e.target.value || null)",
    "createPortal(",
    "document.body",
    "zIndex: 2100",
    "minWidth: 820",
  ]) {
    assert.ok(admin.includes(marker), `o admin perdeu ${marker}`);
  }
  assert.equal((admin.match(/role="presentation"/g) ?? []).length, 2);
  assert.equal((admin.match(/aria-label="Fechar"/g) ?? []).length, 2);
});
