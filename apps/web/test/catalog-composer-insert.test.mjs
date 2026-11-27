import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const read = (file) => fs.readFileSync(new URL(`../${file}`, import.meta.url), "utf8");
const panel = read("src/app/catalog-quote-panel.tsx");
const inbox = read("src/app/inbox-workspace.tsx");

test("o painel do catálogo pode inserir o snapshot escolhido na mensagem", () => {
  assert.match(panel, /onInsert\?: \(text: string\) => void/);
  assert.match(panel, /function insertSnapshot\(\)/);
  assert.match(panel, /if \(!selectedItems\.length \|\| !onInsert\) return/);
  assert.match(panel, /\$\{qty\}x \$\{item\.name\}/);
  assert.match(panel, /money\(item\.priceCents \* qty, item\.currency\)/);
  assert.match(panel, /onInsert\(`\*Itens do catálogo\*/);
  assert.match(panel, /onClose\(\)/);
  assert.ok(panel.includes('data-testid="catalog-quote-insert"'));
});

test("a vitrine pública insere texto no compositor sem enviar mensagem", () => {
  for (const marker of [
    'data-testid="catalog-quote-share"',
    'data-testid="catalog-quote-share-item"',
    'data-testid="catalog-quote-share-all"',
    'data-testid="catalog-quote-share-notice"',
    'data-testid="catalog-quote-share-error"',
    'Inserir link do item',
    'Inserir catálogo completo',
    '/api/backend/storefront/share',
    '?itemId=${encodeURIComponent(itemId)}',
    'onInsert(share.text)',
    'share.status === "UNCONFIGURED"',
    'Vitrine sem URL HTTPS configurada',
    '${share.notice || ""}',
    'Os botões só inserem texto no compositor; o envio continua humano.',
  ]) {
    assert.ok(panel.includes(marker), `perdeu ${marker}`);
  }
  assert.match(panel, /data-testid="catalog-quote-share-item"[\s\S]{0,220}disabled=\{shareBusy \|\| selectedItems\.length !== 1\}/);
  assert.match(panel, /data-testid="catalog-quote-share-all" className=\{shareButton\} disabled=\{shareBusy\}/);
  assert.match(panel, /typeof share\.text !== "string" \|\| !share\.text\.trim\(\)/);
  assert.doesNotMatch(panel, /\/servicos\//);
  const share = panel.match(/async function insertStorefrontLink\(itemId\?: string\) \{[\s\S]*?\n {2}\}/)?.[0] || "";
  assert.ok(share.length > 200);
  assert.doesNotMatch(share, /send-whatsapp|documents\/generate|onClose\(\)/);
});

test("o composer insere no caret sem trocar o texto existente", () => {
  assert.match(inbox, /function insertCatalogText\(text: string\)/);
  assert.match(inbox, /composerCaretRef\.current \?\? composerRef\.current\?\.selectionStart \?\? value\.length/);
  assert.match(inbox, /before \+ lead \+ text \+ tail \+ after/);
  assert.match(inbox, /setAttendantNote\(next\)/);
  assert.match(inbox, /setDraft\(next\)/);
  assert.match(inbox, /setQuickPanel\(null\)/);
  assert.match(inbox, /setSelectionRange\(pos, pos\)/);
});

test("a inserção usa o mesmo painel de todas as inboxes, sem mexer no botão +", () => {
  assert.match(inbox, /onInsert=\{\(text\) => insertCatalogText\(text\)\}/);
  assert.equal((inbox.match(/<CatalogQuotePanel /g) || []).length, 1);
  assert.equal((inbox.match(/data-testid="composer-tools"/g) || []).length, 1);
  const helper = inbox.match(/function insertCatalogText\(text: string\) \{[\s\S]*?\n {2}\}/)?.[0] || "";
  assert.ok(helper.length > 100);
  assert.doesNotMatch(helper, /setComposerMenuOpen/);
});
