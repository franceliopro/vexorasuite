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

test("a capa é 16:9, centralizada e mostra a arte inteira em fundo cinza claro", () => {
  assert.ok(component.includes('const coverFrameTw = "relative grid aspect-video w-full place-items-center overflow-hidden rounded-token-sm border border-gray-200 bg-zinc-200"'));
  assert.ok(component.includes('const coverImageTw = "absolute inset-2 m-auto size-auto max-h-[calc(100%-1rem)] max-w-[calc(100%-1rem)] object-contain"'));
  assert.ok(picker.includes('const previewFrameTw = "relative grid aspect-square w-24 place-items-center overflow-hidden rounded-token-sm border border-line bg-zinc-200"'));
  assert.ok(picker.includes('m-auto size-auto max-h-[calc(100%-0.5rem)] max-w-[calc(100%-0.5rem)] object-contain'));
  assert.doesNotMatch(component, /object-cover/);
  assert.doesNotMatch(component, /const coverFrameTw = "relative grid aspect-square/);
  assert.doesNotMatch(picker, /const previewFrameTw = "grid h-24/);
});

test("a listagem abre com um resumo visível dos itens e da vitrine aprovada", () => {
  for (const marker of [
    'data-testid="catalog-settings-summary"',
    'const summaryTw = "grid grid-cols-2 gap-2 sm:grid-cols-4"',
    '<span className={summaryLabelTw}>Itens</span>',
    '<span className={summaryLabelTw}>Ativos</span>',
    '<span className={summaryLabelTw}>Com descrição pública</span>',
    '<span className={summaryLabelTw}>Com link aprovado</span>',
    'items.filter((item) => !!item.publicDescription).length',
    'items.filter((item) => !!item.publicLink).length',
  ]) {
    assert.ok(component.includes(marker), `perdeu ${marker}`);
  }
});

test("todos os cards grandes têm a mesma altura e expandem juntos", () => {
  assert.ok(component.includes('const catalogGridTw = "grid grid-cols-1 items-stretch gap-4 sm:grid-cols-2 xl:grid-cols-3"'));
  assert.ok(component.includes('const catalogCardTw = "grid h-128 grid-rows-[auto_minmax(0,1fr)_auto] gap-3 overflow-hidden rounded-token border border-gray-200 bg-zinc-100 p-3'));
  assert.ok(component.includes('const catalogCardExpandedTw = "h-168"'));
  assert.ok(component.includes('const cardDescriptionTw = "m-0 line-clamp-2 text-small leading-relaxed text-slate-600"'));
  assert.ok(component.includes('data-expanded={expandedId ? "true" : "false"}'));
  assert.ok(component.includes('aria-expanded={expanded}'));
  assert.ok(component.includes('className={`${catalogCardTw} ${expanded ? catalogCardExpandedTw : ""}`}'));
  assert.ok(component.includes('setExpandedId(expanded ? "" : item.id)'));
});

test("o card mostra todos os dados do item com descrição pública separada da privada", () => {
  for (const marker of [
    'data-testid="catalog-settings-card-details"',
    '<span className={cardDetailLabelTw}>SKU:</span>',
    '<span className={cardDetailLabelTw}>Unidade:</span>',
    '<span className={cardDetailLabelTw}>Categoria:</span>',
    '<span className={cardDetailLabelTw}>Situação:</span>',
    '<span className={cardDetailLabelTw}>Descrição pública da vitrine (campo separado):</span>',
    '<span className={cardDetailLabelTw}>Imagem pública:</span>',
    '<span className={cardDetailLabelTw}>Link público:</span>',
    '<small className="text-2xs font-bold uppercase tracking-wide text-slate-500">Descrição interna (somente na gestão)</small>',
    'A descrição interna não é enviada à vitrine.',
    'className={coverFrameTw}',
    'const coverFrameTw = "relative grid aspect-video w-full',
  ]) {
    assert.ok(component.includes(marker), `perdeu ${marker}`);
  }
  const details = component.slice(component.indexOf('<div className={cardDetailTw}'), component.indexOf('className={cardDetailLabelTw}>Imagem interna:'));
  assert.ok(details.includes('item.sku'));
  assert.ok(details.includes('item.unit'));
  assert.ok(details.includes('item.category'));
  assert.ok(details.includes('item.active'));
  assert.ok(details.includes('item.publicDescription'));
  assert.ok(details.includes('item.publicImageUrl'));
  assert.ok(details.includes('item.publicLink'));
  assert.ok(!details.includes('item.description'), "descrição privada não deve ocupar o campo público do card");
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

test("a preferência financeira é um seletor compacto no Catálogo e não cria cobrança", () => {
  for (const marker of [
    'data-testid="catalog-settings-finance-provider"',
    '"/api/backend/finance/catalog-provider"',
    'method: "PUT"',
    'Sistema financeiro do catálogo',
    'Plataforma de pagamento preferida',
    '{ provider: "ASAAS", label: "Asaas" }',
    '{ provider: "INFINITEPAY", label: "InfinitePay" }',
    '{ provider: "STRIPE", label: "Stripe" }',
    'const compactProviderTw = "grid gap-3 rounded-token-sm border border-gray-200 bg-zinc-100 p-3 sm:grid-cols-[minmax(0,18rem)_minmax(0,1fr)] sm:items-center"',
    'Preferência tenant-scoped do catálogo',
    'nenhuma credencial é copiada para cá',
    'Nenhuma cobrança foi criada',
    'Nenhuma plataforma está habilitada e configurada nesta empresa',
    'saveFinanceProvider(event.target.value)',
    '<section data-testid="catalog-settings-finance-provider"',
  ]) {
    assert.ok(component.includes(marker), `perdeu ${marker}`);
  }
  assert.match(component, /setFinanceProvider\(await api<FinanceProviderState>\("\/api\/backend\/finance\/catalog-provider"\)\)/);
  assert.doesNotMatch(component, /<details data-testid="catalog-settings-finance-provider"/);
  assert.match(component, /CATALOG_PAYMENT_PROVIDERS\.map\(\(\{ provider, label \}\)/);
});

test("a publicação por plataforma é explícita, tenant-scoped e não inventa links", () => {
  for (const marker of [
    'data-testid="catalog-settings-publication"',
    'data-testid="catalog-publication-item"',
    'data-testid="catalog-publication-status"',
    'data-testid="catalog-publication-confirm"',
    'data-testid="catalog-publication-import"',
    'data-testid="catalog-import-provider"',
    'data-testid="catalog-import-candidate"',
    'data-testid="catalog-import-confirm"',
    '{ provider: "ASAAS", label: "Asaas", verb: "Publicar no Asaas" }',
    '{ provider: "STRIPE", label: "Stripe", verb: "Publicar na Stripe" }',
    '{ provider: "INFINITEPAY", label: "InfinitePay", verb: "Publicar na InfinitePay" }',
    'NOT_PUBLISHED: "Não publicado"',
    'PUBLISHED: "Objeto confirmado"',
    'PARTIAL: "Parcial"',
    'FAILED: "Falhou"',
    'IMPORTED: "Importado"',
    'data-provider={provider}',
    'data-status={status}',
    'state?.externalUrl ?',
    'href={state.externalUrl}',
    'target="_blank" rel="noopener noreferrer"',
    'Abrir link confirmado pela plataforma',
    'body: JSON.stringify({ provider, confirm: true })',
    'body: JSON.stringify({ provider: importProvider, externalId: candidate.externalId, confirm: true })',
    'Nenhuma cobrança, pedido ou envio será executado.',
    'Descrição pública, imagem pública, link público, SKU, unidade e categoria continuam sendo preenchidos na Véxora.',
  ]) {
    assert.ok(component.includes(marker), `perdeu ${marker}`);
  }
  assert.match(component, /\/api\/backend\/catalog\/publications\/\$\{encodeURIComponent\(publicationItemId\)\}/);
  assert.match(component, /\/api\/backend\/catalog\/publications\/import\/preview\?provider=\$\{encodeURIComponent\(provider\)\}&limit=50/);
  assert.ok(component.includes('"/api/backend/catalog/publications/import"'));
  assert.equal((component.match(/confirm: true/g) || []).length, 2);
  assert.doesNotMatch(component, /https:\/\/(?:www\.)?asaas\.com\/c\//);
  assert.doesNotMatch(component, /https:\/\/checkout\.infinitepay\.io\//);
  assert.ok(component.indexOf('data-testid="catalog-settings-publication"') > component.indexOf('data-testid="catalog-settings-finance-provider"'));
  assert.ok(component.indexOf('data-testid="catalog-settings-publication"') < component.indexOf('data-testid="catalog-settings-storefront"'));
});

test("os campos públicos são distintos dos campos internos e privados", () => {
  for (const marker of [
    'publicDescription: string | null;',
    'publicImageUrl: string | null;',
    'publicLink: string | null;',
    'publicDescription: string;',
    'publicImageUrl: string;',
    'publicLink: string;',
    'data-testid="catalog-settings-public-fields"',
    'data-testid="catalog-settings-public-description"',
    'data-testid="catalog-settings-public-image"',
    'data-testid="catalog-settings-public-link"',
    'Descrição pública da vitrine',
    'Imagem pública da vitrine (HTTPS)',
    'Link público de solicitação de proposta (HTTPS)',
    'Somente estes três campos são enviados para a vitrine externa. A descrição e a imagem internas continuam privadas na Véxora.',
    'publicDescription: draft.publicDescription.trim(),',
    'publicImageUrl: draft.publicImageUrl.trim(),',
    'publicLink: draft.publicLink.trim(),',
    'Campo interno da Véxora. Não é enviado à vitrine externa.',
    'Capa interna da Véxora. Não é enviada à vitrine externa.',
    'role="dialog" aria-modal="true" aria-labelledby="catalog-settings-form-title"',
  ]) {
    assert.ok(component.includes(marker), `perdeu ${marker}`);
  }
  assert.match(component, /\{formOpen && canManage \? <div className=\{modalBackdropTw\}[\s\S]{0,8000}?data-testid="catalog-settings-public-fields"/);
  assert.match(component, /imageUrl: safeCatalogImageUrl\(draft\.imageUrl\),\s*publicDescription: draft\.publicDescription\.trim\(\),/);
  assert.match(component, /description: draft\.description\.trim\(\),[\s\S]{0,400}?imageUrl: safeCatalogImageUrl\(draft\.imageUrl\),[\s\S]{0,200}?publicDescription: draft\.publicDescription\.trim\(\),/);
  assert.doesNotMatch(component, /publicDescription:\s*draft\.description/);
  assert.doesNotMatch(component, /publicImageUrl:\s*safeCatalogImageUrl\(draft\.imageUrl\)/);
  assert.doesNotMatch(component, /description:\s*draft\.publicDescription/);
  assert.equal((component.match(/publicDescription: item\.publicDescription \|\| ""/g) || []).length, 2);
  assert.equal((component.match(/publicImageUrl: item\.publicImageUrl \|\| ""/g) || []).length, 2);
  assert.equal((component.match(/publicLink: item\.publicLink \|\| ""/g) || []).length, 2);
  assert.match(component, /Imagem pública da vitrine: use um link HTTPS\./);
  assert.match(component, /Link público de solicitação de proposta: use um link HTTPS\./);
});

test("a vitrine pública usa apenas os endpoints administrativos e não inventa domínio", () => {
  for (const marker of [
    '{canManage ? <details data-testid="catalog-settings-storefront"',
    '"/api/backend/storefront/tokens"',
    '/api/backend/storefront/tokens/${encodeURIComponent(id)}',
    'method: "DELETE"',
    'data-testid="catalog-storefront-name"',
    'data-testid="catalog-storefront-site-url"',
    'data-testid="catalog-storefront-create"',
    'data-testid="catalog-storefront-token-value"',
    'data-testid="catalog-storefront-revoke"',
    'data-testid="catalog-storefront-preview"',
    '{createdToken.warning}',
    'Ter token ou URL não significa que o site esteja publicado, no ar ou conectado.',
    'URL da vitrine não configurada. Nenhum link de prévia é exibido.',
    'Token revogado. Nenhum site foi despublicado por esta ação.',
  ]) {
    assert.ok(component.includes(marker), `perdeu ${marker}`);
  }
  assert.equal((component.match(/if \(!canManage \|\| storefrontBusy\) return;/g) || []).length, 3);
  assert.match(component, /url\.protocol !== "https:"/);
  assert.match(component, /\/servicos\//);
  assert.doesNotMatch(component, /https:\/\/[a-z0-9.-]+\/servicos\//);
});

test("o Catálogo é uma gestão completa com a listagem como tela inicial", () => {
  for (const marker of [
    '<h2 id="catalog-settings-title" className={headingTitleTw}>Catálogo da empresa</h2>',
    'useModalDialog(formOpen, modalRef, () => { if (!busy) setFormOpen(false); });',
    'const modalRef = useRef<HTMLElement | null>(null);',
    '{formOpen && canManage ? <div className={modalBackdropTw}',
    'role="dialog" aria-modal="true" aria-labelledby="catalog-settings-form-title"',
    'aria-label="Fechar"',
    'function openNew()',
    'active: item.active !== false,',
    'active: draft.active,',
    'Item ativo',
    'Itens inativos ficam fora do catálogo usado no atendimento e na vitrine pública.',
    'Descrição interna (somente na gestão)',
    'Capa interna da Véxora. Não é enviada à vitrine externa.',
    'data-testid="catalog-settings-card-details"',
    '<span className={cardDetailLabelTw}>SKU:</span>',
    '<span className={cardDetailLabelTw}>Unidade:</span>',
    '<span className={cardDetailLabelTw}>Categoria:</span>',
    '<span className={cardDetailLabelTw}>Situação:</span>',
    '<span className={cardDetailLabelTw}>Descrição pública da vitrine (campo separado):</span>',
    '<span className={cardDetailLabelTw}>Imagem pública:</span>',
    '<span className={cardDetailLabelTw}>Link público:</span>',
    'Nenhum item cadastrado nesta empresa. Use “Novo item” para adicionar o primeiro.',
    '<section data-testid="catalog-settings-finance-provider"',
    '<details data-testid="catalog-settings-storefront"',
  ]) {
    assert.ok(component.includes(marker), `perdeu ${marker}`);
  }
  assert.match(component, /onClick=\{openNew\}/);
  assert.match(component, /setFormOpen\(false\)/);
  assert.doesNotMatch(component, /{canManage \? <div data-testid="catalog-settings-form"/);
  assert.doesNotMatch(component, /aspect-square w-full/);
  assert.ok(component.indexOf('<section data-testid="catalog-settings-finance-provider"') > component.indexOf('data-testid="catalog-settings-cards"'));
  assert.ok(component.indexOf('data-testid="catalog-settings-storefront"') > component.indexOf('<section data-testid="catalog-settings-finance-provider"'));
  assert.ok(component.indexOf('data-testid="catalog-settings-storefront"') < component.indexOf('role="dialog" aria-modal="true"'));
});
