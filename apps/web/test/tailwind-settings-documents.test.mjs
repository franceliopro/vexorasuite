import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '../src/app');

const files = {
  channels: readFileSync(resolve(root, 'channels-integrations.tsx'), 'utf8'),
  customFields: readFileSync(resolve(root, 'custom-fields-settings.tsx'), 'utf8'),
  documents: readFileSync(resolve(root, 'documents-workspace.tsx'), 'utf8'),
  operations: readFileSync(resolve(root, 'operations-settings.tsx'), 'utf8'),
  providers: readFileSync(resolve(root, 'provider-connections.tsx'), 'utf8'),
  appointments: readFileSync(resolve(root, 'inbox-appointments.tsx'), 'utf8'),
};

const TOKENS_PROIBIDOS = [
  'ov-', 'vx-', 'ib-', 'rw-',
  'auth-', 'alarm-', 'platform-admin-',
  'vx-rich-', 'vx-post-', 'vx-gallery-', 'design-approval-',
  'content-card', 'settings-card',
  'primary-button', 'secondary-button', 'text-button', 'icon-button',
  'vx-spin',
];

const EXCECOES = ['ib-narrow:', 'ov-laptop:', 'rw-laptop:'];

function getClassNames(text) {
  const classes = [];
  const re = /className\s*=\s*["'`]([^"'`]*)["'`]/g;
  let m;
  while ((m = re.exec(text)) !== null) classes.push(m[1]);
  const reTpl = /className\s*=\s*\{`([^`]*)`\}/g;
  while ((m = reTpl.exec(text)) !== null) classes.push(m[1]);
  return classes.join(' ').replace(/\$\{[^}]*\}/g, ' ');
}

test('tokens legados proibidos ausentes em JSX das telas migradas', () => {
  for (const [nome, text] of Object.entries(files)) {
    const classNames = getClassNames(text);
    for (const token of TOKENS_PROIBIDOS) {
      const found = EXCECOES.some((exc) => token === 'ib-' && exc.startsWith('ib-') && classNames.includes(exc))
        || EXCECOES.some((exc) => token === 'ov-' && exc.startsWith('ov-') && classNames.includes(exc))
        || EXCECOES.some((exc) => token === 'rw-' && exc.startsWith('rw-') && classNames.includes(exc));
      const pattern = new RegExp(`(?:^|\\s)${token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`);
      assert.equal(
        pattern.test(classNames) && !found,
        false,
        `${nome}: token proibido "${token}" ainda presente em className`,
      );
    }
    // Remendos visuais e valores arbitrarios proibidos
    assert.equal(/-mt-\d/.test(classNames), false, `${nome}: remendo -mt-*`);
    assert.equal(/-top-\d/.test(classNames), false, `${nome}: remendo -top-*`);
    assert.equal(/\[[^\]]+\]/.test(classNames), false, `${nome}: valor arbitrario [...]`);
    assert.equal(/#[0-9a-fA-F]{3,8}/.test(classNames), false, `${nome}: hex direto em className`);
    assert.equal(/!important/.test(classNames), false, `${nome}: !important em className`);
  }
});

test('dark real slate em operations-settings', () => {
  const t = files.operations;
  assert.match(t, /border border-slate-700/);
  assert.match(t, /bg-slate-900/);
  assert.doesNotMatch(t, /bg-blue-(?:950|900|800)/);
});

test('channels-integrations usa text-xs legado convertido', () => {
  const t = files.channels;
  assert.match(t, /text-xs/);
  assert.doesNotMatch(t, /text-ib-time/);
  assert.doesNotMatch(t, /text-ib-caption/);
});

test('custom-fields-settings usa md: em vez de ov-tablet:', () => {
  const t = files.customFields;
  assert.match(t, /grid-cols-1/);
  assert.match(t, /md:grid-cols-cf-/);
  assert.doesNotMatch(t, /ov-tablet:/);
});

test('documents-workspace usa lg:/md: e preserva mt-3 nos fieldsets', () => {
  const t = files.documents;
  assert.match(t, /lg:grid-cols-docs-generate/);
  assert.match(t, /lg:grid-cols-docs-grid/);
  assert.match(t, /md:grid-cols-docs-variable/);
  assert.doesNotMatch(t, /ov-tablet:/);
  assert.doesNotMatch(t, /rw-wide:/);
  assert.match(t, /const variablesTw = "mt-3 /);
  assert.match(t, /<fieldset className=\{variablesTw\}>/);
});

test('operations-settings usa md: e dark slate', () => {
  const t = files.operations;
  assert.match(t, /md:grid-cols-2/);
  assert.doesNotMatch(t, /ov-tablet:/);
  assert.match(t, /bg-slate-900/);
  assert.match(t, /border-slate-700/);
});

test('provider-connections usa md: e preserva mt-3 no fieldset', () => {
  const t = files.providers;
  assert.match(t, /md:grid-cols-provider-status/);
  assert.doesNotMatch(t, /ov-tablet:/);
  const fieldsets = [...t.matchAll(/<fieldset[^>]*className=\{?["'`]([^"'`]*)["'`]\}?[^>]*>/g)];
  assert.ok(fieldsets.length >= 1, 'deve haver ao menos 1 fieldset');
  for (const f of fieldsets) {
    assert.match(f[1], /(?:^|\s)mt-3(?:\s|$)/, `fieldset sem mt-3: ${f[1]}`);
  }
});

test('inbox-appointments usa shadow-token-sm', () => {
  const t = files.appointments;
  assert.match(t, /shadow-token-sm/);
  assert.doesNotMatch(t, /shadow-vx-brand/);
});

test('contratos funcionais preservados em todas as telas', () => {
  const t = Object.values(files).join('\n');
  assert.match(t, /data-testid=/);
  assert.match(t, /aria-label=/);
  const ids = [
    ...[...t.matchAll(/\bid="([^"]+)"/g)].map((m) => m[1]),
    ...[...t.matchAll(/\bid=\{'([^']+)'\}/g)].map((m) => m[1]),
  ];
  const controls = [...t.matchAll(/aria-controls="([^"]+)"/g)].map((m) => m[1]);
  for (const c of controls) {
    assert.ok(ids.includes(c), `aria-controls="${c}" sem id correspondente`);
  }
  const labelled = [...t.matchAll(/aria-labelledby="([^"]+)"/g)].map((m) => m[1]);
  for (const l of labelled) {
    assert.ok(ids.includes(l), `aria-labelledby="${l}" sem id correspondente`);
  }
  for (const getEl of [...t.matchAll(/getElementById\("([^"]+)"\)/g)].map((m) => m[1])) {
    assert.ok(ids.includes(getEl), `getElementById("${getEl}") sem id correspondente`);
  }
  for (const htmlFor of [...t.matchAll(/htmlFor="([^"]+)"/g)].map((m) => m[1])) {
    assert.ok(ids.includes(htmlFor), `htmlFor="${htmlFor}" sem id correspondente`);
  }
});
