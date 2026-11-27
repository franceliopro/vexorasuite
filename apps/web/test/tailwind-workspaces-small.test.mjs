import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const read = (file) => fs.readFileSync(new URL(`../${file}`, import.meta.url), "utf8");

const paths = {
  operations: "src/app/operations-settings.tsx",
  crm: "src/app/crm-workspace.tsx",
  fields: "src/app/custom-fields-settings.tsx",
  domain: "src/app/sites-domain-config.tsx",
};
const sources = Object.fromEntries(
  Object.entries(paths).map(([key, file]) => [key, read(file)]),
);
const theme = read("src/app/theme.css");
const all = Object.values(sources).join("\n");

/** Literais de className e as constantes TW referenciadas por className são classes. */
function classTokens(source) {
  const values = [];
  for (const match of source.matchAll(/\bconst\s+[A-Za-z_$][\w$]*\s*=\s*"([^"]*)"/g)) values.push(match[1]);
  for (const match of source.matchAll(/className\s*=\s*(?:"([^"]*)"|\{([\s\S]*?)\})/g)) {
    if (match[1] !== undefined) values.push(match[1]);
    for (const literal of (match[2] ?? "").matchAll(/(["'])([^"']*)\1/g)) values.push(literal[2]);
  }
  /* Hex dentro de helpers (wcagRatio) é cor de dado, não classe. */
  return values.join(" ").split(/\s+/).filter((token) => token && !/^#[0-9a-fA-F]{3,8}$/.test(token));
}
const tokens = Object.fromEntries(
  Object.entries(sources).map(([key, source]) => [key, classTokens(source)]),
);
const allTokens = Object.values(tokens).flat();
const allClassText = allTokens.join(" ");

/** Variantes TW: padrão do utilitário ou @custom-variant declarado no preset. */
const customVariants = new Set(
  [...theme.matchAll(/@custom-variant\s+([a-z][\w-]*)/g)].map((match) => match[1]),
);
const standardVariants = new Set([
  "dark", "hover", "focus", "focus-visible", "active", "disabled", "print",
  "motion-reduce", "motion-safe",
  "placeholder", "group-hover", "peer-hover", "last", "first", "odd", "even",
  "sm", "md", "lg", "xl", "2xl", "max-md",
  /* Variantes explicitamente permitidas para estes workspaces. */
  "ib-narrow", "ov-laptop", "rw-laptop",
]);

const legacyPrefix = /^(?:ov|vx|ib|rw|auth|alarm|platform-admin|vx-rich|vx-post|vx-gallery|design-approval)-[a-z][a-z0-9-]*$/;
const legacyEmbedded = /(?:^|-)(?:ov|vx|ib|rw|auth|alarm|platform-admin)-[a-z][a-z0-9-]*$/;
const legacyExact = new Set([
  "content-card", "settings-card", "primary-button", "secondary-button",
  "text-button", "icon-button", "vx-spin",
]);

test("os quatro workspaces não usam classes componente legadas", () => {
  for (const [key, list] of Object.entries(tokens)) {
    for (const token of list) {
      const segments = token.split(":");
      const utility = segments.at(-1);
      for (const variant of segments.slice(0, -1)) {
        const base = variant.split("/")[0];
        assert.ok(
          customVariants.has(base) || standardVariants.has(base),
          `${key}: variante ${variant} não é uma variante TW`,
        );
      }
      assert.equal(legacyPrefix.test(utility), false, `${key}: classe legada ${token}`);
      assert.equal(legacyEmbedded.test(utility), false, `${key}: classe legada embutida ${token}`);
      assert.equal(legacyExact.has(utility), false, `${key}: classe legada ${token}`);
    }
  }
  assert.doesNotMatch(allClassText, /\b(?:content-card|settings-card|primary-button|secondary-button|text-button|icon-button|vx-spin)\b/);
});

test("as classes são literais TW completos, sem remendos visuais", () => {
  for (const forbidden of [
    /\[[a-z-]+:\s*[^]\s]+\]/,
    /!important/,
    /@apply/,
    /@tailwind\s+base/,
    /color-mix\(/,
  ]) {
    const match = allTokens.join("\n").match(forbidden) ?? all.match(forbidden);
    assert.equal(match, null, `remendo visual: ${match?.[0]}`);
  }
  const hexEmClasse = allTokens.filter((token) => /#[0-9a-fA-F]{3,8}/.test(token));
  assert.deepEqual(hexEmClasse, [], "hex direto em classe");
  /** Nenhuma classe é montada por template literal ou chamada de método. */
  for (const match of all.matchAll(/className=\{([\s\S]*?)\}/g)) {
    assert.doesNotMatch(match[1], /`|\.join\(|color-mix\(/, "className dinâmico sem literal completo");
  }
  /** As variantes de cor resolvem mapas Record<string,string> para literais completos. */
  for (const key of ["operations", "domain"]) {
    assert.match(sources[key], /Record<string,\s*string>/, `${key}: falta mapa de variantes TW`);
  }
  assert.match(sources.domain, /const statusPillClass = \(variant: string\) => statusPillVariantTw\[variant\] \?\? statusPillVariantTw\.muted;/);
  assert.match(sources.crm, /const stageTones = \{/);
  for (const utility of [
    "grid min-w-0 grid-cols-1 content-start gap-token",
    "rounded-token-sm border border-red-600 bg-red-100",
    "min-h-control items-center justify-center gap-2 rounded-token-sm bg-blue-600",
    "border border-gray-200 bg-zinc-100",
    "accent-blue-600",
    "grid-cols-cf-fields",
    "grid-cols-2 gap-2 p-0 list-none",
  ]) {
    assert.ok(allClassText.includes(utility), `falta a utility ${utility}`);
  }
});

test("o escuro é slate real e o verde comum virou azul", () => {
  assert.match(sources.operations, /border-slate-700 bg-slate-900/);
  assert.doesNotMatch(allClassText, /\b(?:bg|border)-(?:blue|indigo)-(?:900|950)\b/, "superfície azul escura no lugar de slate");
  assert.doesNotMatch(allClassText, /\bgreen-\d{3}\b/, "verde comum permaneceu");
  /** Verde de WhatsApp e verde de dados seguem em style/cor arbitrária, não em classe. */
  assert.match(sources.crm, /WhatsAppGlyph/);
  assert.match(sources.fields, /style=\{\{ backgroundColor: tag\.color, color: "#111827" \}\}/);
});

test("os contratos funcionais dos quatro workspaces permanecem", () => {
  const expected = {
    operations: [
      'role="tablist"', 'aria-label="Categorias de configuração"',
      'role="tabpanel"', 'aria-controls={"settings-panel-"+key}',
      'aria-labelledby={"settings-tab-"+key}', 'id={"settings-tab-"+key}',
      'id={"settings-panel-"+key}', 'role="alert"', 'role="status"',
      'aria-label="Fechar erro"', 'aria-label="Fechar aviso"',
      'aria-label="Código HEX da cor"',
      "onClick={()=>void verifyMail()}", "onClick={()=>void sendMailTest()}",
      "onClick={()=>void saveOrganization()}", "onClick={()=>void saveBrand()}",
      "onClick={()=>void saveGroups()}", "onClick={()=>void purgeTenant()}",
      "onClick={()=>void loadInitialSettings()}",
      "onClick={()=>void resetPlatformEnvironment(false)}",
      "onClick={()=>void deleteSelectedCompany()}",
      "applyBrandAll(next,document.documentElement.dataset.theme)",
      "wcagRatio(brand.sidebarBackground",
    ],
    crm: [
      'data-testid="crm-header"', 'data-testid="crm-command-bar"',
      'data-testid="crm-pipeline"', 'data-testid="crm-loading"',
      'data-testid="finalization-outcomes"', 'data-testid="finalization-outcome"',
      'htmlFor="crm-pipeline"', 'id="crm-pipeline"', 'id="crm-tabpanel"',
      'role="tablist"', 'aria-label="Visualização do CRM"',
      'aria-controls="crm-tabpanel"', 'aria-labelledby={`crm-tab-${view}`}',
      'role="group"', 'role="img"', 'data-outcome="WON"', 'data-outcome="LOST"',
      'data-selected={finalOutcome === "WON"}',
      "onSubmit={createContact}", "onDragStart={(event) => startDrag(event, contact)}",
      "onDrop={(event) => dropOnStage(event, stage.id)}",
      'data-testid="crm-drop-slot"', "data-crm-card-id={contact.id}",
      "onDrop={(event) => dropAtPosition(event, stage.id)}",
      'aria-label={"Subir " + contactName(contact) + " na etapa"}',
      'aria-label={"Descer " + contactName(contact) + " na etapa"}',
      "motion-reduce:animate-none",
      'data-testid="crm-order-saving"',
      "void confirmFinalization()", "void removeFromPipeline(contact)",
    ],
    fields: [
      'role="alert"', 'role="status"', 'type="color"',
      '"/api/backend/crm/custom-fields"', '"/api/backend/contacts/profile-config"',
      'method: "POST"', 'method: "PATCH"', 'method: "DELETE"',
      "onClick={() => void createTag()}", "onClick={() => void updateTag(tag)}",
      "onClick={() => void deleteTag(tag.id)}", "onClick={addField}",
      '<option value="TEXT">Texto</option>',
      'Campos personalizados salvos.', 'Tag criada no catálogo.',
    ],
    domain: [
      'role="region"', 'aria-label="Configuração de domínio próprio"',
      'aria-label="Etapas de configuração"', 'aria-label="Registros DNS"',
      'id="domain-error"', 'id="domain-hint"',
      'aria-describedby="domain-error domain-hint"', 'aria-invalid={!!domainError}',
      'role="progressbar"', "aria-valuenow={deployProgress}",
      "aria-valuemin={0}", "aria-valuemax={100}",
      'aria-label="Copiar valor do registro"', 'aria-label="Copiar destino CNAME"',
      "onClick={checkAndSetDomain}", "onClick={deploy}", "onClick={retry}",
      "onClick={onClose}", "onClick={() => copyRecord(rec.value)}",
      "onClick={() => copyRecord(CNAME_TARGET)}",
    ],
  };
  for (const [key, markers] of Object.entries(expected)) {
    for (const marker of markers) {
      assert.ok(sources[key].includes(marker), `${path.basename(paths[key])} perdeu ${marker}`);
    }
  }
});
