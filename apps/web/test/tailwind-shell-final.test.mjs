import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

const sources = {
  origins: read("src/app/lead-origins-workspace.tsx"),
  password: read("src/app/change-password-screen.tsx"),
  page: read("src/app/page.tsx"),
  overview: read("src/app/overview-intelligence.tsx"),
};
const legacyCss = read("src/app/vexora.css");

const clean = (value) => value
  .replace(/\$\{[^}]*\}/g, " ")
  .replace(/["'`{}]/g, " ")
  .replace(/\s+/g, " ")
  .trim();

/** Strings literais, incluindo literais condicionais dentro de templates. */
function stringLiterals(code) {
  const found = [];
  const templates = /`((?:\\[\s\S]|[^`\\])*)`/g;
  const stripped = code.replace(templates, (_, body) => {
    found.push(clean(body));
    found.push(...stringLiterals(body.replace(/\$\{([^}]*)\}/g, " $1 ")));
    return " ";
  });
  for (const match of stripped.matchAll(/(['"])((?:\\[\s\S]|(?!\1)[^\\])*)\1/g)) {
    found.push(clean(match[2]));
  }
  return found.filter(Boolean);
}

/** Expressões className com brace balanceado e aspas respeitadas. */
function classExpressions(source) {
  const expressions = [];
  let cursor = 0;
  while ((cursor = source.indexOf("className", cursor)) !== -1) {
    let index = cursor + "className".length;
    while (/\s/.test(source[index])) index += 1;
    if (source[index] !== "=") {
      cursor = index;
      continue;
    }
    index += 1;
    while (/\s/.test(source[index])) index += 1;
    if (source[index] === '"' || source[index] === "'") {
      const quote = source[index];
      index += 1;
      let value = "";
      while (index < source.length && source[index] !== quote) value += source[index++];
      expressions.push(`"${value}"`);
      cursor = index + 1;
      continue;
    }
    if (source[index] !== "{") {
      cursor = index;
      continue;
    }
    let depth = 0;
    let quote = null;
    let end = index;
    for (; end < source.length; end += 1) {
      const char = source[end];
      if (quote) {
        if (char === "\\") end += 1;
        else if (char === quote) quote = null;
        continue;
      }
      if (char === '"' || char === "'" || char === "`") {
        quote = char;
        continue;
      }
      if (char === "{") depth += 1;
      else if (char === "}") {
        depth -= 1;
        if (depth === 0) {
          end += 1;
          break;
        }
      }
    }
    expressions.push(source.slice(index + 1, end - 1));
    cursor = end;
  }
  return expressions;
}

function classIndex(source) {
  const constants = new Map();
  const maps = new Map();

  for (const match of source.matchAll(/\bconst\s+([A-Za-z_$][\w$]*)\s*(?::[^=;]+)?=\s*(['"])([^"']*)\2\s*;/g)) {
    constants.set(match[1], clean(match[3]));
  }
  for (const match of source.matchAll(/\bconst\s+([A-Za-z_$][\w$]*)\s*:\s*Record<\s*string\s*,\s*string\s*>\s*=\s*\{([\s\S]*?)\}\s*;/g)) {
    const entries = new Map();
    for (const entry of match[2].matchAll(/([A-Za-z_$][\w$]*)\s*:\s*(['"])([^"']*)\2/g)) {
      entries.set(entry[1], clean(entry[3]));
    }
    maps.set(match[1], entries);
  }

  const helpers = new Map();
  for (const match of source.matchAll(/\bfunction\s+([A-Za-z_$][\w$]*)\s*\([^)]*\)\s*\{([\s\S]*?)\n\}/g)) {
    const values = [];
    for (const ret of match[2].matchAll(/\breturn\s+([A-Za-z_$][\w$]*)(?:\s*\.\s*([A-Za-z_$][\w$]*))?\s*;/g)) {
      const name = ret[1];
      const key = ret[2];
      if (key && maps.has(name) && maps.get(name).has(key)) values.push(maps.get(name).get(key));
      else if (!key && maps.has(name)) values.push(...maps.get(name).values());
      else if (!key && constants.has(name)) values.push(constants.get(name));
    }
    for (const literal of stringLiterals(match[2])) values.push(literal);
    helpers.set(match[1], values.filter(Boolean));
  }

  function resolve(expression) {
    const values = stringLiterals(expression);
    for (const match of expression.matchAll(/\b([A-Za-z_$][\w$]*)(?:\s*\.\s*([A-Za-z_$][\w$]*))?/g)) {
      const name = match[1];
      const key = match[2];
      if (key && maps.has(name) && maps.get(name).has(key)) values.push(maps.get(name).get(key));
      else if (!key && maps.has(name)) values.push(...maps.get(name).values());
      else if (!key && constants.has(name)) values.push(constants.get(name));
      else if (!key && helpers.has(name)) values.push(...helpers.get(name));
    }
    return values.filter(Boolean);
  }

  const expressions = classExpressions(source);
  const values = expressions.flatMap(resolve).map(clean).filter(Boolean);
  const classes = values.join("\n");
  return { classes, tokens: new Set(classes.split(/\s+/).filter(Boolean)), constants, maps, helpers, expressions };
}

