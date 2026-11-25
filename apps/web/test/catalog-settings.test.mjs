import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const read = (file) => fs.readFileSync(new URL(`../${file}`, import.meta.url), "utf8");
const component = read("src/app/catalog-settings.tsx");
const home = read("src/app/page.tsx");
const settings = read("src/app/settings-catalog.tsx");

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
  assert.match(home, /onCatalog=\{\(\) => setSettingsCatalogOpen\(true\)\}/);
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
  ]) {
    assert.ok(component.includes(hook), `perdeu ${hook}`);
  }
});
