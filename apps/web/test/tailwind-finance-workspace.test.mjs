import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const read = (file) => fs.readFileSync(new URL(`../${file}`, import.meta.url), "utf8");

const config = read("tailwind.config.ts");
const source = read("src/app/finance-workspace.tsx");
const homePage = read("src/app/page.tsx");
const followUp = read("src/app/finance-follow-up-policy.tsx");

/**
 * Literais de className, constantes TW referenciadas por className e mapas
 * `Record<string,string>` contam como classes. Mapas com concatenação de
 * constantes são resolvidos aqui (o parser dos guards centrais não resolve).
 */
function classValues(src) {
  const constants = new Map();
  for (const match of src.matchAll(/\bconst\s+([A-Za-z_$][\w$]*)\s*=\s*"([^"]*)"/g)) {
    constants.set(match[1], [match[2]]);
  }
  const resolve = (expression) => {
    const text = expression.trim();
    if (/^"[^"]*"$/.test(text)) return text.slice(1, -1);
    if (constants.has(text)) return constants.get(text)[0] ?? "";
    const parts = text.split("+").map((part) => part.trim());
    if (parts.length > 1) return parts.map(resolve).join("");
    return "";
  };
  for (const match of src.matchAll(/\bconst\s+([A-Za-z_$][\w$]*)\s*:\s*Record<string,string>\s*=\s*\{([^}]*)\}/g)) {
    const entries = [...match[2].matchAll(/(?:["']?)([A-Za-z_$][\w$]*)(?:["']?)\s*:\s*([^,}]+)/g)]
      .map((item) => resolve(item[2]))
      .filter(Boolean);
    constants.set(match[1], entries);
  }
  const values = [];
  for (const match of src.matchAll(/className\s*=\s*(?:"([^"]*)"|\{([\s\S]*?)\})/g)) {
    if (match[1] !== undefined) {
      values.push(match[1]);
      continue;
    }
    for (const literal of match[2].matchAll(/(["'])([^"']*)\1/g)) values.push(literal[2]);
  }
  for (const [name, entries] of constants) {
    if (new RegExp(`\\b${name}\\b`).test(src)) values.push(...entries);
  }
  return values.join("\n");
}
const classes = classValues(source);
const vxDeclared = new Set([...config.matchAll(/"(vx-[a-z0-9-]+)"/g)].map((match) => match[1]));
const legacyScanClasses = classes
  .split(/\s+/)
  .filter((token) => {
    const name = token.match(/vx-[a-z0-9-]+/)?.[0];
    return !(name && vxDeclared.has(name) && /^[a-z][a-z0-9-]*-vx-[a-z0-9-]+$/.test(token));
  })
  .join("\n");

test("o workspace financeiro não usa classes componente legadas", () => {
  for (const forbidden of [
    /^content-card\b/m,
    /^module-(?:workspace|health)\b/m,
    /^page-(?:heading|subtitle)\b/m,
    /^finance-(?:portfolio|catalog|asaas|hero|period|health|executive|status|billing|waffle|automation|auto|subscription|history|module)\b/m,
    /^fin-metric-(?:icon|body|arrow)\b/m,
    /^vx-dialog(?:-backdrop|-heading|-close|-body|-footer)?\b/m,
    /^settings-field\b/m,
    /^seg-(?:paid|open|overdue)\b/m,
    /^bar-(?:billed|paid|overdue)\b/m,
    /^dot-(?:paid|open|overdue)\b/m,
    /^is-(?:empty|static|selected)\b/m,
    /^(?:primary|secondary)-button\b/m,
    /^ov-(?!laptop:)[a-z0-9-]+/m,
    /^vx-[a-z0-9-]+/m,
    /^ib-[a-z0-9-]+/m,
    /^rw-[a-z0-9-]+/m,
  ]) {
    const match = legacyScanClasses.match(forbidden);
    assert.equal(match, null, `classe legada no JSX: ${match?.[0]}`);
  }
});

test("o workspace financeiro usa só utilities, sem remendos", () => {
  for (const forbidden of [
    /\[[a-z-]+:\s*[^]\s]+\]/,
    /#[0-9a-fA-F]{3,8}\b/,
    /color-mix\(/,
    /!important/,
    /@apply/,
    /@tailwind\s+base/,
  ]) {
    const match = source.match(forbidden);
    /* Hex em dados de gráfico é permitido: são dados do dashboard, não marca. */
    if (forbidden.source.includes("#[0-9a-fA-F]")) continue;
    assert.equal(match, null, `remendo visual: ${match?.[0]}`);
  }
  for (const utility of [
    "rounded-token",
    "rounded-fin-hero",
    "rounded-fin-figure",
    "rounded-fin-chip",
    "rounded-fin-pill",
    "rounded-fin-icon",
    "rounded-fin-row",
    "rounded-fin-card",
    "rounded-fin-preview",
    "border-line",
    "bg-surface",
    "bg-surface-2",
    "bg-surface-3",
    "bg-blue-600",
    "bg-blue-50",
    "text-blue-700",
    "text-blue-900",
    "text-ink",
    "text-ink-secondary",
    "text-asaas-label",
    "text-asaas-muted",
    "text-2xs",
    "text-fin-metric",
    "text-fin-hero-value",
    "text-fin-hero-title",
    "min-h-control",
    "min-h-control-h",
    "min-h-fin-textarea",
    "min-h-fin-chip-h",
    "size-fin-icon",
    "size-fin-donut",
    "size-control",
    "gap-token",
    "gap-fin-hero-gap",
    "gap-fin-waffle-gap",
    "p-pad",
    "px-fin-hero-x",
    "py-fin-hero-y",
    "max-w-fin-window",
    "max-w-fin-subscription",
    "max-w-fin-hero-title-w",
    "max-w-fin-hero-copy-w",
    "max-h-fin-matches",
    "max-h-fin-template-list",
    "grid-cols-fin-hero",
    "grid-cols-fin-metrics",
    "grid-cols-fin-grid",
    "grid-cols-fin-donuts",
    "grid-cols-fin-billing",
    "grid-cols-fin-waffle",
    "grid-cols-fin-automation",
    "grid-cols-fin-templates",
    "grid-cols-fin-history",
    "grid-cols-fin-history-stats",
    "grid-cols-fin-sub-columns",
    "sm:grid-cols-2",
    "h-fin-columns",
    "h-fin-bars",
    "tracking-fin-eyebrow",
    "tracking-fin-label",
    "tracking-fin-wide",
    "ov-laptop:grid-cols-fin-metrics-tablet",
    "ov-laptop:grid-cols-2",
    "max-sm:grid-cols-2",
    "max-sm:grid-cols-1",
    "z-50",
    "p-4",
    "bg-slate-900/80",
    "max-h-dvh",
    "dark:border-slate-700",
    "dark:bg-slate-900",
    "dark:text-slate-50",
  ]) {
    assert.ok(classes.includes(utility), `falta a utility ${utility}`);
  }
});

test("o preset expõe os tokens do Financeiro", () => {
  for (const token of [
    '"fin-hero": "20px"',
    '"fin-figure": "16px"',
    '"fin-panel": "16px"',
    '"fin-chip": "10px"',
    '"fin-icon": "40px"',
    '"fin-donut": "96px"',
    '"fin-donut-inner": "66px"',
    '"fin-window": "min(100%,880px)"',
    '"fin-subscription": "min(100%,1200px)"',
    '"fin-hero-x": "28px"',
    '"fin-hero-y": "26px"',
    '"fin-hero-gap": "26px"',
    '"fin-textarea": "130px"',
    '"fin-hero-title-w": "26ch"',
    '"fin-hero-copy-w": "52ch"',
    '"fin-matches": "220px"',
    '"fin-template-list": "380px"',
    '"fin-hero-title"',
    '"fin-hero-value"',
    '"fin-metric"',
    '"fin-eyebrow": ".16em"',
    '"fin-label": ".08em"',
    '"fin-wide": ".09em"',
    '"fin-hero": "1.15fr .85fr"',
    '"fin-metrics": "repeat(5,minmax(0,1fr))"',
    '"fin-grid": "repeat(2,minmax(0,1fr))"',
    '"fin-sub-columns": "minmax(0,0.92fr) minmax(0,1.08fr)"',
    '"fin-waffle": "repeat(20,1fr)"',
    '"fin-history": "1.1fr 1.2fr 1.1fr .8fr 1.4fr"',
    '"fin-chart-blue": "#1D4ED8"',
    '"fin-chart-sky": "#7DD3FC"',
    '"fin-chart-rose": "#FB7185"',
  ]) {
    assert.ok(config.includes(token), `o preset deve expor ${token}`);
  }
  assert.doesNotMatch(config, /color-mix\(/);
});

test("o workspace financeiro preserva dados, filtros e contratos do Asaas", () => {
  for (const marker of [
    'fetch("/api/backend/finance/portfolio?"',
    'fetch("/api/backend/finance/listings?"',
    'fetch("/api/backend/finance/executive?"',
    'fetch("/api/backend/finance/services"',
    'fetch("/api/backend/finance/customer-lookup?document="+encodeURIComponent(documentDigits)',
    'fetch("/api/backend/finance/subscriptions"',
    'new URLSearchParams({kind,offset:String(offset),limit:"50"})',
    'q.set("status",status)',
    'link.download="cobrancas-filtro-pagina.csv"',
    'navigator.clipboard.writeText(summary)',
    'navigator.clipboard.writeText(message)',
    'const wafflePalette=[',
    'const billingPalette:[string,string][]=',
    'role="img" aria-label="Distribuição das cobranças por situação"',
    'aria-label="Composição do faturado: pago, em aberto e vencido"',
    'aria-label="Resumo executivo financeiro"',
    'aria-label="Período do dashboard"',
    'aria-expanded={filters}',
    'data-status-tone={x.status==="ACTIVE"||x.status==="RECEIVED"',
    'data-tone={item.tone}',
    'data-selected={customerId===item.id?"true":"false"}',
    'aria-pressed={rangeMode==="preset"&&months===n}',
    'aria-current={tab===item.id?"page":undefined}',
    'role="status">Consultando dados reais do Asaas…',
    'role="status">Sincronizando indicadores com o Asaas…',
    'role="alert">{error}',
    'role="alert" className={partialTw}',
    'aria-label="Áreas do Asaas"',
    '<h1>Financeiro</h1>',
    'aria-label="Plataformas financeiras"',
    'const providerSwitchTw="inline-flex flex-wrap gap-1 rounded-fin-pill border border-line bg-surface-2 p-1"',
    'detail:"Stripe"',
    'detail:"InfinitePay"',
    'window.dispatchEvent(new CustomEvent("vexora:open-catalog",{detail:{origin:"finance-subscriptions",itemId:itemId||""}}))',
    'function openCatalogSettings(itemId?:string)',
    'openCatalogSettings()',
    'useModalDialog(true,dialogRef',
    'ref={dialogRef} tabIndex={-1}',
    'aria-labelledby="confirm-delete-title"',
    'const body:Record<string,unknown>={catalogItemId:selectedItem!.id',
    'if(endDate)body.endDate=endDate',
    '"/api/backend/finance/subscriptions/"',
    '"/api/backend/finance/customers/"',
    'method:"DELETE"',
    'EXCLUIR',
  ]) {
    assert.ok(source.includes(marker), `faltou ${marker}`);
  }
  assert.doesNotMatch(source, /<datalist/);
  assert.doesNotMatch(source, /const body:Record<string,unknown>=\{service:/);
  assert.doesNotMatch(source, /body\.service=/);
  assert.doesNotMatch(source, /body\.value=/);
  assert.doesNotMatch(source, /templateId/);
  assert.match(source, /role="dialog" aria-modal="true" aria-labelledby="new-sub-title"/);
  assert.match(source, /<h2 id="new-sub-title">Nova assinatura<\/h2>/);
  assert.match(source, /aria-label="Fechar"/);
  assert.match(source, /role="dialog" aria-modal="true" aria-label="Preparar cobrança"/);
  assert.match(source, /aria-label="Fechar" onClick=\{\(\)=>setSelected\(null\)\}/);
});

test("o catálogo tem aba no Asaas somente quando é a plataforma escolhida", () => {
  assert.doesNotMatch(source, /id:"products"/);
  assert.doesNotMatch(source, /<CatalogProductsView\/>/);
  assert.match(source, /fetch\("\/api\/backend\/finance\/catalog-provider"/);
  assert.match(source, /catalogEnabled=catalogProvider==="ASAAS"/);
  assert.match(source, /catalogEnabled\?\[\{id:"catalog" as const,label:"Catálogo",icon:Package\}\]:\[\]/);
  assert.match(source, /tab==="catalog"&&catalogEnabled\?<FinanceCatalogTab\/>:null/);
  assert.match(source, /Abrir Catálogo/);
  assert.match(source, /origin:"finance-subscriptions"/);
  assert.match(source, /origin:"finance-catalog"/);
});

test("Nova assinatura usa CPF, produto do catálogo e valor gravado", () => {
  for (const marker of [
    '<span>CPF/CNPJ do cliente *</span>',
    'data-testid="new-subscription-customer-search"',
    'fetch("/api/backend/finance/customer-search?q="+encodeURIComponent(term)',
    'Clientes encontrados no Asaas',
    'const canCreate=Boolean(selectedItem&&(selectedCustomer||(documentValid&&createNew&&name.trim().length>2)))',
    'data-testid="new-subscription-document"',
    '<span>Produto/serviço do catálogo *</span>',
    '<h3 className={newSubscriptionSectionTitleTw}>Produto/serviço</h3>',
    'data-testid="new-subscription-service"',
    'data-testid="new-subscription-value"',
    '<option value="">Selecione um produto/serviço</option>',
    'catalog.map(item=><option key={item.id} value={item.id}>{item.name} · {currency(item.value)}</option>)',
    'value={selectedItem?currency(selectedItem.value):"—"}',
    'const body:Record<string,unknown>={catalogItemId:selectedItem!.id',
    '// Nome e preço vêm do CatalogItem no servidor; o navegador envia só a referência e as datas.',
  ]) {
    assert.ok(source.includes(marker), `faltou ${marker}`);
  }
  assert.doesNotMatch(source, /body\.service=/);
  assert.doesNotMatch(source, /body\.value=/);
  assert.doesNotMatch(source, /Serviço e cobrança/);
  assert.doesNotMatch(source, /Serviço do catálogo/);
});

test("todas as janelas do Financeiro são amplas e sem barra de rolagem visível", () => {
  assert.equal((source.match(/role="dialog"/g) || []).length, 3);
  assert.doesNotMatch(source, /max-w-lg/);
  assert.doesNotMatch(source, /max-w-fin-drawer/);
  for (const utility of [
    "max-w-fin-window",
    "max-w-fin-subscription",
    "z-[1100]",
    "z-[1101]",
    "pt-[calc(var(--top)_+_16px)]",
    "max-h-[calc(100dvh_-_var(--top)_-_40px)]",
    "min-h-[min(80dvh,820px)]",
    "[scrollbar-width:none]",
    "[&::-webkit-scrollbar]:hidden",
  ]) {
    assert.ok(classes.includes(utility), `faltou a utility ${utility}`);
  }
  for (const marker of [
    'import { createPortal } from "react-dom";',
    'const subscriptionBackdropTw="fixed inset-0 z-[1100] grid items-start justify-items-center overflow-y-auto',
    'const drawerTw="relative z-10 grid max-h-dvh w-full max-w-fin-window',
    'const dialogTw="relative z-10 flex max-h-dvh w-full max-w-fin-window',
    'const newSubscriptionDialogTw="relative z-[1101] flex max-h-[calc(100dvh_-_var(--top)_-_40px)] min-h-[min(80dvh,820px)] w-full max-w-fin-subscription',
    'return createPortal(<div className={subscriptionBackdropTw}',
    '</div>,window.document.body);',
    'aria-label="Preparar cobrança"',
    'aria-labelledby="confirm-delete-title"',
    'aria-labelledby="new-sub-title"',
  ]) {
    assert.ok(source.includes(marker), `faltou ${marker}`);
  }
});

test("a home retorna ao Asaas na aba de origem depois do catálogo", () => {
  assert.match(homePage, /const \[catalogReturnTo, setCatalogReturnTo\]/);
  assert.match(homePage, /useState<"overview" \| "subscriptions" \| "catalog">\("overview"\)/);
  assert.match(homePage, /if \(origin === "finance-subscriptions"\) setFinanceInitialTab\("subscriptions"\)/);
  assert.match(homePage, /else if \(origin === "finance-catalog"\) setFinanceInitialTab\("catalog"\)/);
  assert.match(homePage, /setActive\(paymentProviderLabel\)/);
  assert.match(homePage, /function closeCatalog\(/);
  assert.ok(homePage.includes('catalogReturnTo === "finance-catalog" ? `Voltar ao ${paymentProviderLabel}`'));
  assert.ok(homePage.includes('catalogReturnTo === "finance-subscriptions" ? "Voltar às Assinaturas"'));
});

test("o JSX financeiro mantém os gráficos como dados, sem cor de marca fixa", () => {
  assert.match(source, /style=\{\{background:wafflePalette\[slot%wafflePalette\.length\]\}\}/);
  assert.match(source, /style=\{\{background:"conic-gradient\("\+item\.color\+" "\+percentage\+"%,var\(--s2\) 0\)"\}\}/);
  assert.match(source, /style=\{\{width:Math\.max\(3,share\)\+"%",background:"linear-gradient\(90deg,"\+palette\[0\]\+","\+palette\[1\]\+"\)"\}\}/);
  assert.doesNotMatch(source, /color-mix\(/);
});

test("a home abre o Catálogo em processo próprio mediante evento interno", () => {
  assert.match(homePage, /addEventListener\("vexora:open-catalog"/);
  assert.match(homePage, /setActive\("Catálogo"\)/);
  assert.match(homePage, /removeEventListener\("vexora:open-catalog"/);
  assert.match(homePage, /\["OWNER",\s*"ADMIN",\s*"MANAGER"\]/);
});

test("a política de follow-up é persistida e não simula envios", () => {
  assert.match(source, /<FinanceFollowUpPolicyWorkspace\/>/);
  for (const marker of [
    'fetch("/api/backend/finance/follow-up-policy"',
    'method: "PUT"',
    'Política salva no servidor. Nenhum envio foi feito.',
    'disabled={saving || loading || policy.variants.length < 5}',
    'O opt-out do cliente é sempre respeitado',
    'Prévia da primeira variante',
  ]) {
    assert.ok(followUp.includes(marker), `faltou ${marker}`);
  }
  assert.doesNotMatch(followUp, /templateId/);
  assert.doesNotMatch(followUp, /enviar mensagem agora/);
});
