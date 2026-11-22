import test from "node:test";
import assert from "node:assert";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Resolve a partir do próprio arquivo: o CI executa `pnpm --filter web test`
// com cwd em apps/web, enquanto a execução local costuma partir da raiz.
const WEB = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const REPORTS = path.join(WEB, "src", "app", "reports-workspace.tsx");
const OVERVIEW = path.join(WEB, "src", "app", "overview-intelligence.tsx");

function read(file) {
  return fs.readFileSync(file, "utf8");
}

/** Remove o contrato de impressão (CSS com !important/hex) antes de inspecionar JSX. */
function jsxOf(raw) {
  const marker = "const REPORTS_CSS = `";
  const index = raw.indexOf(marker);
  return index >= 0 ? raw.slice(0, index) : raw;
}

/** Extrai o conteúdo de um atributo JSX com braces balanceados. */
function bracedValues(src, attribute) {
  const values = [];
  const re = new RegExp("\\b" + attribute + "\\s*=\\s*\\{", "g");
  let match;
  while ((match = re.exec(src))) {
    const start = match.index + match[0].length;
    let depth = 1;
    let end = -1;
    for (let i = start; i < src.length; i++) {
      if (src[i] === "{") depth++;
      else if (src[i] === "}") {
        depth--;
        if (depth === 0) {
          end = i;
          break;
        }
      }
    }
    if (end < 0) continue;
    values.push(src.slice(start, end));
    re.lastIndex = end + 1;
  }
  return values;
}

function quotedStrings(code) {
  const strings = code.match(/"[^"\n]*"|'[^'\n]*'|`[^`]*`/g) || [];
  return strings.map((value) => value.slice(1, -1));
}

function classNameValues(src) {
  const values = [];
  for (const match of src.matchAll(/\bclassName\s*=\s*"([^"]*)"/g)) values.push(match[1]);
  for (const code of bracedValues(src, "className")) {
    for (const raw of quotedStrings(code)) {
      if (!raw) continue;
      if (raw.includes("${")) values.push(raw.replace(/\$\{[^}]*\}/g, ""));
      else values.push(raw);
    }
  }
  return values;
}

/** Valores literais completos usados por mapas/helpers de classes. */
function constantClassValues(src) {
  const values = [];
  const names = ["deltaTw", "chipTw", "tabTw", "tabActive", "waitToneClasses"];
  for (const name of names) {
    const start = src.indexOf(name);
    if (start < 0) continue;
    const blockEnd = src.indexOf("\n};", start);
    const end = blockEnd >= 0 && blockEnd - start < 1200 ? blockEnd + 3 : start + 700;
    for (const value of quotedStrings(src.slice(start, end))) {
      if (value && !value.includes("${")) values.push(value);
    }
  }
  return values;
}

const ALLOWED_VARIANTS = ["rw-laptop:", "ov-laptop:", "ib-narrow:"];
const LEGACY_FRAGMENTS = [
  "rw-", "ov-", "ib-", "vx-", "auth-", "alarm-", "platform-admin-",
  "content-card", "settings-card", "primary-button", "secondary-button",
  "text-button", "icon-button",
  "token", "shimmer", "surface-", "-line", "fill-ink", "text-ink",
  "2xs", "font-heading", "text-h2", "text-body", "text-small",
  "bg-linear-to-", "transition-control", "duration-control", "duration-ring",
  "ease-token", "tracking-ov-wide",
];

function tokensOf(values) {
  return values.flatMap((value) => value.split(/\s+/)).filter(Boolean);
}

function assertCleanTokens(values, label) {
  for (const token of tokensOf(values)) {
    let normalized = token;
    for (const variant of ALLOWED_VARIANTS) normalized = normalized.split(variant).join("");
    assert.ok(!/\s/.test(normalized), `${label}: token inválido ${JSON.stringify(token)}`);
    for (const fragment of LEGACY_FRAGMENTS) {
      assert.ok(
        !normalized.includes(fragment),
        `${label}: token legado ${JSON.stringify(token)} contém ${JSON.stringify(fragment)}`,
      );
    }
    assert.ok(!normalized.includes("["), `${label}: valor arbitrário em ${JSON.stringify(token)}`);
    assert.ok(!normalized.includes("#"), `${label}: hex em classe ${JSON.stringify(token)}`);
    assert.ok(!normalized.includes("!"), `${label}: important em classe ${JSON.stringify(token)}`);
  }
}

