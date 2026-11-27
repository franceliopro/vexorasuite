import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const source = fs.readFileSync(new URL("../src/app/finance-provider-workspace.tsx", import.meta.url), "utf8");
const page = fs.readFileSync(new URL("../src/app/page.tsx", import.meta.url), "utf8");

test("Financeiro é o menu; Asaas, InfinitePay e Stripe são o submenu e herdam FINANCE", () => {
  assert.match(page, /label: "Financeiro", icon: "wallet", children: \[/);
  assert.ok(page.includes('"Financeiro":()=>import("./finance-workspace")'));
  assert.ok(page.includes('"Asaas":()=>import("./finance-workspace")'));
  assert.match(page, /active === "Asaas" \|\| active === "Financeiro" \|\| active === "Gestão"/);
  assert.match(page, /<FinanceWorkspace initialTab=\{financeInitialTab\} \/>/);
  const submenuOrder = ["Asaas", "InfinitePay", "Stripe"].map((label) => page.indexOf(`{ label: "${label}", icon:`));
  assert.ok(submenuOrder.every((position) => position >= 0), "submenu Financeiro incompleto");
  assert.deepEqual(submenuOrder, [...submenuOrder].sort((a, b) => a - b), "submenu deve seguir Asaas, InfinitePay e Stripe");
  for (const label of ["Asaas", "InfinitePay", "Stripe"]) {
    assert.ok(page.includes(`'${label}':'FINANCE'`), `falta a permissão de ${label}`);
    assert.ok(page.includes(`"${label}":()=>import("./${label === "Asaas" ? "finance-workspace" : "finance-provider-workspace"}")`), `falta o preload de ${label}`);
  }
  assert.match(page, /active === "Stripe" \|\| active === "InfinitePay"/);
  assert.match(page, /<FinanceProviderWorkspace provider=\{active === "Stripe" \? "STRIPE" : "INFINITEPAY"\} \/>/);
  assert.match(source, /fetch\("\/api\/backend\/finance\/catalog-provider"/);
  assert.match(source, /item\.id !== "catalog" \|\| catalogProvider === provider/);
  assert.match(source, /export function normalizeFinanceProvider/);
  assert.ok(source.includes('Stripe: "STRIPE"'));
  assert.ok(source.includes('InfinitePay: "INFINITEPAY"'));
  assert.doesNotMatch(page, /setExpandedModules\(\[\]\); \}\}><span className=\{navSubitemClass/);
});

test("o Catálogo integrado devolve ao Asaas na aba de catálogo", () => {
  assert.match(page, /useState<"settings" \| "finance-subscriptions" \| "finance-catalog">/);
  assert.ok(page.includes('catalogReturnTo === "finance-catalog" ? `Voltar ao ${paymentProviderLabel}`'));
  assert.match(page, /origin === "finance-subscriptions" \|\| origin === "finance-catalog"/);
  assert.match(page, /else if \(origin === "finance-catalog"\) setFinanceInitialTab\("catalog"\)/);
});

test("o painel do provedor usa endpoints tenant-scoped e declara a origem", () => {
  for (const marker of [
    'fetch(`/api/backend/finance/providers/${provider}`',
    '`/api/backend/finance/${provider}/dashboard?months=${months}`',
    '`/api/backend/finance/${provider}/${tab}?offset=0&limit=50`',
    'sourceLabel(row.value.source)',
    'Registros locais da Véxora',
    'Dados consultados no provedor',
    'dashboard.caveat',
    'list.caveat',
    'aria-label={`Áreas do ${descriptor?.label || provider}`}',
    'role="group" aria-label="Período do painel"',
  ]) assert.ok(source.includes(marker), `faltou ${marker}`);
});

test("o painel não transforma configuração em conexão, pagamento ou API inexistente", () => {
  assert.match(source, /descriptor\.verification\.note/);
  assert.match(source, /Status de configuração não é confirmação de pagamento/);
  assert.match(source, /Não existe API documentada/);
  assert.match(source, /Não disponível pela API documentada/);
  assert.match(source, /Nenhuma operação externa é executada por esta tela/);
  assert.match(source, /descriptor\.capabilities\.subscriptions/);
  assert.match(source, /descriptor\.capabilities\.pixQrCode/);
  assert.match(source, /descriptor\.capabilities\.sandbox/);
  assert.doesNotMatch(source, /connected: true/);
  assert.doesNotMatch(source, /pagamento confirmado/);
  assert.doesNotMatch(source, /estorno executado/);
});

test("o painel não introduz valores arbitrários de Tailwind nem janelas extras", () => {
  assert.doesNotMatch(source, /\[[a-z-]+:\s*[^]\s]+\]/);
  assert.doesNotMatch(source, /role="dialog"/);
  assert.doesNotMatch(source, /createPortal/);
  assert.match(source, /<details className=\{cardTw\}>/);
});