const index = Object.fromEntries(Object.entries(sources).map(([name, source]) => [name, classIndex(source)]));
const allClasses = Object.values(index).map((entry) => entry.classes).join("\n");
const hasToken = (screen, token) => index[screen].tokens.has(token);
const patch = [
  /\[[a-z-]+:\s*[^]\s]+\]/,
  /#[0-9a-fA-F]{3,8}\b/,
  /color-mix\(/,
  /!important/,
  /@apply/,
  /@tailwind\s+base/,
];

test("as quatro telas resolvem literais de constantes, mapas e helpers", () => {
  assert.ok(index.origins.classes.includes("inline-flex min-h-control items-center justify-center gap-2 rounded-token-sm bg-blue-600 px-4 text-body font-bold text-blue-50 shadow-token-sm"));
  assert.ok(index.password.classes.includes("grid min-h-dvh place-items-center bg-zinc-50 p-5"));
  assert.ok(index.password.classes.includes("bg-linear-to-br from-blue-100 via-blue-600 to-blue-800"));
  assert.ok(index.page.classes.includes("grid h-10 w-10 flex-none place-items-center rounded-lg bg-blue-600 font-sans text-base font-extrabold text-blue-950 shadow-md"));
  assert.ok(index.page.classes.includes("max-h-9 max-w-9 object-contain"));

  const variants = [
    "default", "round", "square", "logo", "logoRound", "logoSquare",
  ];
  assert.deepEqual([...index.page.maps.get("BRAND_MARK_TW")?.keys() || []], variants);
  for (const token of ["rounded-full", "rounded-md", "bg-transparent", "shadow-none"]) {
    assert.ok(hasToken("page", token), `o helper da marca deve resolver ${token}`);
  }
  assert.ok(index.page.helpers.has("brandMarkClass"), "o helper brandMarkClass deve ser detectado");
});

test("todo identificador de classe resolve para uma literal declarada", () => {
  for (const [screen, entry] of Object.entries(index)) {
    for (const expression of entry.expressions) {
      for (const match of expression.matchAll(/\b([A-Z][A-Z0-9_]*)\b/g)) {
        const name = match[1];
        assert.ok(
          entry.constants.has(name) || entry.maps.has(name) || entry.helpers.has(name),
          `${screen}: classe ${name} sem literal declarada`,
        );
      }
    }
  }
});

test("nenhuma classe decorativa legada permanece nas quatro telas", () => {
  const buttons = [
    "primary-button", "secondary-button", "text-button", "danger-button",
    "danger-text", "icon-button", "ai-toggle",
  ];
  const auth = [
    "auth-screen", "auth-panel", "auth-brand", "auth-title", "auth-copy",
    "auth-form", "auth-field", "auth-error",
  ];
  const brand = [
    "brand-mark", "brand-full-logo", "has-custom-logo", "custom-round", "custom-square",
  ];
  for (const token of [...buttons, ...auth]) {
    assert.equal(hasToken("password", token), false, `senha ainda usa ${token}`);
  }
  for (const token of buttons) {
    assert.equal(hasToken("origins", token), false, `origens ainda usa ${token}`);
    assert.equal(hasToken("overview", token), false, `visão geral ainda usa ${token}`);
    assert.equal(hasToken("page", token), false, `home ainda usa ${token}`);
  }
  for (const token of brand) {
    assert.equal(hasToken("page", token), false, `home ainda usa ${token}`);
  }
  assert.equal(hasToken("overview", "ov-hero"), false, "ov-hero é hook, não classe");

  for (const screen of ["origins", "password", "overview"]) {
    assert.doesNotMatch(index[screen].classes, /\bv(?:x|ib|rw|ps)-[a-z][a-z0-9-]*/, `${screen} ainda usa token decorativo legado`);
  }
});