const reportsRaw = read(REPORTS);
const overviewRaw = read(OVERVIEW);
const reports = jsxOf(reportsRaw);
const overview = jsxOf(overviewRaw);

test("fontes migradas existem e são arquivos distintos", () => {
  assert.ok(fs.existsSync(REPORTS));
  assert.ok(fs.existsSync(OVERVIEW));
  assert.notStrictEqual(REPORTS, OVERVIEW);
});

test("classes migradas não contêm tokens legados, arbitrários, hex ou important", () => {
  for (const [label, src] of [["reports-workspace", reports], ["overview-intelligence", overview]]) {
    assertCleanTokens([...classNameValues(src), ...constantClassValues(src)], label);
  }
});

test("utilitários Tailwind padrão estão presentes nos dois arquivos", () => {
  for (const util of ["grid-cols-1", "min-w-0", "text-xs", "bg-zinc-100", "border-gray-200", "text-slate-600"]) {
    assert.ok(reports.includes(util), `reports-workspace sem o utilitário "${util}"`);
  }
  for (const util of ["rounded-xl", "shadow-sm", "flex-1", "gap-3", "xl:grid-cols-6"]) {
    assert.ok(reports.includes(util), `reports-workspace sem o utilitário "${util}"`);
  }
  for (const util of ["grid-cols-1", "min-w-0", "text-xs", "bg-zinc-200", "border-gray-200", "text-slate-600"]) {
    assert.ok(overview.includes(util), `overview-intelligence sem o utilitário "${util}"`);
  }
  for (const util of ["rounded-2xl", "rounded-lg", "gap-5", "grid-cols-2", "sm:grid-cols-1"]) {
    assert.ok(overview.includes(util), `overview-intelligence sem o utilitário "${util}"`);
  }
});

test("dark mode slate real foi aplicado nas superfícies", () => {
  assert.ok(reports.includes("dark:bg-slate-900"));
  assert.ok(reports.includes("dark:border-slate-800"));
  assert.ok(reports.includes("dark:text-slate-100"));
  assert.ok(overview.includes("dark:bg-slate-900"));
  assert.ok(overview.includes("dark:bg-slate-800"));
  assert.ok(overview.includes("dark:border-slate-800"));
});

test("constantes e variantes resolvem para literais completos", () => {
  const expected = [
    'up: "bg-blue-100 text-blue-800"',
    'down: "bg-red-100 text-red-600"',
    'flat: "bg-zinc-300 text-slate-600"',
    'const chipTw = "min-h-8 rounded-full border border-gray-200 bg-zinc-200',
    'const tabTw = "inline-flex min-h-9 items-center gap-2 whitespace-nowrap rounded-lg',
    'const tabActive = "bg-blue-600 text-white shadow-sm"',
  ];
  for (const literal of expected) {
    assert.ok(reports.includes(literal), `literal incompleto: ${literal}`);
  }
  assert.ok(overview.includes('if (tone === "mint") return "bg-blue-100 text-blue-800 dark:bg-blue-400/15 dark:text-blue-300";'));
  assert.ok(overview.includes('if (tone === "amber") return "bg-amber-100 text-amber-600 dark:bg-amber-400/15 dark:text-amber-300";'));
  assert.ok(overview.includes('return "bg-red-100 text-red-600 dark:bg-red-400/15 dark:text-red-300";'));
});

test("verde comum foi substituído por azul; dados verdes permanecem apenas como dados", () => {
  for (const [label, src] of [["reports-workspace", reports], ["overview-intelligence", overview]]) {
    assert.ok(!/\b(?:bg|text|border)-(?:emerald|green|lime)-/i.test(src), `${label}: verde comum ainda em classe`);
    assert.ok(src.includes("bg-blue-700"), `${label}: azul de substituição ausente`);
  }
  assert.ok(reportsRaw.includes('return "url(#rw-instagram)"'));
  assert.ok(reportsRaw.includes('#25D366'));
});

