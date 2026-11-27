import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const admin = readFileSync(
  new URL("../src/app/platform-admin-workspace.tsx", import.meta.url),
  "utf8",
);
const alarms = readFileSync(
  new URL("../src/app/alarm-center.tsx", import.meta.url),
  "utf8",
);

/** className direto, literais em expressões e constantes TW resolvidas. */
function classValues(source) {
  const constants = new Map();
  for (const match of source.matchAll(/\bconst\s+([A-Za-z_$][\w$]*)\s*=\s*"([^"]*)"/g)) {
    constants.set(match[1], match[2]);
  }
  const values = [];
  for (const match of source.matchAll(/className\s*=\s*(?:"([^"]*)"|\{([\s\S]*?)\})/g)) {
    if (match[1] !== undefined) {
      values.push(match[1]);
      continue;
    }
    for (const literal of match[2].matchAll(/(["'])([^"']*)\1/g)) values.push(literal[2]);
    for (const id of match[2].matchAll(/\b([A-Za-z_$][\w$]*)\b/g)) {
      if (constants.has(id[1])) values.push(constants.get(id[1]));
    }
  }
  return values.join("\n");
}

const adminClasses = classValues(admin);
const alarmClasses = classValues(alarms);
const sources = [
  ["platform-admin-workspace.tsx", admin, adminClasses],
  ["alarm-center.tsx", alarms, alarmClasses],
];

test("os dois arquivos não usam mais classes componente de diálogo/overlay", () => {
  // Overlays e diálogos usam utilities padrão (slate real), sem tokens de componente.
  const legacyDialog = /(?:^|[\s"'`])vx-dialog(?:-backdrop|-body|-close|-footer|-heading|-icon|-wide)?(?=[\s"'`]|$)/;
  for (const [name, source, classes] of sources) {
    assert.doesNotMatch(source, legacyDialog, `${name}: vx-dialog residual`);
    assert.doesNotMatch(classes, legacyDialog, `${name}: vx-dialog residual em className`);
    assert.doesNotMatch(source, /\balarm-overlay\b/, `${name}: alarm-overlay residual`);
    assert.doesNotMatch(classes, /\balarm-overlay\b/, `${name}: alarm-overlay residual em className`);
  }
});

test("as classes migradas são strings literárias completas do preset", () => {
  for (const [name, , classes] of sources) {
    for (const forbidden of [
      /\[[a-z-]+:\s*[^]\s]+\]/,
      /#[0-9a-fA-F]{3,8}\b/,
      /color-mix\(/,
      /!important/,
      /@apply/,
      /@tailwind\s+base/,
    ]) {
      const match = classes.match(forbidden);
      assert.equal(match, null, `${name}: remendo visual em className: ${match?.[0]}`);
    }
  }

  for (const utility of [
    "fixed inset-0 z-50 grid place-items-center bg-slate-900/80 p-4 backdrop-blur-sm",
    "relative z-10 flex max-h-dvh w-full max-w-lg flex-col overflow-hidden rounded-token-lg border border-line bg-surface p-pad text-ink shadow-token-lg dark:border-slate-700 dark:bg-slate-900 dark:text-slate-50",
    "mb-3.5 flex min-w-0 flex-none items-center gap-3 pr-10",
    "grid size-10 flex-none place-items-center rounded-xl border border-blue-600/20 bg-blue-50 text-blue-800",
    "absolute right-3 top-3 z-10 grid size-ctl-sm place-items-center rounded-xl border border-line bg-surface-2 text-ink-secondary transition-colors hover:bg-hover hover:text-ink",
    "mt-0 flex flex-none justify-end gap-2 border-t border-line pt-3",
    "relative z-10 grid max-h-dvh w-full max-w-4xl grid-rows-docs-editor overflow-hidden rounded-token-lg border border-line bg-surface p-pad text-ink shadow-token-lg dark:border-slate-700 dark:bg-slate-900 dark:text-slate-50",
    "min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-4",
  ]) {
    assert.ok(adminClasses.includes(utility), `falta a utility do diálogo: ${utility}`);
  }

  assert.ok(
    alarmClasses.includes("fixed inset-0 grid place-items-center bg-slate-900/90 p-5 backdrop-blur-md"),
    "o overlay do alarme perdeu grid/backdrop slate",
  );
  assert.doesNotMatch(alarmClasses, /\banimate-vx-in\b|\bbg-(?:blue|sky)-\d|\btext-(?:blue|sky)-\d/);
});

test("as camadas dos overlays permanecem acima do shell e abaixo das janelas fullscreen", () => {
  assert.equal((admin.match(/\bz-50\b/g) ?? []).length, 1);
  assert.equal((admin.match(/\bz-10\b/g) ?? []).length >= 2, true);
  assert.ok(admin.includes("zIndex: 2100"), "o editor de plano perdeu a camada 2100");
  assert.ok(alarms.includes('zIndex: "var(--z-reminder, 9500)"'), "o alarme perdeu a camada --z-reminder");
});

test("os contratos de diálogo, backdrop, testids e estados foram preservados", () => {
  for (const expected of [
    'role="presentation"',
    "onMouseDown={e => { if (e.target === e.currentTarget) setConfirmArchive(null); }}",
    "onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}",
    'role="dialog"',
    'aria-modal="true"',
    'aria-label="Arquivar plano"',
    'aria-label="Fechar"',
    'role="group"',
    'aria-label="Módulos liberados"',
    'role="tablist"',
    'role="tab"',
    'role="alert"',
    "confirmArchive",
    "editorOpen",
    "saving",
    'disabled={saving || !draft.name.trim() || !draft.code.trim()}',
    "minWidth: 980",
  ]) {
    assert.ok(admin.includes(expected), `o admin perdeu ${expected}`);
  }
  assert.equal((admin.match(/role="presentation"/g) ?? []).length, 2);
  assert.equal((admin.match(/aria-label="Fechar"/g) ?? []).length, 2);

  for (const expected of [
    'role="alertdialog"',
    'aria-modal="true"',
    'aria-label={ringing.length === 1 ? "Alarme tocando" : "Alarmes tocando"}',
    "alarm-snooze",
    "alarm-stop",
    'onClick={() => snooze(alarm)}',
    'onClick={() => dismiss(alarm)}',
    "Adiar 5 min",
    "Parar",
    "key={alarm.id}",
    "if (!ringing.length) return null;",
  ]) {
    assert.ok(alarms.includes(expected), `os alarmes perderam ${expected}`);
  }

  // Os hooks de submit e alarme migraram de classes componente para data-testid.
  assert.ok(alarms.includes('data-testid="alarm-snooze"'), "alarmes perderam o testid de adiar");
  assert.ok(alarms.includes('data-testid="alarm-stop"'), "alarmes perderam o testid de parar");
  for (const [name, source] of sources) {
    for (const token of ["auth-submit", "alarm-snooze", "alarm-stop"]) {
      assert.doesNotMatch(classValues(source), new RegExp(`\\b${token}\\b`), `${name}: classe legada ${token} voltou`);
    }
  }
});
