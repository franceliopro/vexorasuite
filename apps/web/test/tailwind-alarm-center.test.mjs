import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const source = fs.readFileSync(path.join(root, "src/app/alarm-center.tsx"), "utf8");

/** Literais completas resolvidas a partir de className e das constantes TW do arquivo. */
function classValues(text) {
  const constants = new Map();
  for (const match of text.matchAll(/\bconst\s+([A-Za-z_$][\w$]*)\s*=\s*"([^"]*)"/g)) {
    constants.set(match[1], match[2]);
  }
  const values = [];
  for (const match of text.matchAll(/className\s*=\s*(?:"([^"]*)"|\{([\s\S]*?)\})/g)) {
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

const classes = classValues(source);
const tokens = classes.split(/\s+/).filter(Boolean);

const variantExceptions = new Set(["ib-narrow", "ov-laptop", "rw-laptop"]);
const legacyPrefixes = [
  "ov", "vx", "ib", "rw", "auth", "alarm", "platform-admin",
  "vx-rich", "vx-post", "vx-gallery", "design-approval",
];
const legacyExact = new Set([
  "content-card", "settings-card", "primary-button", "secondary-button",
  "text-button", "icon-button", "vx-spin",
]);

test("a central de alarmes não usa nenhum token de classe legado", () => {
  for (const token of tokens) {
    const [base, ...variants] = token.split(":");
    for (const variant of variants) {
      assert.ok(
        variantExceptions.has(variant) || !legacyPrefixes.some((prefix) => variant.startsWith(`${prefix}-`)),
        `variante legada em className: ${token}`,
      );
    }
    assert.ok(
      !legacyPrefixes.some((prefix) => base.startsWith(`${prefix}-`)),
      `classe componente legada: ${token}`,
    );
    assert.ok(!legacyExact.has(base), `classe componente legada: ${token}`);
  }
  assert.doesNotMatch(source, /animate-vx-in|\bbg-overlay\b|\bvx-in\b/);
  for (const testid of ["auth-submit", "alarm-snooze", "alarm-stop"]) {
    assert.ok(!tokens.includes(testid), `testid vazou para className: ${testid}`);
  }
});

test("as classes da central de alarmes são literais completas, sem remendos", () => {
  assert.doesNotMatch(source, /className=\{`/);
  assert.doesNotMatch(source, /className=\{[^\n]*\+/);
  assert.equal([...source.matchAll(/\bconst\s+\w+Tw\s*=\s*"[^"]+";/g)].length, 2);

  for (const forbidden of [
    /@apply\b/, /@tailwind\s+base\b/, /color-mix\(/, /!important/,
  ]) {
    const match = source.match(forbidden);
    assert.equal(match, null, `remendo visual: ${match?.[0]}`);
  }
  for (const token of tokens) {
    assert.ok(!/[[\]]/.test(token), `valor arbitrário em classe: ${token}`);
    assert.ok(!/#[0-9a-fA-F]{3,8}\b/.test(token), `hex em classe: ${token}`);
  }
});

test("o overlay e os botões usam slate real, sem blue-dark", () => {
  for (const utility of [
    "fixed inset-0 grid place-items-center bg-slate-900/90 p-5 backdrop-blur-md",
    "border-slate-700", "bg-slate-800", "bg-slate-700", "text-slate-50", "text-slate-200",
    "bg-linear-to-br from-slate-800 to-slate-900", "bg-slate-700/60", "text-slate-300",
  ]) {
    assert.ok(classes.includes(utility), `falta a utility slate: ${utility}`);
  }
  assert.doesNotMatch(
    classes,
    /\b(?:bg|text|border|from|via|to|ring|shadow)-(?:blue|sky|cyan|indigo|violet|purple)-\d/,
  );
  assert.match(source, /radial-gradient\(90rem 60rem at 50% -20%, hsl\(215 28% 26% \/ 0\.45\), transparent 60%\),hsl\(222 47% 11% \/ 0\.9\)/);
  assert.doesNotMatch(source, /rgba\(|29,78,216|#[0-9a-fA-F]{6}\b/);
});

test("os contratos funcionais da central de alarmes permanecem intactos", () => {
  for (const expected of [
    'role="alertdialog"', 'aria-modal="true"',
    'aria-label={ringing.length === 1 ? "Alarme tocando" : "Alarmes tocando"}',
    'zIndex: "var(--z-reminder, 9500)"',
    'data-testid="alarm-snooze"', 'data-testid="alarm-stop"',
    "onClick={() => snooze(alarm)}", "onClick={() => dismiss(alarm)}",
    "Adiar 5 min", "Parar", 'aria-hidden="true"', "key={alarm.id}",
    "if (!ringing.length) return null;",
    'fetch("/api/backend/reminders/alarms", { cache: "no-store" })',
    'method: "PUT"', "FIRED_KEY", "SNOOZED_KEY", "speechSynthesis", "AudioContext",
  ]) {
    assert.ok(source.includes(expected), `o alarme perdeu ${expected}`);
  }
});
