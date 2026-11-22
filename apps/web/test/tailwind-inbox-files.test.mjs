import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..', 'src', 'app');
const files = [
  'inbox-workspace.tsx',
  'inbox-support.tsx',
  'inbox-track.tsx',
  'conversation-list.tsx',
];
const sources = new Map(files.map((file) => [file, fs.readFileSync(path.join(root, file), 'utf8')]));
const all = [...sources.values()].join('\n');

const bannedPrefixes = [
  'ov-', 'vx-', 'ib-', 'rw-', 'auth-', 'alarm-', 'platform-admin-',
  'vx-rich-', 'vx-post-', 'vx-gallery-', 'design-approval-',
];
const bannedExact = new Set([
  'content-card', 'settings-card', 'primary-button',
  'secondary-button', 'text-button', 'icon-button', 'vx-spin',
]);
const allowedVariants = new Set(['ib-narrow:', 'ov-laptop:', 'rw-laptop:']);

function tokensFromClassValue(value) {
  return value.split(/\s+/).filter(Boolean);
}

function allClassTokens(source) {
  const values = [
    ...[...source.matchAll(/className="([^"{}]*)"/g)].map((m) => m[1]),
    ...[...source.matchAll(/:\s*"([^"]*\b(?:bg|border|text|ring|from|via|to|fill|shadow|divide|outline)-[a-z][^"]*)"/g)].map((m) => m[1]),
  ];
  return values.flatMap(tokensFromClassValue);
}

function bannedSegments(token) {
  const segments = token.split(':');
  const bad = [];
  for (const segment of segments) {
    if (bannedExact.has(segment)) {
      bad.push(token);
      continue;
    }
    const prefix = bannedPrefixes.find((p) => segment.startsWith(p));
    if (!prefix) continue;
    const variant = segment + ':';
    if (allowedVariants.has(variant)) continue;
    bad.push(token);
  }
  return bad;
}

test('arquivos de inbox usam apenas classes Tailwind padrão', () => {
  for (const [file, source] of sources) {
    const bad = allClassTokens(source).flatMap(bannedSegments);
    assert.deepEqual([...new Set(bad)], [], `${file} contém classes legadas proibidas`);

    assert.doesNotMatch(source, /class(Name)?="[^"]*\[[^\]"\s]+\]/, `${file} não deve usar valores arbitrários`);
    assert.doesNotMatch(source, /class(Name)?="[^"]*#[0-9a-fA-F]{3,8}\b/, `${file} não deve usar hex em classes`);
    assert.doesNotMatch(source, /!important/, `${file} não deve usar !important`);
    assert.doesNotMatch(source, /@apply\b/, `${file} não deve usar @apply`);
    assert.doesNotMatch(source, /@tailwind\s+base/, `${file} não deve usar @tailwind base`);
    assert.doesNotMatch(source, /color-mix\s*\(/, `${file} não deve usar color-mix`);
    assert.doesNotMatch(source, /hsl\s*\(/, `${file} não deve usar hsl`);
  }
});

test('variantes herdadas permitidas continuam completas e literais', () => {
  for (const variant of ['ib-narrow:', 'ov-laptop:', 'rw-laptop:']) {
    if (!all.includes(variant)) continue;
    const escaped = variant.replace(/:/g, '\\:');
    const pattern = new RegExp(`${escaped}[a-z][a-z0-9:/.-]*`, 'g');
    const matches = [...all.matchAll(pattern)].map((m) => m[0]);
    assert.ok(matches.length > 0, `variante ${variant} deve resolver para classes completas`);
  }

  for (const name of ['presenceToneTw', 'tickToneTw', 'statusTw', 'handoffToneTw', 'agentToneTw']) {
    assert.match(all, new RegExp(`\\b${name}\\s*[:=]`), `${name} deve permanecer como mapa literal`);
  }
  assert.doesNotMatch(all, /:\s*\{\s*[^}]*hsl\s*\(/, 'mapas de cor não devem gerar hsl');
});

test('contratos funcionais e de teste permanecem preservados', () => {
  const required = [
    'data-testid="inbox-workspace"',
    'data-testid="ib-support-context"',
    'data-testid="inbox-composer-input"',
    'data-testid="conversation-list"',
    'aria-label="',
    'role="',
    'onSelect',
    'onSend',
    'onKeyDown',
    'setDraft',
    'selectedId',
    'conversationsLoading',
    'messagesLoading',
  ];
  for (const token of required) {
    assert.ok(all.includes(token), `contrato ausente: ${token}`);
  }
});
