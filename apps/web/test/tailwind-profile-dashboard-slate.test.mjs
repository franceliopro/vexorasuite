import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const read = (file) => fs.readFileSync(new URL(`../${file}`, import.meta.url), "utf8");

const paths = {
  profile: "src/app/contact-profile-panel.tsx",
  dashboard: "src/app/dashboard-widgets.tsx",
  onboarding: "src/app/onboarding-checklist.tsx",
  quote: "src/app/catalog-quote-panel.tsx",
};
const sources = Object.fromEntries(
  Object.entries(paths).map(([key, file]) => [key, read(file)]),
);

/** Literais completas, inclusive dentro de mapas Record<string,string>. */
function literals(text) {
  const values = [];
  for (const match of text.matchAll(/(['"])([^'"]*)\1/g)) values.push(match[2]);
  return values;
}

function collectClassConstants(source) {
  const constants = new Map();
  for (const match of source.matchAll(/\bconst\s+([A-Za-z_$][\w$]*)\s*(?::[^=;]+)?=\s*"([^"]*)"/g)) {
    constants.set(match[1], match[2]);
  }
  for (const match of source.matchAll(/\bconst\s+([A-Za-z_$][\w$]*)\s*(?::[^=;]+)?=\s*\{([\s\S]*?)\};/g)) {
    const values = literals(match[2]);
    if (values.length) constants.set(match[1], values.join(" "));
  }
  return constants;
}

function classTokens(source) {
  const constants = collectClassConstants(source);
  const values = [];
  for (const match of source.matchAll(/className\s*=\s*(?:"([^"]*)"|\{([\s\S]*?)\})/g)) {
    if (match[1] !== undefined) {
      values.push(match[1]);
      continue;
    }
    values.push(...literals(match[2]));
    for (const id of match[2].matchAll(/\b([A-Za-z_$][\w$]*)\b/g)) {
      if (constants.has(id[1])) values.push(constants.get(id[1]));
    }
  }
  return values.join(" ").split(/\s+/).filter(Boolean);
}

const tokens = Object.fromEntries(
  Object.entries(sources).map(([key, source]) => [key, classTokens(source)]),
);
const allTokens = Object.values(tokens).flat();
const allClassText = allTokens.join(" ");

const allowedVariants = new Set([
  // Variantes legadas mantidas apenas como breakpoint, nunca como classe componente.
  "ib-narrow", "ov-laptop", "rw-laptop", "max-md",
  "sm", "md", "lg", "xl", "2xl",
  "hover", "focus", "focus-visible", "focus-within", "active", "disabled",
  "placeholder", "group-hover", "peer-checked", "dark",
]);
const legacyPrefix = /(?:^|-)(?:ov|vx|ib|rw|auth|alarm|platform-admin|vx-rich|vx-post|vx-gallery|design-approval)-/;
const legacyExact = new Set([
  "content-card", "settings-card", "primary-button", "secondary-button",
  "text-button", "icon-button", "vx-spin",
]);

test("as quatro fatias não usam classes componente legadas", () => {
  for (const [key, list] of Object.entries(tokens)) {
    for (const token of list) {
      const segments = token.split(":");
      const base = segments.pop();
      for (const variant of segments) {
        assert.ok(allowedVariants.has(variant), `${key}: variante não autorizada ${variant}`);
      }
      assert.equal(legacyPrefix.test(base), false, `${key}: classe legada ${token}`);
      assert.equal(legacyExact.has(base), false, `${key}: classe legada ${token}`);
    }
  }
});

test("a auditoria por regex confirma que os tokens proibidos saíram dos quatro arquivos", () => {
  const anywhere = /(?:^|[-:"'\s])((?:ov|vx|ib|rw|auth|alarm|platform-admin|vx-rich|vx-post|vx-gallery|design-approval)-[a-z][a-z0-9-]*)(?=[-:"'\s]|$)/g;
  const exceptions = new Set(["ib-narrow", "ov-laptop", "rw-laptop"]);
  for (const [key, source] of Object.entries(sources)) {
    const hits = [...source.matchAll(anywhere)]
      .map((match) => match[1])
      .filter((token) => !exceptions.has(token));
    assert.deepEqual([...new Set(hits)], [], `${path.basename(paths[key])}: tokens legados ${hits.join(", ")}`);
    for (const exact of legacyExact) {
      assert.doesNotMatch(source, new RegExp(`\\b${exact}\\b`), `${key}: classe legada ${exact}`);
    }
  }
});

test("não há valores arbitrários, hex, !important, @apply ou color-mix", () => {
  for (const [key, source] of Object.entries(sources)) {
    for (const forbidden of [
      /!important/, /@apply\b/, /@tailwind\s+base\b/, /color-mix\(/,
      /\[[a-z-]+:\s*[^]\s]+\]/,
    ]) {
      const match = source.match(forbidden);
      assert.equal(match, null, `${key}: remendo visual ${match?.[0]}`);
    }
    for (const token of tokens[key]) {
      assert.ok(!/[[\]]/.test(token), `${key}: valor arbitrário ${token}`);
      assert.ok(!/#[0-9a-fA-F]{3,8}\b/.test(token), `${key}: hex em classe ${token}`);
    }
    for (const match of source.matchAll(/className=\{`([\s\S]*?)`\}/g)) {
      assert.doesNotMatch(match[1], /\$\{/, `${key}: className montada por interpolação`);
    }
  }
});

test("as superfícies escuras são slate real, nunca blue-dark", () => {
  assert.match(allClassText, /\bbg-slate-900\b/);
  assert.match(allClassText, /\bbg-slate-800\b/);
  assert.match(allClassText, /\bborder-slate-700\b/);
  assert.match(allClassText, /\btext-slate-50\b/);
  assert.match(allClassText, /\btext-slate-300\b/);
  assert.doesNotMatch(allClassText, /\b(?:bg|border|text)-(?:blue|indigo)-(?:900|950)\b/);
  for (const [key, list] of Object.entries(tokens)) {
    assert.ok(
      list.some((token) => /^(?:dark:)?(?:bg|border)-slate-\d+/.test(token)),
      `${key}: falta superfície slate`,
    );
  }
});

test("o perfil preserva testids, abas, endpoints e ações", () => {
  const source = sources.profile;
  for (const marker of [
    'data-testid="contact-profile"',
    'data-collapsed={expanded ? "false" : "true"}',
    'data-bare={bare ? "true" : "false"}',
    'data-testid="contact-profile-heading"',
    'data-testid="contact-profile-identity"',
    'aria-label={expanded ? "Recolher ficha" : "Expandir ficha"}',
    'aria-label="Tag do contato"', 'aria-label="Adicionar tag cadastrada"',
    'aria-label="Tags do contato"', 'aria-label={"Remover " + tag.name}',
    'role="alert"', 'onExpandedChange(!expanded)', 'tagForeground(tag.color)',
    '/api/backend/contacts/', '/identities/rebind', '/history',
    '/profile-config', '/api/backend/tasks', 'save()',
    'Dados', 'Anotações', 'Protocolos', 'Procedimentos', 'Salvar ficha',
    'Concluir', 'Alterar', 'Vincular novo canal', 'Criar campo',
    'Campos personalizados', 'Identidades de atendimento', 'Origem do lead',
    'Calendário e cobrança', 'Procedimentos do cliente',
    'Nenhuma identidade sincronizada ainda.',
    'Nenhuma conversa registrada para este contato.',
    'Nenhum procedimento personalizado registrado para este cliente.',
  ]) {
    assert.ok(source.includes(marker), `contact-profile-panel perdeu ${marker}`);
  }
  assert.equal((source.match(/aria-pressed=\{tab ===/g) ?? []).length, 4);
  assert.equal((source.match(/data-testid="/g) ?? []).length, 3);
  assert.equal((source.match(/role="alert"/g) ?? []).length, 1);
});

test("dashboard, checklist e orçamento preservam contratos e textos e2e", () => {
  const dashboard = sources.dashboard;
  for (const marker of [
    'aria-label="Relógio e data de hoje"', 'aria-label="Clima agora"',
    'aria-label="Calendário"', 'aria-label="Seu dia agora"',
    'aria-label="Definir local do clima"', 'aria-label="Cidade para o clima"',
    'aria-label="Mês anterior"', 'aria-label="Próximo mês"',
    'dateTime={now.toISOString()}', 'role="grid"', 'role="columnheader"',
    'role="gridcell"', 'window.setInterval', 'window.localStorage',
    '/api/backend/auth/organization', 'geocoding-api.open-meteo.com',
    'api.open-meteo.com/v1/forecast', 'vx:weather-city', 'vx:weather-bg',
    'aria-label="Alterar fundo do clima"', 'weatherFor',
    'saveCity', 'setCursor', 'Boa noite', 'Bom dia', 'Buscando o tempo…',
  ]) {
    assert.ok(dashboard.includes(marker), `dashboard-widgets perdeu ${marker}`);
  }

  const onboarding = sources.onboarding;
  for (const marker of [
    'aria-label="Primeiros passos na Véxora"',
    'aria-label="Dispensar checklist"', 'stepIconTw',
    'vexora:onboarding-dismissed', 'doneCount', 'allDone',
    'onNavigate(step.target)', 'disabled={step.loading}', 'Configurar',
    'Complete os Dados da empresa', 'Conecte seu WhatsApp ou Instagram',
    'Convide sua equipe', 'Gere o primeiro orçamento',
    'Bem-vindo à Véxora — primeiros passos',
  ]) {
    assert.ok(onboarding.includes(marker), `onboarding-checklist perdeu ${marker}`);
  }

  const quote = sources.quote;
  for (const marker of [
    'data-testid="catalog-quote-panel"', 'data-testid="catalog-quote-error"',
    'data-testid="catalog-quote-notice"', 'data-testid="catalog-quote-list"',
    'data-testid="catalog-quote-item"', 'data-testid="catalog-quote-qty-btn"',
    'role="alert"', 'role="status"',
    'aria-label="Buscar produto ou serviço"',
    'aria-label={qty > 0 ? "Diminuir" : "Adicionar"}',
    '/api/backend/catalog?q=', '/api/backend/documents/generate',
    '/api/backend/documents/${data.document.id}/send-whatsapp',
    'onNotice?.(', 'setTimeout(onClose, 1500)', 'money(total)',
    'Selecione ao menos um item do catálogo.', 'Carregando…',
    'Adicionar', 'Diminuir', 'Gerar e enviar orçamento',
  ]) {
    assert.ok(quote.includes(marker), `catalog-quote-panel perdeu ${marker}`);
  }
});