test("contrato funcional de impressão, testes e acessibilidade foi preservado", () => {
  for (const token of [
    "print-root", "print-only", "print-cover", "no-print", "top-title", "badge", "sub",
    "actions", "period", "presets", "custom", "custom-error", "range", "range-vs",
    "tabs", "panel", "kpi-grid", "kpi", "kpi-label", "kpi-value", "kpi-foot", "kpi-note",
    "grid-2", "card", "card-head", "card-title", "card-hint", "card-aside",
    "compare", "compare-row", "compare-label", "compare-current", "delta",
    "hbar-row", "hbar-label", "hbar-track", "hbar-fill", "hbar-value",
    "donut-wrap", "donut", "donut-track", "donut-total", "donut-caption",
    "legend", "legend-item", "legend-dot", "legend-label", "legend-value",
    "linechart-legend", "gridline", "ylabel", "xlabel", "hour-peak", "hour-bar",
    "table", "table-empty", "skeleton", "skel", "skel-grid", "skel-card", "skel-chart",
    "skel-chart-short", "error", "error-body", "empty", "footnote", "stage-chip",
    "stage-dot", "pipeline", "pipeline-head", "pipeline-outcome", "outcome-won",
    "outcome-lost", "pipeline-empty", "count-pill", "scope-note",
  ]) {
    const inJsx = new RegExp(`data-print="[^"]*\\b${token}\\b[^"]*"`).test(reportsRaw);
    const inCss = reportsRaw.includes(`data-print~="${token}"`);
    assert.ok(inJsx || inCss, `data-print ausente: ${token}`);
  }
  assert.ok(reportsRaw.includes('<style>{REPORTS_CSS}</style>'));
  assert.ok(reportsRaw.includes('id="rw-instagram"'));
  assert.ok(reportsRaw.includes('role="tablist"'));
  assert.strictEqual((reportsRaw.match(/role="tabpanel"/g) || []).length >= 6, true);
  assert.ok(reportsRaw.includes('aria-label="Seções de relatórios"'));
  assert.ok(reportsRaw.includes('data-print="print-root"'));

  assert.ok(overviewRaw.includes('data-testid="ov-hero"'));
  assert.ok(overviewRaw.includes('aria-label="Inteligência da operação"'));
  assert.ok(overviewRaw.includes('role="group"'));
  assert.ok(overviewRaw.includes('id="vxHourlyFill"'));
  assert.ok(overviewRaw.includes('id="vxHourlyStroke"'));
  assert.ok(overviewRaw.includes('onClick={onOpenQueue}'));
});

test("inline styles restantes são somente medidas/cores orientadas por dados", () => {
  const allowed = new Set(["width", "background", "stroke"]);
  for (const [label, src] of [["reports-workspace", reports], ["overview-intelligence", overview]]) {
    const styles = bracedValues(src, "style");
    assert.ok(styles.length > 0, `${label}: nenhum style de dado encontrado`);
    for (const code of styles) {
      const props = [...code.matchAll(/(?:^|[,{]\s*)([A-Za-z][A-Za-z0-9]*)\s*:/g)].map((match) => match[1]);
      for (const prop of props) {
        assert.ok(allowed.has(prop), `${label}: propriedade decorativa ${prop} em style`);
      }
    }
    assert.ok(!/\b(?:position|display|backgroundImage|fontSize|lineHeight|letterSpacing|transform|zIndex)\s*:/.test(src), `${label}: style decorativo reintroduzido`);
  }
});

test("sem regras proibidas e sem alterações em arquivos de terceiros", () => {
  for (const [label, src] of [["reports-workspace", reports], ["overview-intelligence", overview]]) {
    assert.ok(!src.includes("@apply"), `${label}: @apply`);
    assert.ok(!src.includes("@tailwind base"), `${label}: @tailwind base`);
    assert.ok(!src.includes("color-mix("), `${label}: color-mix(`);
  }
  const twConfig = read(path.join(WEB, "tailwind.config.ts"));
  const themeCss = read(path.join(WEB, "src", "app", "theme.css"));
  const vexoraCss = read(path.join(WEB, "src", "app", "vexora.css"));
  const siteHtml = read(path.join(WEB, "..", "api", "src", "modules", "sites-deploy", "site-html.ts"));
  assert.ok(twConfig.includes('"rw-title"'));
  assert.ok(twConfig.includes('"ov-hero"'));
  assert.ok(themeCss.includes("@custom-variant ov-laptop"));
  assert.ok(vexoraCss.includes("--vx-core-page-wash"));
  assert.ok(siteHtml.includes("function escapeHtml"));
});
