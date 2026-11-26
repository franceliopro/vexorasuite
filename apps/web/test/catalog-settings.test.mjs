import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const read = (file) => fs.readFileSync(new URL(`../${file}`, import.meta.url), "utf8");
const component = read("src/app/catalog-settings.tsx");
const home = read("src/app/page.tsx");
const settings = read("src/app/settings-catalog.tsx");
const picker = read("src/app/catalog-image-picker.tsx");
const finance = read("src/app/finance-workspace.tsx");

test("o catálogo usa apenas endpoints tenant-scoped da API", () => {
  assert.match(component, /\/api\/backend\/catalog\?limit=200&includeInactive=true/);
  assert.match(component, /method: "POST"/);
  assert.match(component, /method: "PUT"/);
  assert.match(component, /method: "DELETE"/);
  assert.match(component, /active: true/);
});

test("a gestão do catálogo respeita OWNER e ADMIN", () => {
  assert.match(component, /canManage: boolean/);
  assert.match(component, /if \(!canManage\) return/);
  assert.match(component, /Somente OWNER e ADMIN podem alterar o catálogo/);
  assert.match(home, /<CatalogSettings canManage=\{canManage\} \/>/);
  assert.match(home, /const canManage = \["OWNER", "ADMIN"\]/);
});

test("Configurações abre o catálogo sem mexer em Planos e preços", () => {
  assert.match(home, /import \{ CatalogSettings \} from "\.\/catalog-settings";/);
  assert.ok(home.includes('onCatalog={() => { setCatalogReturnTo("settings"); setSettingsCatalogOpen(true); }}'));
  assert.match(home, /active === "Planos e preços"/);
  assert.doesNotMatch(home, /active === "Planos e pacotes"/);
  assert.match(settings, /action: "catalog"/);
  assert.match(settings, /title: "Catálogo"/);
  assert.match(settings, /onCatalog\(\)/);
});

test("os controles do catálogo têm identificadores estáveis", () => {
  for (const hook of [
    'data-testid="catalog-settings"',
    'data-testid="catalog-settings-form"',
    'data-testid="catalog-settings-list"',
    'data-testid="catalog-settings-save"',
    'data-testid="catalog-settings-deactivate"',
    'data-testid="catalog-settings-reactivate"',
    'data-testid="catalog-item-price"',
    'data-testid="catalog-settings-image-picker"',
    'data-testid="catalog-settings-image-value"',
  ]) {
    assert.ok(component.includes(hook), `perdeu ${hook}`);
  }
});

test("o cadastro cria itens visíveis no Financeiro por padrão", () => {
  assert.match(component, /category: "ASAAS"/);
  assert.match(component, /category: draft\.category\.trim\(\) \|\| "ASAAS"/);
  assert.match(component, /Use <strong>ASAAS<\/strong> para este item aparecer/);
  assert.match(component, /safeCatalogImageUrl\(draft\.imageUrl\)/);
});

test("o seletor de imagem aceita PC, Google Drive conectado e URL", () => {
  for (const marker of [
    'data-testid="catalog-image-picker"',
    'data-testid="catalog-image-picker-assets"',
    'data-testid="catalog-image-picker-drive"',
    'data-testid="catalog-image-picker-url"',
    'data-testid="catalog-image-picker-confirm"',
    'api<{ assets: Asset[] }>("/sites/assets"',
    'api<DriveAccount[]>("/drive-manager/accounts")',
    'api<{ files?: DriveFile[] }>(`/drive-manager/${encodeURIComponent(accountId)}/files?${params.toString()}`)',
    '"/api/backend/sites/assets"',
    'Nenhuma conta do Google Drive conectada para esta empresa',
    'role="tablist" aria-label="Origem da imagem"',
  ]) {
    assert.ok(picker.includes(marker), `perdeu ${marker}`);
  }
  assert.ok(picker.includes('/^https?:\\/\\//i'));
  assert.doesNotMatch(picker, /api<[^>]+>\("\/api\/backend\//);
});

test("o botão Voltar do catálogo devolve ao módulo de origem", () => {
  assert.ok(finance.includes('window.dispatchEvent(new CustomEvent("vexora:open-catalog",{detail:origin}))'));
  assert.match(home, /setCatalogReturnTo\(fromFinance \? origin : "settings"\)/);
  assert.match(home, /Voltar para \{catalogReturnTo === "finance-products"/);
  assert.match(home, /<FinanceWorkspace initialTab=\{financeInitialTab\} \/>/);
});
