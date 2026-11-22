import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Guard node:test puro: nenhuma dependência de node_modules/jsdom.
const root = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

const targetFiles = [
  'src/app/sites/editor/canvas.tsx',
  'src/app/sites/editor/editor-shell.tsx',
  'src/app/sites/editor/inspector.tsx',
  'src/app/sites/site-editor-window.tsx',
  'src/app/sites/wizard/wizard-shell.tsx',
  'src/app/sites-domain-config.tsx',
];

const sources = Object.fromEntries(
  targetFiles.map((file) => [path.basename(file, '.tsx'), read(file)]),
);
const contracts = read('src/app/sites/editor/contracts.ts');
const legacyTheme = read('src/app/vexora.css');

const contractValue = (name) =>
  contracts.match(new RegExp(`${name} = '([^']+)'`))?.[1];

const UTILITY_HINT =
  /(?:^|\s)(?:flex|grid|inline-flex|inline-block|fixed|absolute|relative|block|hidden|peer|truncate|overflow|bg-|text-|border|rounded|p-|px-|py-|m-|mx-|my-|w-|h-|min-|max-|gap-|items-|justify|shadow|font-|cursor|opacity|disabled:|hover:|focus:|group|z-|animate-|transition|leading-|resize|placeholder:|basis-|list-)/;

