import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

// Guard node:test puro: nenhuma dependência de node_modules.
const cwd = process.cwd();
const webRoot = fs.existsSync(path.join(cwd, 'apps/web/src/app/sites'))
  ? path.join(cwd, 'apps/web')
  : cwd;
const read = (file) => fs.readFileSync(path.join(webRoot, file), 'utf8');

const files = {
  shell: read('src/app/sites/editor/editor-shell.tsx'),
  inspector: read('src/app/sites/editor/inspector.tsx'),
  window: read('src/app/sites/site-editor-window.tsx'),
};

const UTILITY_HINT =
  /(?:^|\s)(?:flex|grid|inline-flex|inline-block|fixed|absolute|relative|block|hidden|peer|truncate|overflow|bg-|text-|border|rounded|p-|px-|py-|m-|mx-|my-|w-|h-|min-|max-|gap-|items-|justify|shadow|font-|cursor|opacity|disabled:|hover:|focus:|group|z-|animate-|transition|leading-|resize|placeholder:|basis-|list-|cursor-)/;

/** Resolve className e constantes/records de classes para auditar o que chega ao JSX. */
function classValues(source) {
  const values = [];
  for (const match of source.matchAll(/className\s*=\s*(?:"([^"]*)"|\{([\s\S]*?)\}|`([^`]*)`)/g)) {
    if (match[1] !== undefined) values.push(match[1]);
    else if (match[3] !== undefined) values.push(match[3]);
    else for (const literal of match[2].matchAll(/(['"])([^'"]*)\1/g)) values.push(literal[2]);
  }
  for (const literal of source.matchAll(/(['"`])([^'"\n`]{5,})\1/g)) {
    if (UTILITY_HINT.test(literal[2])) values.push(literal[2]);
  }
  return [...new Set(values)].join('\n');
}

const classes = Object.fromEntries(
  Object.entries(files).map(([name, source]) => [name, classValues(source)]),
);

// Variantes legadas explicitamente permitidas como público de breakpoint TW.
const ALLOWED_LEGACY_VARIANTS = /\b(?:ib-narrow|ov-laptop|rw-laptop):/g;
const stripAllowed = (value) => value.replace(ALLOWED_LEGACY_VARIANTS, '');

test('os 3 arquivos do editor não usam classes componente legadas', () => {
  const legacy = [
    'ov-',
    'vx-',
    'ib-',
    'rw-',
    'auth-',
    'alarm-',
    'platform-admin-',
    'vx-rich-',
    'vx-post-',
    'vx-gallery-',
    'design-approval-',
    'content-card',
    'settings-card',
    'primary-button',
    'secondary-button',
    'text-button',
    'icon-button',
    'vx-spin',
  ];
  for (const [name, value] of Object.entries(classes)) {
    const audited = stripAllowed(value);
    for (const token of legacy) {
      const pattern = new RegExp(token.endsWith('-') ? `\\b${token}` : `\\b${token}\\b`);
      const match = audited.match(pattern);
      assert.equal(match, null, `${name}: classe legada ${token}: ${match?.[0]}`);
    }
    assert.doesNotMatch(audited, /\bis-(?:active|disabled|error|ok|selected|dragging|drop-)/, `${name}: classe de estado legada`);
    assert.doesNotMatch(audited, /(?:^|\s)spin(?:\s|$)/, `${name}: spin legado`);
  }
});

test('os 3 arquivos do editor usam utilities TW literais, sem remendos', () => {
  for (const [name, source] of Object.entries(files)) {
    for (const forbidden of [
      /\[[a-z-]+:\s*[^]\s]+\]/,
      /#[0-9a-fA-F]{3,8}\b/,
      /color-mix\(/,
      /!important/,
      /@apply/,
      /@tailwind\s+base/,
      /hsl\(/,
    ]) {
      const match = classes[name].match(forbidden);
      assert.equal(match, null, `${name}: remendo visual ${match?.[0]}`);
    }
    assert.doesNotMatch(source, /style=\{\{/, `${name}: style inline proibido`);
    assert.doesNotMatch(source, /@apply|@tailwind\s+base|!important|color-mix\(/, `${name}: CSS proibido`);
    assert.doesNotMatch(classes[name], /\b(?:bg|text|border)-green-/, `${name}: verde comum deve virar azul`);
    assert.doesNotMatch(source, /blue-dark|#0B1020|#DDE6FF/i, `${name}: blue-dark proibido`);
  }
});

test('utilidades básicas permanecem literais em cada arquivo', () => {
  for (const utility of [
    'flex h-dvh min-h-0 flex-col bg-surface-page font-ui text-ink',
    'flex h-14 flex-none items-center justify-between gap-2.5 border-b border-line bg-surface px-4',
    'inline-flex h-control items-center gap-2 rounded-token-sm border-0 bg-brand px-4 text-sm font-bold text-brand-contrast',
    'flex min-h-0 flex-1 overflow-hidden',
    'flex w-80 flex-none flex-col overflow-hidden border-r border-line bg-surface',
    'relative min-w-0 flex-1 overflow-hidden bg-surface-2',
    'flex w-85 flex-none flex-col overflow-hidden border-l border-line bg-surface',
    'max-w-55 rounded-token-sm border border-line bg-surface px-2 py-1 text-body text-ink',
    'bg-blue-50 text-blue-600',
  ]) assert.ok(classes.shell.includes(utility), `shell perdeu ${utility}`);

  for (const utility of [
    'flex min-h-0 flex-1 flex-col overflow-y-auto border-t border-line',
    'inline-flex h-7.5 w-7.5 flex-none items-center justify-center rounded-token-sm border border-line bg-surface-2 text-ink-secondary',
    'w-full rounded-token-sm border border-line bg-surface px-3.5 py-2 text-sm text-ink placeholder:text-ink-muted',
    'peer hidden',
    'relative h-5 w-10 rounded-full border border-line bg-line transition-control duration-control peer-checked:border-brand peer-checked:bg-brand',
    'flex flex-col items-center gap-2.5 p-10 text-center text-sm text-ink-secondary',
    'w-full min-h-18 resize-y rounded-token-sm border border-line bg-surface px-3.5 py-2 text-sm text-ink',
  ]) assert.ok(classes.inspector.includes(utility), `inspector perdeu ${utility}`);

  for (const utility of [
    'fixed inset-0 z-10000 flex flex-col bg-surface-page text-ink',
    'fixed bottom-6 left-1/2 z-10001 flex -translate-x-1/2 items-center gap-2 rounded-token border border-line bg-surface p-1.5 shadow-token-lg',
    'inline-flex min-h-control items-center justify-center gap-2 rounded-token-sm border border-line bg-surface-2 px-4 text-body font-bold text-ink',
    'flex flex-wrap items-center gap-2 border-b border-line bg-surface py-2.5 group-open/settings:border-b-0',
    'min-w-56 rounded-token-sm border border-line bg-surface-page px-2.5 py-2 text-body text-ink placeholder:text-ink-muted focus:border-brand focus:outline-none',
    'max-h-42',
  ]) assert.ok(classes.window.includes(utility), `window perdeu ${utility}`);
});

test('variantes e estados resolvem mapas/helpers de literais completas', () => {
  assert.match(files.shell, /const SHELL_NOTICE_KIND: Record<'info' \| 'ok' \| 'bad', string> = \{/);
  assert.match(files.shell, /className=\{`\$\{SHELL_NOTICE\} \$\{SHELL_NOTICE_KIND\[noticeKind\]\}`\}/);
  assert.match(files.shell, /d === device \? SHELL_DEVICE_BUTTON_ACTIVE : ''/);
  assert.match(files.inspector, /const INSPECTOR_FEEDBACK_KIND: Record<'ok' \| 'error', string> = \{/);
  assert.match(files.inspector, /INSPECTOR_FEEDBACK_KIND\[aiFeedback\.error \? 'error' : 'ok'\]/);
  assert.match(files.window, /aiMessage\.error \? aiStatusErrorClass : aiStatusOkClass/);
});

test('o shell preserva testids, ARIA, callbacks e a estrutura paleta/árvore/canvas/inspetor', () => {
  const source = files.shell;
  for (const token of [
    'role="application"',
    'aria-label="Editor de sites Véxora"',
    'htmlFor="vx-editor-page"',
    'id="vx-editor-page"',
    'aria-label="Fechar editor"',
    'aria-label="Minimizar editor"',
    'role="group"',
    'aria-label="Dispositivo de preview"',
    'aria-label={`Preview ${d}`}',
    'role="status"',
    'aria-live="polite"',
    'dirty ? \' • não salvo\'',
    '<Palette',
    '<LayerTree',
    '<Canvas',
    '<Inspector',
    'nodes={activeRoot ? [activeRoot] : []}',
    'rootId={activeRoot?.id ?? null}',
    'selectedIds={selectedIds}',
    'draggingNodeId={dragPayload?.kind === \'node\' ? dragPayload.nodeId : null}',
    'dragOverId={dragTarget.targetId}',
    'dropTarget={dragTarget.position}',
    'onDrop={applyDrop}',
    'onDragOver={(targetId, position) => setDragTarget({ targetId, position })}',
    'onToggleVisibility={(nodeId, visible) => handleNodeProp(nodeId, \'visible\', visible)}',
    'onLock={(nodeId, locked) => handleNodeProp(nodeId, \'locked\', locked)}',
    'onPropChange={handlePropChange}',
    'onStyleChange={handleStyleChange}',
    'onAIChange={handleAIChange}',
    'aiFeedback={aiFeedback}',
    'onSave',
    'onPublish',
    'onClose',
    'onMinimize',
    'readOnly',
    'loading',
    'saving',
    'publishing',
    'interactionDisabled',
    'Salvando…',
    'Publicando…',
    'Início (index)',
    'rascunho legal',
  ]) assert.ok(source.includes(token), `shell perdeu ${token}`);
  assert.deepEqual(
    [...source.matchAll(/data-testid=["']([^"']+)["']/g)].map((match) => match[1]),
    [],
    'shell não deve ganhar/perder testids',
  );
});

test('o inspetor preserva testid, id, ARIA, callbacks e estados', () => {
  const source = files.inspector;
  for (const token of [
    'aria-label="Propriedades do bloco"',
    'id="vexora-ai-prompt"',
    'data-testid="vx-inspector-ai-feedback"',
    'role={aiFeedback.error ? \'alert\' : \'status\'}',
    'aria-live="polite"',
    'aria-label={aiPanelOpen ? \'Fechar assistente de IA\' : \'Abrir assistente de IA\'}',
    'aria-hidden="true"',
    'role="status"',
    'setAiPanelOpen(true)',
    'Somente leitura',
    'controlsDisabled',
    'readOnly',
    'aiBusy',
    'onPropChange(',
    'onStyleChange',
    'onAIChange(',
    'handleAiKeyDown',
    'selectedNode.id',
    '<StyleInspector',
    'Este bloco não tem propriedades editáveis.',
  ]) assert.ok(source.includes(token), `inspector perdeu ${token}`);
  assert.deepEqual(
    [...source.matchAll(/data-testid=["']([^"']+)["']/g)].map((match) => match[1]),
    ['vx-inspector-ai-feedback'],
    'inspector perdeu o testid do feedback da IA',
  );
});

test('a janela preserva portal, ids funcionais, ARIA, roles e fluxos', () => {
  const source = files.window;
  for (const token of [
    'createPortal(',
    'document.body,',
    'role="region"',
    'aria-label="Editor minimizado"',
    'aria-label={`Editor do site ${title}`}',
    'aria-label="Domínio do site"',
    'htmlFor={`domain-${siteId}`}',
    'id={`domain-${siteId}`}',
    'role={aiMessage.error ? "alert" : "status"}',
    'role="alert"',
    'role="status"',
    '<details className={detailsClass}>',
    '<summary className={detailsSummaryClass}>Domínio, publicação e respostas</summary>',
    'onToggle={(event) => {',
    'loadSubmissions()',
    'navigator.clipboard.writeText(previewLink.url)',
    'Ver prévia temporária',
    'Voltar para Sites',
    'Vincular',
    'Verificar',
    '<EditorShell',
    'readOnly={!canEdit}',
    'saving={saving}',
    'publishing={publishing}',
    'aiFeedback={aiMessage}',
    'onSave={save}',
    'onPublish={() => void publish()}',
    'onMinimize={() => setMinimized(true)}',
    'onClose={requestClose}',
    'device={device}',
    'onDeviceChange={setDevice}',
  ]) assert.ok(source.includes(token), `window perdeu ${token}`);
});
