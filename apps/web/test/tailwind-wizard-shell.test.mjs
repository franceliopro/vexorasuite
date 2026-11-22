import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

const wizard = read("src/app/sites/wizard/wizard-shell.tsx");
const contracts = read("src/app/sites/editor/contracts.ts");
const config = read("tailwind.config.ts");
const theme = read("src/app/theme.css");
const legacyCss = read("src/app/vexora.css");

/** O id funcional vive no módulo de contratos, fora do TSX auditado. */
const layoutImageInputId = contracts.match(/LAYOUT_IMAGE_INPUT_ID = '([^']+)'/)?.[1];

function classValues(source) {
  const values = [];
  for (const match of source.matchAll(/className\s*=\s*(?:"([^"]*)"|\{([^}]*)\})/g)) {
    if (match[1] !== undefined) {
      values.push(match[1]);
      continue;
    }
    for (const literal of match[2].matchAll(/(["'])([^"']*)\1/g)) values.push(literal[2]);
  }
  return values.join("\n");
}
const classes = classValues(wizard);

test("o wizard não usa mais classes componente decorativas", () => {
  assert.doesNotMatch(classes, /\bvx-wizard[\w-]*/);
  for (const legada of [
    "primary-button", "secondary-button", "icon-button",
    "is-active", "is-done", "is-current", "is-disabled",
  ]) {
    assert.doesNotMatch(classes, new RegExp(`\\b${legada}\\b`));
  }
});

test("o wizard usa utilities literais do preset, sem remendos", () => {
  const semHexDeDados = wizard.replace("context.fillStyle = '#ffffff';", "");
  for (const forbidden of [
    /\[[a-z-]+:\s*[^]\s]+\]/,
    /!important/,
    /@apply/,
    /@tailwind\s+base/,
    /color-mix\(/,
  ]) {
    const match = classes.match(forbidden) ?? semHexDeDados.match(forbidden);
    assert.equal(match, null, `remendo visual encontrado: ${match?.[0]}`);
  }
  assert.doesNotMatch(semHexDeDados, /#[0-9a-fA-F]{3,8}\b/);

  for (const utility of [
    "fixed inset-0 flex min-h-0 flex-col bg-zinc-50 font-ui text-slate-950",
    "fixed left-1/2 top-1/2 flex min-h-0 -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-lg border border-gray-200 bg-zinc-50 font-ui text-slate-950 shadow-lg",
    "fixed bottom-6 left-1/2 flex -translate-x-1/2 gap-2",
    "flex shrink-0 gap-1.5 overflow-x-auto border-b border-gray-200 bg-zinc-100 px-4 py-3",
    "min-h-0 flex-1 overflow-y-auto overscroll-contain bg-zinc-50 px-4 pb-8 pt-7 sm:px-6 md:px-10 lg:px-12",
    "grid grid-cols-1 gap-3.5 sm:grid-cols-2 md:grid-cols-3",
    "grid grid-cols-2 gap-3.5 sm:grid-cols-3 md:grid-cols-5",
    "bg-blue-600 px-5 py-2 text-sm font-bold text-blue-950",
    "bg-blue-50 px-2.5 py-1 text-sm font-semibold text-blue-700",
    "border border-blue-700 bg-blue-50 p-4",
    "text-sm text-red-600",
    "animate-spin",
  ]) {
    assert.ok(wizard.includes(utility), `falta a utility ${utility}`);
  }
});

test("os estados resolvem mapas Record com strings completas", () => {
  for (const trecho of [
    "const STEP_STATE_TW: Record<StepState, string> = {",
    "const STEP_BADGE_STATE_TW: Record<StepState, string> = {",
    "const CONNECTOR_STATE_TW: Record<'done' | 'pending', string> = {",
    "const OPTION_STATE_TW: Record<OptionState, string> = {",
    "const OPTION_ICON_STATE_TW: Record<OptionState, string> = {",
    "const THEME_STATE_TW: Record<OptionState, string> = {",
    "function stepStateTw(",
    "function badgeStateTw(",
    "function connectorStateTw(",
    "function optionStateTw(",
    "function optionIconStateTw(",
    "function themeStateTw(",
    "function primaryButtonTw(",
    "className={stepStateTw(isDone, isCurrent)}",
    "className={badgeStateTw(isDone, isCurrent)}",
    "className={connectorStateTw(isDone)}",
    "className={optionStateTw(active, disabled)}",
    "className={optionIconStateTw(active, disabled)}",
    "className={themeStateTw(active, disabled)}",
    "className={primaryButtonTw(disabled || busy)}",
    "className={primaryButtonTw(disabled || busy || !canNext)}",
    "className={primaryButtonTw(disabled || !domain.trim())}",
  ]) {
    assert.ok(wizard.includes(trecho), `perdeu o mapa/helper ${trecho}`);
  }
});

test("os contratos de acessibilidade e interação permanecem intactos", () => {
  for (const hook of [
    'role="region"',
    'aria-label="Assistente de criação de site minimizado"',
    'role="dialog"',
    'aria-modal="true"',
    'aria-label="Assistente de criação de site"',
    'aria-label="Etapas do assistente"',
    'aria-label="Minimizar assistente"',
    "aria-label={isFullscreen ? 'Restaurar janela' : 'Tela cheia'}",
    'aria-label="Fechar assistente"',
    "aria-current={isCurrent ? 'step' : undefined}",
    "aria-pressed={active}",
    "aria-required={value === 'image'}",
    'aria-label="Remover imagem de layout"',
    'aria-label="Nome do site"',
    'aria-label="URL do logotipo"',
    'role="alert"',
    'id={LAYOUT_IMAGE_INPUT_ID}',
    'htmlFor={LAYOUT_IMAGE_INPUT_ID}',
    "disabled={!isDone && !isCurrent}",
    "disabled={disabled || busy}",
    "disabled={disabled || busy || !canNext}",
    "disabled={disabled || !domain.trim()}",
    "disabled={disabled || readingLayoutImage}",
    "onClick={onClose}",
    "onClick={handleMinimize}",
    "onClick={handleToggleFullscreen}",
    "onClick={handleBack}",
    "onClick={handleNext}",
    "onClick={() => void handleFinish()}",
    "onClick={() => (isDone ? setStep(s) : undefined)}",
    "onClick={() => !disabled && onChange(opt.id)}",
    "onClick={() => !disabled && onChange(t.id)}",
    "onDomainValidated={() => setDomainValidated(true)}",
    "createPortal(content, document.body)",
    "type WizardMode = 'fullscreen' | 'window' | 'minimized'",
    "useState<WizardMode>('fullscreen')",
    "handleToggleFullscreen",
  ]) {
    assert.ok(wizard.includes(hook), `perdeu o contrato ${hook}`);
  }
  assert.equal(layoutImageInputId, "vx-wizard-layout-image");
  assert.match(wizard, /import \{ LAYOUT_IMAGE_INPUT_ID \} from ['"]\.\.\/editor\/contracts['"]/);
});

test("as cores e os breakpoints vêm do preset e do tema slate real", () => {
  for (const trecho of [
    'blue: {',
    '600: "var(--primary)"',
    '950: "var(--primary-contrast)"',
    'zinc: {',
    '50: "var(--bg)"',
    '100: "var(--s1)"',
    'emerald: {',
    '600: "var(--ok)"',
    'red: { 100: "var(--vx-bad-soft)", 600: "var(--bad)" }',
    'zIndex: {',
    'wizard: "60"',
    '@custom-variant ov-laptop (@media (max-width: 900px));',
    '@custom-variant ov-tablet (@media (max-width: 760px));',
    '@custom-variant ov-mobile (@media (max-width: 520px));',
  ]) {
    assert.ok(config.includes(trecho) || theme.includes(trecho), `o preset deve expor ${trecho}`);
  }
  for (const token of [
    "--bg-base:#020617", "--bg-surface:#0F172A", "--bg-elevated:#1E293B",
    "--text-main:#F8FAFC", "--border-light:#334155",
    "--bg:var(--bg-base)", "--s1:var(--bg-surface)", "--s2:var(--bg-elevated)",
    "--tx:var(--text-main)", "--sb-bg:var(--bg-surface)",
  ]) {
    assert.ok(legacyCss.includes(token), `o tema escuro deve mapear ${token}`);
  }
});
