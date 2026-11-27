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
  assert.match(component, /includeInactive=true/);
});

test("a gestão do catálogo respeita OWNER e ADMIN", () => {
  assert.match(component, /canManage: boolean/);
  assert.match(component, /if \(!canManage\) return/);
  assert.match(component, /Somente OWNER e ADMIN podem alterar o catálogo/);
  assert.match(home, /<CatalogSettings canManage=\{canManage\} initialItemId=\{catalogEditId\} backLabel=\{catalogBackLabel\} onBack=\{closeCatalog\} \/>/);
  assert.match(home, /const canManage = \["OWNER", "ADMIN"\]/);
});

test("o Catálogo é um processo próprio na navegação", () => {
  assert.ok(home.includes('{ label: "Catálogo", icon: "package" }'));
  assert.ok(home.includes("'Catálogo':'SETTINGS'"));
  assert.ok(home.includes('"Catálogo":()=>import("./catalog-settings")'));
  assert.match(home, /active === "Catálogo" \?/);
  assert.match(home, /setActive\("Catálogo"\)/);
  assert.doesNotMatch(home, /settingsCatalogOpen/);
});

test("Configurações abre o Catálogo sem mexer em Planos e preços", () => {
  assert.match(home, /import \{ CatalogSettings \} from "\.\/catalog-settings";/);
  assert.ok(home.includes('onCatalog={() => { setCatalogReturnTo("settings"); setCatalogEditId(""); setActive("Catálogo"); }}'));
  assert.match(home, /active === "Planos e preços"/);
  assert.doesNotMatch(home, /active === "Planos e pacotes"/);
  assert.match(settings, /action: "catalog"/);
  assert.match(settings, /title: "Catálogo"/);
  assert.match(settings, /onCatalog\(\)/);
});

test("os controles do catálogo têm identificadores estáveis", () => {
  for (const hook of [
    'data-testid="catalog-settings"',
    'data-testid="catalog-settings-cards"',
    'data-testid="catalog-settings-form"',
    'data-testid="catalog-settings-save"',
    'data-testid="catalog-settings-name"',
    'data-testid="catalog-settings-price"',
    'data-testid="catalog-settings-image-picker"',
    'data-testid="catalog-settings-image-value"',
    'data-testid="catalog-settings-finance-provider"',
  ]) {
    assert.ok(component.includes(hook), `perdeu ${hook}`);
  }
});

test("o cadastro cria itens visíveis no Asaas por padrão", () => {
  assert.match(component, /category: "ASAAS"/);
  assert.match(component, /category: draft\.category\.trim\(\) \|\| "ASAAS"/);
  assert.match(component, /Use <strong>ASAAS<\/strong> para este item aparecer/);
  assert.match(component, /safeCatalogImageUrl\(draft\.imageUrl\)/);
});