/** Reúne só o que chega ao DOM como classe: className e constantes usadas como classes. */
function classValues(source) {
  const values = [];
  for (const match of source.matchAll(
    /className\s*=\s*(?:"([^"]*)"|'([^']*)'|`([^`]*)`|\{([\s\S]*?)\})/g,
  )) {
    if (match[1] !== undefined) values.push(match[1]);
    else if (match[2] !== undefined) values.push(match[2]);
    else if (match[3] !== undefined) values.push(match[3]);
    else for (const literal of match[4].matchAll(/(['"`])([^'"`]*)\1/g)) values.push(literal[2]);
  }
  for (const literal of source.matchAll(/(['"])([^'"\n]{5,})\1/g)) {
    if (UTILITY_HINT.test(literal[2])) values.push(literal[2]);
  }
  return [...new Set(values)].join('\n');
}

const classes = Object.fromEntries(
  Object.entries(sources).map(([name, source]) => [name, classValues(source)]),
);

test('os seis editores não contêm nenhum token/componente legado de classe', () => {
  const legacy = [
    'ov-', 'vx-', 'ib-', 'rw-', 'auth-', 'alarm-', 'platform-admin-',
    'vx-rich-', 'vx-post-', 'vx-gallery-', 'design-approval-',
    'content-card', 'settings-card', 'primary-button', 'secondary-button',
    'text-button', 'icon-button', 'vx-spin',
  ];
  for (const [name, source] of Object.entries(sources)) {
    for (const token of legacy) {
      const pattern = new RegExp(token.endsWith('-') ? `\\b${token}` : `\\b${token}\\b`, 'i');
      assert.equal(source.match(pattern), null, `${name}: token legado ${token} no TSX`);
      assert.equal(classes[name].match(pattern), null, `${name}: token legado ${token} em className`);
    }
    assert.doesNotMatch(source, /\b(?:ov|ib|rw)-[a-z][\w-]*:/i, `${name}: variante legada`);
    assert.doesNotMatch(classes[name], /\bis-(?:active|disabled|error|ok|selected|dragging|drop-)/, `${name}: classe de estado legada`);
    assert.doesNotMatch(classes[name], /(?:^|\s)spin(?:\s|$)/, `${name}: spin legado`);
  }
});

test('as classes são utilitários Tailwind literais, sem remendos ou fragmentos concatenados', () => {
  for (const [name, source] of Object.entries(sources)) {
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
      assert.equal(match, null, `${name}: remendo visual em classe ${match?.[0]}`);
    }
    assert.doesNotMatch(source, /color-mix\(|@apply|@tailwind\s+base|!important/, `${name}: CSS proibido`);
    assert.doesNotMatch(source, /className=\{[^}]*\+/, `${name}: className com concatenação de fragmento`);
    assert.match(classes[name], UTILITY_HINT, `${name}: nenhuma utility Tailwind detectada`);
  }
});

test('o tema escuro continua slate real, sem blue-dark', () => {
  for (const [name, source] of Object.entries(sources)) {
    assert.doesNotMatch(source, /blue-dark|#0B1020|#DDE6FF/i, `${name}: paleta blue-dark proibida`);
  }
  for (const token of [
    '--bg:#0F172A', '--s1:#1E293B', '--s2:#334155',
    '--tx:#F8FAFC', '--ln:#334155', '--sb-bg:#020617',
  ]) {
    assert.ok(legacyTheme.includes(token), `o tema slate deve manter ${token}`);
  }
});

test('os contratos funcionais, ARIA e fluxos permanecem com os mesmos valores', () => {
  assert.equal(contractValue('EDITOR_PAGE_ID'), 'vx-editor-page');
  assert.equal(contractValue('INSPECTOR_AI_FEEDBACK_TEST_ID'), 'vx-inspector-ai-feedback');
  assert.equal(contractValue('LAYOUT_IMAGE_INPUT_ID'), 'vx-wizard-layout-image');

  const shell = sources['editor-shell'];
  assert.match(shell, /import \{ EDITOR_PAGE_ID \} from ['"]\.\/contracts['"]/);
  assert.ok(shell.includes('htmlFor={EDITOR_PAGE_ID}'));
  assert.ok(shell.includes('id={EDITOR_PAGE_ID}'));
  assert.ok(shell.includes('role="application"'));
  assert.ok(shell.includes('aria-label="Editor de sites Véxora"'));
  assert.ok(shell.includes('aria-live="polite"'));

  const inspector = sources.inspector;
  assert.match(inspector, /import \{ INSPECTOR_AI_FEEDBACK_TEST_ID \} from ['"]\.\/contracts['"]/);
  assert.ok(inspector.includes('data-testid={INSPECTOR_AI_FEEDBACK_TEST_ID}'));
  assert.ok(inspector.includes('aria-label="Propriedades do bloco"'));
  assert.ok(inspector.includes('id="vexora-ai-prompt"'));
  assert.ok(inspector.includes("role={aiFeedback.error ? 'alert' : 'status'}"));

  const wizard = sources['wizard-shell'];
  assert.match(wizard, /import \{ LAYOUT_IMAGE_INPUT_ID \} from ['"]\.\.\/editor\/contracts['"]/);
  assert.ok(wizard.includes('id={LAYOUT_IMAGE_INPUT_ID}'));
  assert.ok(wizard.includes('htmlFor={LAYOUT_IMAGE_INPUT_ID}'));
  assert.ok(wizard.includes('role="dialog"'));
  assert.ok(wizard.includes('aria-modal="true"'));

  const windowSource = sources['site-editor-window'];
  assert.ok(windowSource.includes('createPortal('));
  assert.ok(windowSource.includes('aria-label="Editor minimizado"'));
  assert.ok(windowSource.includes('aria-label="Domínio do site"'));

  const canvas = sources.canvas;
  assert.ok(canvas.includes('srcDoc={frameHtml}'));
  assert.ok(canvas.includes('aria-label="Preview do site"'));
  assert.ok(canvas.includes('sandbox="allow-same-origin allow-scripts"'));
  assert.ok(canvas.includes("data-drop-indicator"));
  assert.ok(!canvas.includes('data-vx-dnd-indicator'));
  assert.ok(canvas.includes('var(--primary-soft, rgba(14, 122, 92, 0.12))'));

  const testIds = targetFiles
    .flatMap((file) => [...read(file).matchAll(/data-testid=(?:"([^"]+)"|\{([A-Z_]+)\})/g)])
    .map((match) => match[1] ?? match[2]);
  assert.deepEqual(testIds, ['INSPECTOR_AI_FEEDBACK_TEST_ID']);
});

test('as quebras responsivas migradas usam apenas breakpoints padrão do Tailwind', () => {
  const wizard = sources['wizard-shell'];
  for (const literal of [
    'min-h-0 flex-1 overflow-y-auto overscroll-contain bg-zinc-50 px-4 pb-8 pt-7 sm:px-6 md:px-10 lg:px-12',
    'grid grid-cols-1 gap-3.5 md:grid-cols-2 lg:grid-cols-3',
    'grid grid-cols-2 gap-3.5 md:grid-cols-3 lg:grid-cols-5',
  ]) {
    assert.ok(wizard.includes(literal), `wizard perdeu a literal responsiva ${literal}`);
  }

  const domain = sources['sites-domain-config'];
  assert.ok(domain.includes('grid grid-cols-2 gap-2 p-0 list-none md:grid-cols-4'));
  assert.ok(domain.includes('grid grid-cols-1 gap-3 md:grid-cols-2'));
  assert.doesNotMatch(domain, /\bov-|ov-tablet:|\bvx-/);
});