test("remendos visuais e classes arbitrárias continuam proibidos", () => {
  for (const [screen, source] of Object.entries(sources)) {
    for (const forbidden of patch.slice(2)) {
      const match = source.match(forbidden);
      assert.equal(match, null, `${screen}: remendo ${match?.[0]}`);
    }
  }
  for (const forbidden of patch.slice(0, 2)) {
    const match = allClasses.match(forbidden);
    assert.equal(match, null, `classe com remendo: ${match?.[0]}`);
  }
  assert.match(sources.origins, /hsl\(/, "as cores dos canais ficam em style, com hsl");
  assert.match(sources.password, /hsl\(/, "o wash radial da senha usa hsl");
  assert.doesNotMatch(allClasses, /\b(?:hex|color-mix)\b/, "cores ficam em style, não em classes");
});

test("as utilities centrais das quatro telas permanecem literais", () => {
  const expected = {
    origins: [
      "grid grid-cols-1 content-start gap-token",
      "grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3",
      "grid grid-cols-1 gap-3 lg:grid-cols-2",
      "h-2 overflow-hidden rounded-full bg-surface-3",
      "inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-2.5 py-0.5 text-2xs font-extrabold",
      "min-h-0 min-w-0 flex-1 border-0 bg-transparent p-0 text-body text-ink shadow-none outline-hidden",
      "overflow-x-auto",
    ],
    password: [
      "mx-auto grid w-full max-w-md content-center gap-4 p-8",
      "grid h-control w-control flex-none place-items-center rounded-brand bg-linear-to-br from-blue-100 via-blue-600 to-blue-800 font-display text-brand-mark",
      "font-display text-brand-title font-extrabold",
      "grid gap-1.5 text-body font-semibold text-ink",
      "m-0 rounded-token-sm border border-red-600/40 bg-red-100 px-3 py-2.5 text-small leading-relaxed text-red-600",
    ],
    page: [
      "grid h-10 w-10 flex-none place-items-center rounded-lg bg-blue-600 font-sans text-base font-extrabold text-blue-950 shadow-md",
      "grid h-10 w-10 flex-none place-items-center rounded-full bg-blue-600 font-sans text-base font-extrabold text-blue-950 shadow-md",
      "grid h-10 w-10 flex-none place-items-center rounded-md bg-blue-600 font-sans text-base font-extrabold text-blue-950 shadow-md",
      "grid h-10 w-10 flex-none place-items-center rounded-lg bg-transparent font-sans text-base font-extrabold text-blue-950 shadow-none",
      "grid h-10 w-10 flex-none place-items-center rounded-full bg-transparent font-sans text-base font-extrabold text-blue-950 shadow-none",
      "grid h-10 w-10 flex-none place-items-center rounded-md bg-transparent font-sans text-base font-extrabold text-blue-950 shadow-none",
    ],
    overview: [
      "inline-flex min-h-9 items-center justify-center gap-2 rounded-lg border border-transparent bg-blue-600 px-4 text-xs font-bold text-blue-900 shadow-sm transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60 justify-self-start",
      "justify-self-start",
      "inline-flex min-h-8 items-center justify-center gap-2 px-1.5 text-sm font-bold text-blue-600 transition-colors hover:bg-zinc-200 hover:text-blue-700",
    ],
  };
  for (const [screen, utilities] of Object.entries(expected)) {
    for (const utility of utilities) {
      assert.ok(index[screen].classes.includes(utility), `${screen}: falta ${utility}`);
    }
  }
});

test("os contratos funcionais e de acessibilidade permanecem intactos", () => {
  const contracts = {
    origins: [
      "/api/backend/reports/lead-origins", "Aplicar período", "Aquisição de leads",
      'role="alert"', 'aria-hidden="true"', 'aria-label={"Abrir CRM para " + item.name}',
      'window.location.search = "?module=CRM"', 'tzOffset: String(new Date().getTimezoneOffset())',
    ],
    password: [
      "/api/backend/auth/change-password", "/api/backend/auth/logout",
      'autoComplete="current-password"', 'autoComplete="new-password"',
      "minLength={PASSWORD_MIN_LENGTH}", "PASSWORD_REQUIREMENTS", "passwordProblem",
      'role="alert"', "Crie sua senha pessoal", "window.location.assign('/')",
    ],
    page: [
      'aria-controls="mobile-navigation-menu"', 'id="mobile-navigation-menu"',
      'aria-labelledby="sidebar-color-title"', 'id="sidebar-color-title"',
      'data-testid={active === "Visão geral" ? "ov-dock" : undefined}',
      "applyBrandAll", "workspaceTabKey", 'setActive("Visão geral")',
    ],
    overview: [
      'data-testid="ov-hero"', 'role="img"', 'aria-label={`Atendimentos por hora',
      'role="group"', 'aria-label="Resumo da operação"', "onClick={onOpenQueue}",
      "Abrir a fila", "Ver atendimento",
    ],
  };
  for (const [screen, tokens] of Object.entries(contracts)) {
    for (const token of tokens) {
      assert.ok(sources[screen].includes(token), `${screen}: contrato perdido ${token}`);
    }
  }
});

test("os tokens reais do tema escuro não foram alterados", () => {
  const darkBlock = legacyCss.match(/:root\[data-theme=dark\]\{([\s\S]*?)\}/)?.[1] ?? "";
  for (const [name, value] of Object.entries({
    "--bg-base": "#020617",
    "--bg-surface": "#0F172A",
    "--bg-elevated": "#1E293B",
    "--border-light": "#334155",
    "--text-main": "#F8FAFC",
    "--bg": "var(--bg-base)",
    "--s1": "var(--bg-surface)",
    "--s2": "var(--bg-elevated)",
    "--sb-bg": "var(--bg-surface)",
  })) {
    assert.ok(darkBlock.includes(`${name}:${value}`), `o tema escuro perdeu ${name}:${value}`);
  }
});