test("a capa é 1:1, centralizada e mostra a arte inteira em fundo cinza claro", () => {
  assert.ok(component.includes('const coverFrameTw = "relative grid aspect-square w-full place-items-center overflow-hidden rounded-token-sm border border-gray-200 bg-zinc-200"'));
  assert.ok(component.includes('const coverImageTw = "absolute inset-2 m-auto size-auto max-h-[calc(100%-1rem)] max-w-[calc(100%-1rem)] object-contain"'));
  assert.ok(picker.includes('const previewFrameTw = "relative grid aspect-square w-24 place-items-center overflow-hidden rounded-token-sm border border-line bg-zinc-200"'));
  assert.ok(picker.includes('m-auto size-auto max-h-[calc(100%-0.5rem)] max-w-[calc(100%-0.5rem)] object-contain'));
  assert.doesNotMatch(component, /object-cover/);
  assert.doesNotMatch(picker, /const previewFrameTw = "grid h-24/);
});

test("todos os cards têm a mesma altura e expandem juntos", () => {
  assert.ok(component.includes('const catalogGridTw = "grid grid-cols-1 items-stretch gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4"'));
  assert.ok(component.includes('const catalogCardTw = "grid h-72 grid-rows-[auto_minmax(0,1fr)_auto] gap-2 overflow-hidden rounded-token border border-gray-200 bg-zinc-100 p-2'));
  assert.ok(component.includes('const catalogCardExpandedTw = "h-96"'));
  assert.ok(component.includes('const cardDescriptionTw = "m-0 line-clamp-2 text-small leading-relaxed text-slate-600"'));
  assert.ok(component.includes('data-expanded={expandedId ? "true" : "false"}'));
  assert.ok(component.includes('aria-expanded={expanded}'));
  assert.ok(component.includes('className={`${catalogCardTw} ${expanded ? catalogCardExpandedTw : ""}`}'));
  assert.ok(component.includes('setExpandedId(expanded ? "" : item.id)'));
});

test("clicar fora dos cards volta ao estado normal", () => {
  assert.ok(component.includes("document.addEventListener(\"mousedown\", collapseOutside)"));
  assert.ok(component.includes("gridRef.current?.contains(event.target)"));
  assert.ok(component.includes('setExpandedId("")'));
  assert.ok(component.includes('onClick={(event) => { event.stopPropagation(); startEdit(item); }}'));
});

test("o seletor de imagem aceita PC, Google Drive conectado e URL", () => {
  for (const marker of [
    'data-testid="catalog-image-picker"',
    'data-testid="catalog-image-picker-assets"',
    'data-testid="catalog-image-picker-drive"',
    'data-testid="catalog-image-picker-url"',
    'data-testid="catalog-image-picker-confirm"',
    'createPortal(',
    'useModalDialog(open && mounted, dialogRef, onClose)',
    'style={{ zIndex: 1000 }}',
    'max-h-72',
    'api<{ assets: Asset[] }>("/catalog-images"',
    'api<DriveAccount[]>("/drive-manager/accounts")',
    'api<{ files?: DriveFile[] }>(`/drive-manager/${encodeURIComponent(accountId)}/files?${params.toString()}`)',
    '"/api/backend/catalog-images"',
    '"/catalog-images/from-drive"',
    'Nenhuma conta do Google Drive conectada para esta empresa',
    'role="tablist" aria-label="Origem da imagem"',
    'Escolher imagem do item do catálogo',
  ]) {
    assert.ok(picker.includes(marker), `perdeu ${marker}`);
  }
  assert.ok(picker.includes('/^https?:\\/\\//i'));
  assert.doesNotMatch(picker, /api<[^>]+>\("\/api\/backend\//);
  assert.doesNotMatch(picker, /\/drive-manager\/\$\{encodeURIComponent\(accountId\)\}\/files\/\$\{encodeURIComponent\(file\.id\)\}\/content/);
});

test("o botão Voltar do catálogo devolve ao módulo de origem", () => {
  assert.ok(finance.includes('window.dispatchEvent(new CustomEvent("vexora:open-catalog",{detail:{origin:"finance-subscriptions",itemId:itemId||""}}))'));
  assert.match(home, /const origin = detail\.origin \|\| "settings"/);
  assert.match(home, /onBack=\{closeCatalog\}/);
  assert.match(home, /<FinanceWorkspace initialTab=\{financeInitialTab\} \/>/);
  assert.match(component, /backLabel = "Voltar às Configurações"/);
});

test("o cadastro é a única janela de edição e abre em modo de edição", () => {
  assert.match(component, /initialItemId = ""/);
  assert.match(component, /initialItemId\?: string/);
  assert.match(component, /const appliedEditId = useRef\(""\)/);
  assert.match(component, /const item = items\.find\(\(entry\) => entry\.id === initialItemId\)/);
  assert.ok(component.includes('{editingId ? "Salvar alterações" : "Adicionar item"}'));
  assert.ok(component.includes('{backLabel}</button>'));
  assert.ok(component.includes('data-testid="catalog-settings-new"'));
  assert.doesNotMatch(component, /data-testid="catalog-settings-list"/);
  assert.doesNotMatch(component, /data-testid="catalog-settings-search"/);
  assert.doesNotMatch(component, /Filtrar por tipo/);
  assert.doesNotMatch(component, /Voltar à lista/);
  assert.doesNotMatch(component, /Cancelar edição/);
  assert.match(home, /const \[catalogEditId, setCatalogEditId\] = useState\(""\)/);
  assert.match(home, /setCatalogEditId\(itemId\)/);
  assert.ok(finance.includes('function openCatalogSettings(itemId?:string)'));
  assert.ok(finance.includes('openCatalogSettings()'));
  assert.ok(finance.includes('origin:"finance-subscriptions"'));
});

test("a preferência financeira fica no Catálogo e não cria cobrança", () => {
  for (const marker of [
    'data-testid="catalog-settings-finance-provider"',
    '"/api/backend/finance/catalog-provider"',
    'method: "PUT"',
    'Sistema financeiro do catálogo',
    'Nenhuma cobrança foi criada',
    'Nenhuma plataforma está habilitada e configurada nesta empresa',
    'saveFinanceProvider(event.target.value)',
  ]) {
    assert.ok(component.includes(marker), `perdeu ${marker}`);
  }
  assert.match(component, /setFinanceProvider\(await api<FinanceProviderState>\("\/api\/backend\/finance\/catalog-provider"\)\)/);
});
