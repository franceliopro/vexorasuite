import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const read = (file) => fs.readFileSync(new URL(`../${file}`, import.meta.url), "utf8");

const crm = read("src/app/crm-workspace.tsx");
const config = read("tailwind.config.ts");

/** Formulário + Clientes/Contatos + diálogos; cabeçalho e Kanban têm guards próprios. */
const inicio = crm.indexOf('<section className="grid min-w-0 grid-cols-1 content-start gap-token">');
const meio = crm.indexOf('data-testid="crm-pipeline"');
const pipelineFim = crm.indexOf('view === "origins"', meio);
assert.ok(inicio >= 0 && meio > inicio && pipelineFim > meio, "as fatias do CRM não foram encontradas");
const migrado = crm.slice(inicio, meio) + crm.slice(pipelineFim);

/** Cores de tag são dados do contato, não remendos visuais. */
const semDados = migrado
  .replace(/style=\{\{[^}]*\}\}/g, "")
  .replace(/const color=tag\.color\|\|"#[0-9a-fA-F]{3,8}";/g, "");

/** O parser canônico não resolve constantes nem condicionais: resolvemos aqui. */
const constantes = Object.fromEntries(
  [...crm.matchAll(/^const (\w+(?:Tw|Button|ButtonMt)) = "([^"]*)";$/gm)].map((m) => [m[1], m[2]]),
);
const resolver = (termo) => constantes[termo] ?? termo.replace(/^"|"$/g, "");
const resolvido = semDados.replace(/className=\{([\s\S]*?)\}/g, (_, expr) => {
  const partes = expr.split("?").map((parte) => parte.trim());
  if (partes.length === 2) {
    const [sim, nao] = partes[1].split(":").map((parte) => resolver(parte.trim()));
    return ` className="${resolver(partes[0])} ${sim} ${nao}"`;
  }
  return ` className="${resolver(expr.trim())}"`;
});

/** Só as classes resolvidas — data-testid, ids e aria-* não são classes componente. */
const classes = [...resolvido.matchAll(/className="([^"]*)"/g)].map((m) => m[1]).join("\n");

/** Classes componente removidas desta fatia; sufixos crm, ov e ib do preset são utilities. */
const legadas = [
  "settings-workspace", "settings-feedback", "settings-card-heading", "settings-card",
  "settings-icon", "settings-field", "crm-form-grid", "crm-form-actions", "crm-form",
  "crm-contacts-card", "crm-customer-note", "crm-contact-list", "crm-contact-row-open",
  "crm-contact-row", "crm-contact-avatar", "crm-contact-main", "crm-social-line",
  "crm-contact-tags", "crm-custom-field-summary", "crm-card-meta", "crm-customer-origin",
  "crm-stage-pill", "crm-ficha-avatar", "crm-empty", "empty-state", "empty-illustration",
  "finalization-outcomes", "finalization-reason", "finalization-note",
  "primary-button", "secondary-button", "is-asaas", "is-pending", "tone-rose",
  "selected", "won", "lost",
];

test("a região restante do CRM não usa classes componente", () => {
  for (const classe of legadas) {
    const re = new RegExp(`(?<![\\w-])${classe.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?![\\w-])`);
    assert.equal(re.test(classes), false, `classe componente ${classe} permaneceu`);
  }
});

test("a fatia usa só utilities do preset, sem remendos", () => {
  for (const forbidden of [
    /\[[a-z-]+:\s*[^]\s]+\]/,
    /#[0-9a-fA-F]{3,8}\b/,
    /!important/,
    /@apply/,
  ]) {
    const match = resolvido.match(forbidden);
    assert.equal(match, null, `remendo visual encontrado: ${match?.[0]}`);
  }
  for (const utility of [
    "grid min-w-0 grid-cols-1 content-start gap-token",
    "rounded-token-sm border border-red-600 bg-red-100",
    "rounded-token-sm border border-emerald-600 bg-emerald-100",
    "grid-cols-crm-form",
    "h-crm-icon w-crm-icon",
    "rounded-crm-icon",
    "min-h-crm-outcome",
    'data-testid="finalization-outcomes"',
    'data-testid="finalization-outcome"',
    "grid grid-cols-2 gap-2.5",
  ]) {
    assert.ok(resolvido.includes(utility), `falta a utility ${utility}`);
  }
});

test("feedback, formulário, lista e diálogos preservam os contratos", () => {
  for (const hook of [
    'role="alert"', 'role="status"',
    'aria-label="Fechar erro"', 'aria-label="Fechar aviso"',
    'id="crm-tabpanel"', 'role="tabpanel"',
  ]) {
    assert.ok(crm.includes(hook), `perdeu ${hook}`);
  }
  for (const label of [
    'aria-label={"Abrir ficha de " + contactName(contact)}',
    'aria-label={"Etapa de " + contactName(contact)}',
    'data-outcome="WON"', 'data-outcome="LOST"',
    'data-selected={finalOutcome === "WON"}',
    'data-selected={finalOutcome === "LOST"}',
  ]) {
    assert.ok(migrado.includes(label), `perdeu ${label}`);
  }
  assert.ok(migrado.includes("onSubmit={createContact}"));
  assert.ok(migrado.includes("void moveContact(contact, event.target.value as CrmStage)"));
  assert.ok(migrado.includes("void confirmFinalization()"));
  assert.ok(crm.includes("void removeFromPipeline(contact)"));
});

test("as medidas da fatia vivem no preset", () => {
  for (const token of [
    '"crm-icon": "34px"',
    '"crm-ficha-avatar": "42px"',
    '"crm-outcome": "76px"',
    '"crm-icon": "9px"',
    '"crm-field": "11px"',
    '"crm-form": "repeat(auto-fit, minmax(240px, 1fr))"',
    '"crm-form": "920px"',
  ]) {
    assert.ok(config.includes(token), `o preset deve expor ${token}`);
  }
});
