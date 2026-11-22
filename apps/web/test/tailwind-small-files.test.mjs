import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = new URL("../", import.meta.url);
const read = (file) => fs.readFileSync(new URL(file, root), "utf8");

const files = [
  "src/app/alarm-center.tsx",
  "src/app/dashboard-widgets.tsx",
  "src/app/contact-profile-panel.tsx",
  "src/app/inboxes-management.tsx",
];
const sources = new Map(files.map((file) => [file, read(file)]));
const theme = read("src/app/theme.css");

const label = (file) => path.basename(file);

/** Strings literais (incluindo trechos fora de ${} em templates), sem precisar de node:url. */
function literals(text) {
  const values = [];
  for (const match of text.matchAll(/(['"])([^'"]*)\1/g)) values.push(match[2]);
  for (const match of text.matchAll(/`([^`]*)`/g)) {
    values.push(match[1].replace(/\$\{[\s\S]*?\}/g, " "));
  }
  return values;
}

/**
 * Resolve constants TW, Record<string,string> e helpers de array para que a
 * verificação veja as classes efetivamente aplicadas, não só o nome da variável.
 */
function collectClassConstants(source) {
  const constants = new Map();

  for (const match of source.matchAll(/\bconst\s+([A-Za-z_$][\w$]*)\s*(?::[^=;]+)?=\s*"([^"]*)"/g)) {
    constants.set(match[1], match[2]);
  }

  for (const match of source.matchAll(/\bconst\s+([A-Za-z_$][\w$]*)\s*(?::[^=;]+)?=\s*\{([\s\S]*?)\};/g)) {
    const values = literals(match[2]);
    if (values.length) constants.set(match[1], values.join(" "));
  }

  const arrays = new Map();
  for (const match of source.matchAll(/\bconst\s+([A-Za-z_$][\w$]*)\s*(?::[^=;]+)?=\s*\[([\s\S]*?)\];/g)) {
    arrays.set(match[1], literals(match[2]).join(" "));
  }
  for (const match of source.matchAll(/\b([A-Za-z_$][\w$]*)\.push\(([^)]*)\)/g)) {
    if (arrays.has(match[1])) {
      arrays.set(match[1], `${arrays.get(match[1])} ${literals(match[2]).join(" ")}`);
    }
  }
  for (const [name, value] of arrays) constants.set(name, value);

  return constants;
}

/** Apenas literais completas e identificadores resolvidos entram em className. */
function classValues(source) {
  const constants = collectClassConstants(source);
  const values = [];

  for (const match of source.matchAll(/className\s*=\s*(?:"([^"]*)"|\{([\s\S]*?)\})/g)) {
    if (match[1] !== undefined) {
      values.push(match[1]);
      continue;
    }
    const expression = match[2];
    values.push(literals(expression).join(" "));
    for (const id of expression.matchAll(/\b([A-Za-z_$][\w$]*)\b/g)) {
      if (constants.has(id[1])) values.push(constants.get(id[1]));
    }
  }

  return values.join(" ");
}

const classTokens = new Map(files.map((file) => [file, classValues(sources.get(file)).split(/\s+/).filter(Boolean)]));
const allClassText = [...classTokens.values()].flat().join(" ");

const customVariants = new Set(
  [...theme.matchAll(/@custom-variant\s+([a-z0-9-]+)/g)].map((match) => match[1]),
);
const allowedVariants = new Set([
  ...customVariants,
  // Explicitamente permitidas mesmo que o tema mude.
  "ib-narrow",
  "ov-laptop",
  "rw-laptop",
  // Variante built-in registrada em overview.css para a cascata da Visão geral.
  "max-md",
  // Variantes padrão Tailwind usadas pelos quatro arquivos.
  "sm", "md", "lg", "xl", "2xl", "3xl", "4xl",
  "hover", "focus", "focus-visible", "focus-within", "active", "disabled",
  "visited", "checked", "indeterminate", "first", "last", "odd", "even",
  "only", "empty", "required", "valid", "invalid", "open", "closed",
  "target", "default", "autofill", "read-only", "group-hover", "group-focus",
  "group-focus-visible", "group-active", "peer-hover", "peer-focus",
  "peer-checked", "peer-disabled", "before", "after", "placeholder",
  "selection", "file", "marker", "first-letter", "first-line", "dark",
  "ltr", "rtl", "motion-safe", "motion-reduce", "print", "portrait",
  "landscape",
]);

const legacyPrefixes = [
  "ov", "vx", "ib", "rw", "auth", "alarm", "platform-admin", "design-approval",
];
const legacyExact = new Set([
  "content-card", "settings-card", "primary-button", "secondary-button",
  "text-button", "icon-button", "vx-spin",
]);
const greenUtility = /^(?:bg|text|border|from|via|to|ring|fill|stroke|accent|decoration|divide|placeholder|shadow|outline)-(?:green|emerald|lime|teal)-/;

test("os quatro arquivos não usam classes componente legadas", () => {
  for (const [file, tokens] of classTokens) {
    for (const token of tokens) {
      const segments = token.split(":");
      for (const variant of segments.slice(0, -1)) {
        assert.ok(allowedVariants.has(variant), `${label(file)}: variante não autorizada ${variant}`);
      }
      const base = segments[segments.length - 1];
      for (const prefix of legacyPrefixes) {
        assert.ok(
          !base.startsWith(`${prefix}-`),
          `${label(file)}: classe componente legada ${token}`,
        );
      }
      assert.ok(!legacyExact.has(base), `${label(file)}: classe componente legada ${token}`);
    }
  }
});

test("não há remendos visuais, arbitrários, hex, verde comum nem utilities quebradas", () => {
  for (const [file, source] of sources) {
    for (const forbidden of [/@apply\b/, /@tailwind\s+base\b/, /color-mix\(/, /!important/]) {
      const match = source.match(forbidden);
      assert.equal(match, null, `${label(file)}: remendo visual ${match?.[0]}`);
    }
    for (const token of classTokens.get(file)) {
      assert.ok(!/[[\]]/.test(token), `${label(file)}: valor arbitrário ${token}`);
      assert.ok(!/#[0-9a-fA-F]{3,8}\b/.test(token), `${label(file)}: hex em classe ${token}`);
      assert.ok(!greenUtility.test(token), `${label(file)}: verde comum ${token}`);
    }
  }
});

test("classes de estado são literais completas, nunca interpolação solta", () => {
  for (const [file, source] of sources) {
    const templates = [...source.matchAll(/className=\{`([\s\S]*?)`\}/g)];
    assert.equal(templates.length, 0, `${label(file)}: className com template interpolado`);
  }
});

test("os quatro arquivos mantêm as utilities Tailwind reconhecidas", () => {
  const required = {
    "src/app/alarm-center.tsx": [
      "fixed inset-0 grid place-items-center bg-slate-900/90 p-5 backdrop-blur-md",
      "max-h-phone-frame", "max-w-calendar-event-modal",
      "bg-linear-to-br from-slate-800 to-slate-900", "size-26",
      "grid w-full gap-4.5", "min-h-14 items-center justify-center gap-2.5 rounded-fin-figure",
      "border-slate-700", "bg-slate-800", "text-slate-200", "bg-slate-700", "text-slate-50",
      "shadow-token-sm", "shadow-token-lg",
    ],
    "src/app/dashboard-widgets.tsx": [
      "grid grid-cols-12 gap-4 max-md:grid-cols-1",
      "col-span-3", "col-span-4", "col-span-5", "max-md:col-span-12",
      "bg-linear-to-br from-sky-500 via-blue-500 to-indigo-600",
      "bg-linear-to-br from-indigo-50 to-blue-100",
      "bg-linear-to-br from-violet-50 to-blue-100",
      "rounded-2xl border border-white/40", "bg-white/20", "text-slate-50",
      "text-blue-200", "text-slate-100", "text-slate-300",
      "bg-blue-600", "text-amber-300", "grid-cols-7",
      "role=\"grid\"",
    ],
    "src/app/contact-profile-panel.tsx": [
      "w-13", "h-12 w-12",
      "grid-cols-2", "max-w-md", "bg-linear-to-br from-blue-600 to-blue-800",
      "text-fuchsia-400", "lg:grid-cols-2", "bg-slate-800", "text-blue-200",
      "border-red-700", "bg-red-900/40", "text-red-200", "rounded-xl",
    ],
    "src/app/inboxes-management.tsx": [
      "grid min-w-0 gap-3 rounded-xl border border-gray-200 bg-zinc-50 p-4 shadow-token-sm",
      "grid-cols-1 gap-3 xl:grid-cols-2", "grid-cols-3", "sm:grid-cols-2",
      "lg:grid-cols-4", "rounded-2xl", "bg-zinc-100", "bg-zinc-200",
      "text-slate-950", "text-slate-600", "bg-blue-50", "text-blue-800",
      "to-blue-700", "text-blue-700", "border-red-600", "bg-red-100", "border-amber-600",
      "bg-amber-100", "text-amber-600",
    ],
  };

  for (const [file, utilities] of Object.entries(required)) {
    const source = sources.get(file);
    const values = classValues(source);
    for (const utility of utilities) {
      assert.ok(
        source.includes(utility) || values.includes(utility),
        `${label(file)}: falta a utility ${utility}`,
      );
    }
  }
});

test("os aliases semânticos removidos de inboxes não voltaram", () => {
  const inboxes = sources.get("src/app/inboxes-management.tsx");
  for (const alias of [
    "bg-surface", "text-ink", "border-line", "rounded-ib-", "min-h-ib-control",
    "gap-token", "p-pad", "shadow-token\"", "text-h4", "max-w-ib-copy",
    "text-ib-caption", "text-ib-micro", "border-danger", "text-danger",
    "shadow-vx-brand",
  ]) {
    assert.ok(!inboxes.includes(alias), `alias legado readmitido: ${alias}`);
  }
});

test("alarm-center preserva o contrato de acessibilidade e áudio", () => {
  const source = sources.get("src/app/alarm-center.tsx");
  for (const token of [
    'role="alertdialog"', 'aria-modal="true"',
    'aria-label={ringing.length === 1 ? "Alarme tocando" : "Alarmes tocando"}',
    'zIndex: "var(--z-reminder, 9500)"', 'data-testid="alarm-snooze"',
    'data-testid="alarm-stop"', "Adiar 5 min", "Parar",
    "onClick={() => snooze(alarm)}", "onClick={() => dismiss(alarm)}",
    'aria-hidden="true"', "key={alarm.id}", "if (!ringing.length) return null;",
    'fetch("/api/backend/reminders/alarms", { cache: "no-store" })',
    'method: "PUT"', "FIRED_KEY", "SNOOZED_KEY", "speechSynthesis", "AudioContext",
  ]) {
    assert.ok(source.includes(token), `alarm-center perdeu ${token}`);
  }
});

test("dashboard-widgets preserva relógio, clima e calendário", () => {
  const source = sources.get("src/app/dashboard-widgets.tsx");
  for (const token of [
    'aria-label="Relógio e data de hoje"', 'aria-label="Clima agora"',
    'aria-label="Calendário"', 'aria-label="Seu dia agora"',
    'aria-label="Definir local do clima"', 'aria-label="Cidade para o clima"',
    'aria-label="Mês anterior"', 'aria-label="Próximo mês"',
    "dateTime={now.toISOString()}", 'role="grid"', 'role="columnheader"',
    'role="gridcell"', "window.setInterval", "window.localStorage",
    "/api/backend/auth/organization", "geocoding-api.open-meteo.com",
    "api.open-meteo.com/v1/forecast", "vx:weather-city", "vx:weather-bg",
    "aria-label=\"Alterar fundo do clima\"", "WEATHER_BACKGROUNDS",
    "weatherFor", "saveCity", "setCursor",
  ]) {
    assert.ok(source.includes(token), `dashboard-widgets perdeu ${token}`);
  }
});

test("contact-profile-panel preserva testids, endpoints e contratos de tag", () => {
  const source = sources.get("src/app/contact-profile-panel.tsx");
  for (const token of [
    'data-testid="contact-profile"', 'data-collapsed={expanded ? "false" : "true"}',
    'data-bare={bare ? "true" : "false"}',
    'data-testid="contact-profile-heading"',
    'data-testid="contact-profile-identity"', 'role="alert"',
    "/api/backend/contacts/", "/identities/rebind", "/history",
    "/profile-config", "/api/backend/tasks", "tagForeground(tag.color)",
    'aria-label={expanded ? "Recolher ficha" : "Expandir ficha"}',
    'aria-label="Tag do contato"', 'aria-label="Adicionar tag cadastrada"',
    "onExpandedChange(!expanded)", "setTab(", "save()",
  ]) {
    assert.ok(source.includes(token), `contact-profile-panel perdeu ${token}`);
  }
});

test("inboxes-management preserva contratos, integrações e estados", () => {
  const source = sources.get("src/app/inboxes-management.tsx");
  for (const token of [
    'aria-label="Gestão das inbox"',
    'aria-label="Distribuição automática de conversas"',
    'aria-label="Atualizar inbox"', 'role="alert"', 'role="status"',
    "/api/backend/channels/", "zernio/sync", '"inboxes"',
    "/api/backend/conversations/distribution-settings",
    'href="/?module=Chatbots"',
    'href={"/?module=Atendimento&conversation="',
    "expectedRevision:selected.routing.revision", "<VexoraDialog",
    "distributionDraft", "setDistributionDraft", "setSelected(row)",
    "void refresh()", "void save()", "void saveDistribution()",
  ]) {
    assert.ok(source.includes(token), `inboxes-management perdeu ${token}`);
  }
  assert.ok((source.match(/role="alert"/g) ?? []).length >= 2);
  assert.ok((source.match(/role="status"/g) ?? []).length >= 3);
});

test("as quatro fatias continuam com os papéis e rótulos esperados", () => {
  for (const file of files) {
    const source = sources.get(file);
    assert.ok(/aria-label=|role="[a-z]+"/.test(source), `${label(file)}: sem rótulo acessível`);
  }
  assert.ok(allClassText.includes("bg-slate-700/60"));
  assert.ok(allClassText.includes("text-slate-50"));
});
