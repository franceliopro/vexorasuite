import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const read = (file) => fs.readFileSync(path.join(rootDir, file), "utf8");

const config = read("tailwind.config.ts");
const theme = read("src/app/theme.css");
const styles = read("src/app/overview.css");
const layout = read("src/app/layout.tsx");
const overview = read("src/app/overview-intelligence.tsx");
const widgets = read("src/app/dashboard-widgets.tsx");
const onboarding = read("src/app/onboarding-checklist.tsx");
const welcome = read("src/app/dashboard-welcome.tsx");
const page = read("src/app/page.tsx");
const visualRegression = read("e2e/inbox-visual-regression.mjs");
const supportCollaboration = read("e2e/support-collaboration-browser.mjs");
const components = `${overview}\n${widgets}\n${onboarding}`;

/** Remove comentários e hooks estáveis antes de procurar classes legadas. */
const semComentarios = (source) => source
  .replace(/\/\*[\s\S]*?\*\//g, "")
  .replace(/^\s*\/\/.*$/gm, "")
  .replace(/data-testid="ov-[a-z-]+"/g, "")
  .replace(/data-testid=\{[^}]*\}/g, "");

/** Tokens do preset terminam em ov-* ou começam com ov-<screen>: — não são classes de componente. */
const classesLegadas = (source) => [
  ...semComentarios(source).matchAll(/(?:^|[\s"'`{=])ov-[a-z][a-z0-9-]*(?=[\s"'`}]|$)/gm),
].map((match) => match[0].trim());

test("a Visão geral carrega o CSS isolado depois do tema e do legado", () => {
  const theme = layout.indexOf('import "./theme.css"');
  const legacy = layout.indexOf('import "./vexora.css"');
  const isolated = layout.indexOf('import "./overview.css"');
  assert.ok(theme >= 0 && legacy > theme && isolated > legacy);
});

test("não existe nenhuma classe ov-* nos componentes da Visão geral", () => {
  assert.deepEqual(classesLegadas(overview), []);
  assert.deepEqual(classesLegadas(widgets), []);
  assert.deepEqual(classesLegadas(onboarding), []);
  assert.deepEqual(classesLegadas(page), []);
  assert.doesNotMatch(components, /\bvx-[a-z0-9-]+/);
  assert.doesNotMatch(page, /Acesso rápido|\bov-access-[a-z-]+\b|mobile-overview-nav/);
});

test("os hooks estáveis substituem os seletores de classe no e2e", () => {
  assert.match(overview, /data-testid="ov-hero"/);
  assert.match(page, /data-testid=\{active === "Visão geral" \? "ov-dock" : undefined\}/);
  assert.match(visualRegression, /\[data-testid="ov-hero"\]/);
  assert.match(visualRegression, /\[data-testid="ov-dock"\]/);
  assert.match(supportCollaboration, /\[data-testid=['"]ov-dock['"]\]/);
  assert.doesNotMatch(visualRegression, /\.ov-(?:hero|dock)\b/);
  assert.doesNotMatch(supportCollaboration, /\.ov-(?:hero|dock)\b/);
  assert.doesNotMatch(visualRegression, /\.vx-hero\b/);
});

test("overview.css não define componentes, apenas utilities e variáveis de tema", () => {
  const css = semComentarios(styles);
  assert.match(css, /@tailwind utilities;/);
  assert.doesNotMatch(css, /@tailwind components;/);
  assert.doesNotMatch(css, /@tailwind base;/);
  assert.doesNotMatch(css, /@layer\s+components\b/);
  assert.doesNotMatch(css, /\.[a-z][a-z0-9-]*\s*\{/);
  // `@custom-variant ov-*` são nomes de breakpoint do v4, não classes de componente.
  const semVariantes = styles.replace(/@custom-variant\s+[a-z-]+\s+\([^;]+;\s*/g, "");
  assert.deepEqual(classesLegadas(semVariantes), []);

  for (const forbidden of [
    /\[[a-z-]+:\s*[^]\s]+\]/,
    /#[0-9a-fA-F]{3,8}\b/,
    /!important/,
  ]) {
    const match = css.match(forbidden);
    assert.equal(match, null, `remendo visual encontrado: ${match?.[0]}`);
  }

  const semDerivados = css.replace(/:root\s*\{[^}]*\}/g, "");
  assert.doesNotMatch(semDerivados, /color-mix\(/);
});

test("overview.css reemite todos os breakpoints padrão usados no produto", () => {
  // A reemissão plain vem depois do CSS legado. Se um breakpoint não for
  // registrado aqui, só a utility base (ex.: .grid-cols-1/.hidden) é emitida
  // e ela vence a variante responsiva em camada de theme.css.
  const breakpoints = {
    sm: "(width >= 40rem)",
    md: "(width >= 48rem)",
    lg: "(width >= 64rem)",
    xl: "(width >= 80rem)",
    "2xl": "(width >= 96rem)",
    "max-sm": "(width < 40rem)",
    "max-md": "(width < 48rem)",
    "max-lg": "(width < 64rem)",
    "max-xl": "(width < 80rem)",
    "max-2xl": "(width < 96rem)",
  };
  for (const [variant, media] of Object.entries(breakpoints)) {
    assert.ok(
      styles.includes(`@custom-variant ${variant} (@media ${media});`),
      `overview.css perdeu ${variant}: a utility responsiva ficaria sem efeito`,
    );
  }
});

test("as utilities da Visão geral continuam presentes no JSX", () => {
  for (const utility of [
    "grid-cols-2", "col-span-2", "ov-laptop:col-span-1", "grid-cols-1",
    "grid-cols-3", "xl:grid-cols-6", "sm:grid-cols-2",
    "gap-5", "ov-laptop:grid-cols-1", "sm:grid-cols-1",
    "lg:grid-cols-2", "gap-4", "gap-3", "md:grid-cols-2",
    "sm:grid-cols-2", "grid-cols-3", "mobile-bottom-nav--overview",
    "min-h-14", "min-h-24", "h-20",
    "w-20", "max-w-md", "max-w-lg", "text-2xl",
    "text-sm", "text-xs", "text-4xl", "text-base", "text-slate-950", "tracking-widest",
    "stroke-blue-600", "transition-all", "duration-300", "transition-colors",
    "duration-200", "ease-out", "transition-colors", "duration-200",
    "rounded-2xl", "rounded-lg", "border-gray-200", "bg-zinc-100",
    "bg-zinc-200", "bg-zinc-300", "bg-blue-50", "bg-blue-600", "bg-blue-700",
    "text-blue-900", "text-slate-600", "bg-amber-600",
    "bg-red-100", "text-red-600", "shadow-md", "hover:bg-zinc-200",
    "disabled:cursor-not-allowed", "disabled:opacity-50",
    "md:h-16", "md:w-16", "h-14", "w-14",
  ]) {
    assert.ok(components.includes(utility) || page.includes(utility), `a Visão geral deve usar ${utility}`);
  }

  assert.match(styles, /@tailwind utilities;/);
});

test("o layout da Visão geral usa larguras cheias e colunas equilibradas", () => {
  assert.match(theme, /@custom-variant ov-laptop \(@media \(max-width: 900px\)\);/);

  // A grade externa é de 2 colunas; apenas hero e KPIs ocupam as duas.
  assert.match(overview, /<section className="grid grid-cols-2 gap-5 bg-transparent ov-laptop:grid-cols-1"/);
  assert.match(overview, /data-testid="ov-hero"/);
  assert.match(overview, /col-span-2 grid gap-5[^>]*data-testid="ov-hero"/);
  // O CTA do alerta não estica com a coluna: largura só do conteúdo.
  assert.match(overview, /inline-flex min-h-9[^"]*justify-self-start" onClick=\{onOpenQueue\}>Abrir a fila/);
  assert.match(overview, /col-span-2 grid grid-cols-3 gap-5 ov-laptop:col-span-1 sm:grid-cols-1 xl:grid-cols-6/);

  // Equipe/Atividade e Gráfico/Tópicos são quatro colunas irmãs de 50%.
  const colunasIrma = overview.match(/<article className="grid content-start gap-4 rounded-xl[^"]*">/g) || [];
  assert.equal(colunasIrma.length, 4, "as quatro seções devem dividir a grade 50/50");
  assert.doesNotMatch(overview, /col-span-2 grid content-start gap-4 rounded-xl/);

  // Widgets em colunas proporcionais (3/4/5) e uma coluna no mobile; onboarding em 2 passos.
  assert.match(widgets, /<section className="grid grid-cols-12 gap-4 bg-transparent max-md:grid-cols-1"/);
  assert.match(onboarding, /<ol className="grid grid-cols-1 gap-2\.5 sm:grid-cols-2">/);

  // Nenhuma das grades antigas que causavam 4+2 ou colunas estreitas.
  for (const obsoleta of [
    "grid-cols-ov-overview", "grid-cols-ov-primary", "grid-cols-ov-main",
    "grid-cols-ov-kpi", "grid-cols-ov-widgets", "grid-cols-ov-onboarding-steps",
  ]) {
    assert.doesNotMatch(components, new RegExp(obsoleta.replace(/-/g, "\\-")));
  }
});

test("a Visão geral usa apenas a paleta documentada mapeada no preset", () => {
  const aliases = /\b(?:bg|text|border|from|to|via|stroke|fill)-(?:surface(?:-\d+)?|ink(?:-secondary|-muted)?|line(?:-strong|-soft|-footer|-hover)?|brand(?:-soft|-ink|-strong|-contrast)?|danger|accent|focus|selection|overlay(?:-soft)?|topbar|hover|sidebar(?:-on|-line|-muted|-text|-thumb)?|success(?:-soft)?|warning(?:-soft)?)\b/;
  // Os alias semânticos são permitidos no cartão dos Primeiros passos, que segue
  // o padrão .card/.tool-box com tokens de superfície, borda e texto.
  assert.doesNotMatch(`${overview}\n${widgets}`, aliases);
  for (const token of ["rounded-lg border border-line bg-surface", "bg-surface-2", "text-ink", "p-3.5", "dark:bg-slate-800", "dark:bg-sky-400/15 dark:text-sky-400"]) {
    assert.ok(onboarding.includes(token), `o cartão dos Primeiros passos perdeu ${token}`);
  }

  const escopo = `${components}\n${page}`;
  for (const token of [
    "text-slate-950", "text-slate-600", "text-slate-400",
    "bg-zinc-100", "bg-zinc-200", "bg-zinc-300", "border-gray-200",
    "bg-blue-50", "bg-blue-600", "bg-blue-700", "bg-amber-600",
    "bg-amber-600", "bg-red-100",
  ]) {
    assert.ok(escopo.includes(token), `a Visão geral deve usar ${token}`);
  }
});

test("o bloco de boas-vindas traz vídeo opcional e atalhos úteis", () => {
  assert.match(page, /import \{ DashboardWelcome \} from "\.\/dashboard-welcome";/);
  assert.match(page, /<DashboardWelcome onNavigate=/);
  for (const token of [
    'aria-label="Comece por aqui"',
    'aria-label="Alterar vídeo de boas-vindas"',
    'aria-label="Link do YouTube do vídeo de boas-vindas"',
    "Atalhos úteis",
    "vx:welcome-video", "youtubeEmbed", "youtube.com/embed/",
    "Abrir atendimento", "CRM comercial", "Relatórios", "Documentos",
    "bg-sky-400/20 text-sky-700", "bg-violet-400/20 text-violet-700",
    "bg-amber-400/20 text-amber-700", "bg-emerald-400/20 text-emerald-700",
  ]) {
    assert.ok(welcome.includes(token), `o bloco de boas-vindas perdeu ${token}`);
  }
  assert.doesNotMatch(welcome, /\[[a-z-]+:\s*[^]\s]+\]/);
  assert.doesNotMatch(welcome, /className=\{`/);
});

test("as seções da Visão geral são planas e os blocos de boas-vindas ficam lado a lado", () => {
  assert.ok(page.includes('const pageHeadingTw="flex flex-wrap items-start justify-between gap-4 bg-transparent hover:bg-transparent"'));
  assert.ok(page.includes('const [welcomeExpanded, setWelcomeExpanded] = useState(false);'));
  assert.ok(page.includes('welcomeExpanded || schoolProfile ? "grid w-full gap-4 bg-transparent hover:bg-transparent lg:grid-cols-1" : "grid w-full gap-4 bg-transparent hover:bg-transparent lg:grid-cols-2"'));
  assert.ok(page.includes('<OnboardingChecklist profile={segmentProfile} onNavigate={(target) => { preloadWorkspace(target); setActive(target); setMenuOpen(false); }} onDismiss={() => setWelcomeExpanded(true)} />'));
  assert.ok(page.includes('<div className="bg-transparent"><h1>{schoolProfile ? "Visão geral da escola" : greeting+'));

  for (const [source, label] of [
    [onboarding, 'aria-label="Primeiros passos na Véxora"'],
    [welcome, 'aria-label="Comece por aqui"'],
  ]) {
    assert.ok(source.includes(label), `a seção ${label} perdeu o rótulo`);
    assert.ok(source.includes("rounded-xl border border-gray-200 bg-white p-5"), `a seção ${label} não tem borda/padding de card no claro`);
    assert.ok(source.includes("dark:border-slate-800 dark:bg-slate-900"), `a seção ${label} não tem borda de card no dark`);
  }

  // As grades de widgets e de inteligência são transparentes: quem pinta fundo
  // é o card filho, nunca a grade intermediária.
  for (const [source, label, classes] of [
    [widgets, 'aria-label="Seu dia agora"', "grid grid-cols-12 gap-4 bg-transparent max-md:grid-cols-1"],
    [overview, 'aria-label="Inteligência da operação"', "grid grid-cols-2 gap-5 bg-transparent ov-laptop:grid-cols-1"],
  ]) {
    assert.ok(source.includes(label), `a seção ${label} perdeu o rótulo`);
    assert.ok(source.includes(`<section className="${classes}" ${label}>`), `a seção ${label} não é transparente`);
  }

  assert.ok(onboarding.includes('dark:border-slate-700 dark:bg-slate-800'));
  assert.ok(onboarding.includes('ACCENT_STEPS = new Set(["empresa", "documento"])'));
  assert.ok(welcome.includes('dark:border-slate-700 dark:bg-slate-800 dark:text-slate-50 dark:hover:bg-slate-700'));
  assert.ok(onboarding.includes("onDismissRef.current?.();"), "o fechamento do checklist avisa a Visão geral");
  assert.doesNotMatch(onboarding, /bg-linear-to-br from-blue-50 to-indigo-100/);
  assert.doesNotMatch(welcome, /bg-linear-to-br from-blue-50 via-white to-purple-50/);
  assert.ok(welcome.includes('border border-line bg-surface p-3.5 text-left text-ink'));
  // "Configurar" e os dois ícones pedidos usam sky-400 com 15% de opacidade no dark.
  assert.ok(onboarding.includes('dark:border-slate-600 dark:bg-sky-400/15 dark:text-sky-400'));
  assert.ok(welcome.includes('dark:border-slate-600 dark:bg-slate-800 dark:text-sky-300'));
  assert.doesNotMatch(onboarding, /dark:bg-slate-800 dark:text-blue-300/);
});

test("o relógio mantém o fundo claro em todos os temas", () => {
  const clock = widgets.match(/function ClockWidget\(\)[\s\S]*?\n\}/)?.[0] ?? "";
  assert.ok(clock.includes('aria-label="Relógio e data de hoje"'));
  assert.ok(clock.includes("bg-linear-to-br from-blue-50 to-blue-100"));
  assert.ok(clock.includes("text-blue-700"));
  assert.doesNotMatch(clock, /indigo-|dark:from-slate-900|dark:to-slate-900|dark:text-blue-200|dark:text-slate-300/);
  assert.ok(clock.includes("border-gray-200"), "a borda usa a linha do tema");
});

test("linhas divisórias fecham cabeçalhos, gráficos e calendário da Visão geral", () => {
  assert.ok(overview.includes("border-b border-gray-200"), "Inteligência perdeu a linha do cabeçalho no claro");
  assert.ok(overview.includes("dark:border-slate-800"), "Inteligência perdeu a linha no dark");
  assert.ok(widgets.includes("border-b border-purple-200"), "widgets perdeu a linha do cabeçalho no claro");
  assert.ok(widgets.includes("dark:border-slate-700"), "widgets perdeu a linha no dark");
  assert.ok(overview.includes("grid min-w-0 gap-3 border-b border-gray-200 pb-3 dark:border-slate-800"));
  assert.ok(overview.includes("grid min-w-0 content-start gap-1.5 border-b border-gray-200 pb-3 dark:border-slate-800"));
  assert.ok(overview.includes("border-b border-gray-200 pb-2.5 last:border-b-0 dark:border-slate-800"));
  assert.ok(widgets.includes("border-b border-purple-200 pb-1"));
  assert.ok(widgets.includes("border-b border-purple-100"));
  assert.ok(widgets.includes("border-t border-purple-200 pt-2.5"));
});

test("nenhuma classe da Visão geral termina em -card nem herda .content-card", () => {
  const escopo = `${components}\n${page}`;
  assert.doesNotMatch(escopo, /\bov-[a-z0-9-]*-card\b/);
  assert.doesNotMatch(escopo, /content-card\s+ov-/);
  assert.match(page, /dock:"mobile-bottom-nav mobile-bottom-nav--overview"/);
});

test("o preset expõe as escalas e os derivados da Visão geral", () => {
  for (const token of [
    '@custom-variant ov-laptop (@media (max-width: 900px));',
    '@custom-variant ov-tablet (@media (max-width: 760px));',
    '@custom-variant ov-mobile (@media (max-width: 520px));',
    '"ov-hero"', '"ov-hero-sm"', '"ov-kpi"', '"ov-clock"', '"ov-weather"',
    '"ov-micro"', '"ov-label"', '"ov-sub"', '"ov-onboarding"',
    '"ov-overview"', '"ov-primary"', '"ov-main"', '"ov-hero-body"',
    '"ov-team-row"', '"ov-step"', '"ov-topics"', '"ov-widgets"',
    '"ov-onboarding-steps"', '"ov-dock"', '"ov-calendar"', '"ov-ring"',
    '"ov-ring-tile"', '"ov-avatar"', '"ov-dock-btn"', '"ov-dock-gap"',
    '"ov-dock-pb"', '"ov-section"', '"ov-heading"',
    'dock: "45"', 'ov: "5.5"',
    '100: "var(--vx-bad-soft)"', '100: "var(--vx-accent-soft)"',
    'stroke: "stroke-dashoffset"', 'fill: "width"',
    'ring: "600ms"', 'bar: "300ms"',
  ]) {
    assert.ok(config.includes(token) || theme.includes(token), `o preset deve expor ${token}`);
  }
});

test("os estilos inline da Visão geral são apenas larguras data-driven", () => {
  assert.doesNotMatch(components, /style=\{\{(?!\s*width:)/);
  assert.doesNotMatch(components, /color-mix\(|#[0-9a-fA-F]{3,8}\b/);
  assert.ok((components.match(/style=\{\{\s*width:/g) || []).length >= 3);
});

test("o tracejado da linha média conserva ovalor do antigo token de tema", () => {
  assert.match(overview, /strokeDasharray="5 5"/);
  assert.doesNotMatch(styles, /--vx-ov-chart-dash/);
});
