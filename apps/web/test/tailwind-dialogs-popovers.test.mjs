import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const root = new URL("../", import.meta.url);
const read = (file) => fs.readFileSync(new URL(file, root), "utf8");

const files = [
  "src/app/anchored-popover.tsx",
  "src/app/vexora-dialog.tsx",
  "src/app/file-image-picker.tsx",
  "src/app/file-manager.tsx",
  "src/app/mention-popover.tsx",
  "src/app/mention-notifications.tsx",
  "src/app/whatsapp-bridge.tsx",
];
const sources = new Map(files.map((file) => [file, read(file)]));
const label = (file) => file.split("/").pop();

/** Resolve constantes e mapas Record<string,string> usados em className. */
function classValues(source) {
  const constants = new Map();
  for (const match of source.matchAll(/\bconst\s+([A-Za-z_$][\w$]*)\s*(?::[^=]+)?=\s*"([^"]*)"/g)) {
    constants.set(match[1], match[2]);
  }
  for (const match of source.matchAll(/\bconst\s+([A-Za-z_$][\w$]*)\s*:\s*Record<[^>]*>\s*=\s*\{([\s\S]*?)\};/g)) {
    const literals = [...match[2].matchAll(/(["'])([^"']*)\1/g)].map((literal) => literal[2]);
    if (literals.length) constants.set(match[1], literals.join(" "));
  }
  const values = [];
  for (const match of source.matchAll(/className\s*=\s*(?:"([^"]*)"|\{([\s\S]*?)\})/g)) {
    if (match[1] !== undefined) {
      values.push(match[1]);
      continue;
    }
    for (const literal of match[2].matchAll(/(["'])([^"']*)\1/g)) values.push(literal[2]);
    for (const [name, value] of constants) {
      if (new RegExp(`\\b${name}\\b`).test(match[2])) values.push(value);
    }
  }
  return values.join(" ").split(/\s+/).filter(Boolean);
}
const classTokens = new Map(files.map((file) => [file, classValues(sources.get(file))]));
const allClasses = new Set([...classTokens.values()].flat());

// Variantes explícitamente permitidas pela convenção do repo.
const allowedVariants = /\b(?:ib-narrow|ov-laptop|rw-laptop):/g;
const legacyPrefix = /\b(?:ov|vx|ib|rw|auth|alarm|platform-admin|design-approval)-[a-z0-9-]+/;
const legacyExact = /\b(?:content-card|settings-card|primary-button|secondary-button|text-button|icon-button|vx-spin)\b/;

test("os sete arquivos não contêm token legado de classe algum", () => {
  for (const [file, source] of sources) {
    const cleaned = source.replace(allowedVariants, "");
    assert.doesNotMatch(cleaned, legacyPrefix, `${label(file)}: token legado no código`);
    assert.doesNotMatch(cleaned.replace(/\s+/g, " "), legacyExact, `${label(file)}: classe componente legada`);
  }
  for (const [file, tokens] of classTokens) {
    for (const token of tokens) {
      assert.doesNotMatch(token, legacyPrefix, `${label(file)}: token legado em className: ${token}`);
      assert.doesNotMatch(token, legacyExact, `${label(file)}: classe componente legada: ${token}`);
    }
  }
});

test("não há remendos visuais, arbitrários, hex, important ou @apply", () => {
  for (const [file, source] of sources) {
    for (const forbidden of [
      /\[[a-z-]+:\s*[^]\s]+\]/,
      /#[0-9a-fA-F]{3,8}\b/,
      /color-mix\(/,
      /!important/,
      /@apply\b/,
      /@tailwind\s+base\b/,
    ]) {
      const match = source.match(forbidden);
      assert.equal(match, null, `${label(file)}: remendo visual ${match?.[0]}`);
    }
  }
});

test("classes dependentes de estado são literais completas", () => {
  for (const [file, source] of sources) {
    assert.doesNotMatch(source, /className=\{`/, `${label(file)}: template interpolado em className`);
    assert.doesNotMatch(
      source,
      /className=\{[^}]*\?\s*(["'])\s+[^"']*\1\s*:/,
      `${label(file)}: literal de estado começando com espaço`,
    );
  }
  assert.ok(classTokens.get("src/app/vexora-dialog.tsx").includes("max-w-4xl"));
  assert.ok(classTokens.get("src/app/vexora-dialog.tsx").includes("max-w-lg"));
  assert.ok(classTokens.get("src/app/mention-popover.tsx").includes("dark:bg-slate-700"));
  assert.ok(classTokens.get("src/app/mention-popover.tsx").includes("dark:hover:bg-slate-800"));
});

test("as utilities Tailwind básicas da fatia estão presentes", () => {
  for (const utility of [
    "fixed", "inset-0", "relative", "grid", "flex", "place-items-center",
    "rounded-lg", "rounded-xl", "rounded-full", "border", "border-slate-700",
    "dark:bg-slate-900", "dark:bg-slate-800", "bg-slate-900/80", "dark:text-slate-50",
    "dark:text-slate-200", "dark:text-slate-300", "max-h-dvh", "max-w-4xl",
    "size-8", "size-9", "size-10", "text-xs", "text-2xs", "bg-blue-600",
    "text-white", "bg-red-600", "shadow-2xl", "backdrop-blur-sm", "animate-spin",
  ]) {
    assert.ok(allClasses.has(utility), `falta a utility ${utility}`);
  }
});

test("o escuro é slate real, nunca blue-dark", () => {
  for (const [file, source] of sources) {
    assert.doesNotMatch(
      source,
      /\b(?:bg|text|border|from|via|to)-(?:blue|indigo|slate)-950\b/,
      `${label(file)}: tom blue-dark em classe`,
    );
  }
  for (const utility of ["dark:bg-slate-900", "dark:bg-slate-800", "dark:border-slate-700", "dark:text-slate-50", "dark:text-slate-200"]) {
    assert.ok(allClasses.has(utility), `falta o slate real ${utility}`);
  }
});

test("o popover ancorado mantém posição, camada e contrato", () => {
  const source = sources.get("src/app/anchored-popover.tsx");
  for (const token of [
    "export function AnchoredPopover",
    "anchorRef",
    'data-testid={testId}',
    "id={id}",
    "role={role}",
    "aria-label={ariaLabel}",
    "useLayoutEffect",
    'window.addEventListener("resize", place)',
    'window.addEventListener("scroll", place, true)',
    'className={"fixed " + className}',
    "style={{",
    "...position,",
    'maxWidth: "calc(100vw - 16px)"',
    'maxHeight: "calc(100vh - 16px)"',
    'overflowY: "auto"',
    "zIndex: 260,",
  ]) {
    assert.ok(source.includes(token), `o popover perdeu ${token}`);
  }
  assert.equal((source.match(/data-testid=/g) ?? []).length, 1);
});

test("a janela compartilhada preserva testids, aria e portal", () => {
  const source = sources.get("src/app/vexora-dialog.tsx");
  for (const token of [
    'data-testid="vexora-dialog-backdrop"',
    'data-testid="vexora-dialog"',
    'data-wide={wide?"true":"false"}',
    'data-testid="vexora-dialog-heading"',
    'data-testid="vexora-dialog-icon"',
    'data-testid="vexora-dialog-close"',
    'data-testid="vexora-dialog-body"',
    'data-testid="vexora-dialog-footer"',
    'role="dialog"',
    'aria-modal="true"',
    "aria-label={title}",
    'aria-label="Fechar janela"',
    "useModalDialog(open&&mounted,ref,onClose)",
    "createPortal(",
    "document.body",
    "onMouseDown={e=>{if(e.target===e.currentTarget)onClose();}}",
    "style={{ zIndex: 1000 }}",
  ]) {
    assert.ok(source.includes(token), `o modal perdeu ${token}`);
  }
  assert.equal((source.match(/data-testid=/g) ?? []).length, 7);
});

test("o seletor de imagens preserva testids, callbacks e teclado", () => {
  const source = sources.get("src/app/file-image-picker.tsx");
  for (const token of [
    'data-testid="file-image-picker-backdrop"',
    'data-testid="file-image-picker"',
    'data-testid="file-image-picker-icon"',
    'data-testid="file-image-picker-body"',
    'data-testid="file-image-picker-grid"',
    'data-testid="file-image-picker-item"',
    'data-testid="file-image-picker-check"',
    'role="presentation"',
    'role="dialog"',
    'aria-modal="true"',
    "aria-label={title}",
    'aria-label="Fechar"',
    'aria-label="Pesquisar imagens"',
    "aria-pressed={multiple ? isSelected : true}",
    '"/sites/assets"',
    '"/api/backend/sites/assets"',
    "onSelect([asset.url], [asset])",
    "onSelect(chosen.map(a => a.url), chosen)",
    'if (e.key === "Escape") onClose()',
    "if (e.target === e.currentTarget) onClose()",
  ]) {
    assert.ok(source.includes(token), `o seletor perdeu ${token}`);
  }
  assert.equal((source.match(/data-testid=/g) ?? []).length, 7);
});

test("o gerenciador de arquivos preserva hooks, endpoints e lightbox", () => {
  const source = sources.get("src/app/file-manager.tsx");
  for (const token of [
    'data-testid="file-manager"',
    'aria-label="Navegação de pastas"',
    'aria-label="Pesquisar nesta pasta"',
    'aria-pressed={filter === value}',
    'aria-label="Mover para pasta"',
    'aria-label={"Visualizar " + preview.name}',
    'role="dialog"',
    'aria-modal="true"',
    '"/sites/assets?folder=" + encodeURIComponent(target)',
    '"/sites/assets/all-folders"',
    '"/api/backend/sites/assets"',
    "onNotice?.(",
    "onSelect(asset.url, asset.name)",
    "style={{ zIndex: 60 }}",
  ]) {
    assert.ok(source.includes(token), `o gerenciador perdeu ${token}`);
  }
  assert.equal((source.match(/data-testid="file-manager"/g) ?? []).length, 1);
  assert.doesNotMatch(source, /animate-vx-/);
});

test("o popover de menções preserva acessibilidade e foco do compositor", () => {
  const source = sources.get("src/app/mention-popover.tsx");
  for (const token of [
    "export function MentionPopover",
    "mentionQuery",
    "mentionList",
    "mentionIndex",
    "onPick",
    "if (mentionQuery === null) return null",
    'role="listbox"',
    'aria-label="Mencione um atendente"',
    'data-testid="mention-popover"',
    'role="option"',
    "aria-selected={index === mentionIndex}",
    "onMouseDown",
    'data-testid="mention-empty"',
    "Nenhum atendente com esse nome",
    "InitialsAvatar",
  ]) {
    assert.ok(source.includes(token), `as menções perderam ${token}`);
  }
  assert.doesNotMatch(source, /onClick=\{/);
  assert.equal((source.match(/data-testid=/g) ?? []).length, 2);
});

test("as notificações de menção preservam tempo real e contadores", () => {
  const source = sources.get("src/app/mention-notifications.tsx");
  for (const token of [
    'data-testid="mention-notifications"',
    'data-testid="mention-trigger"',
    'data-testid="mention-count"',
    'data-testid="mention-toast"',
    'data-testid="mention-panel"',
    "aria-expanded={open}",
    'role="status"',
    'role="alert"',
    'aria-label="Fechar aviso de menção"',
    'aria-label="Fechar menções"',
    'aria-label="Suas menções"',
    "/api/backend/conversations/mentions",
    'new EventSource("/api/backend/events")',
    '"conversation.updated"',
    '"team.updated"',
    '"vexora:team-updated"',
    'window.location.assign("/?module=Atendimento&conversation="',
    "Marcar como lida",
    "const count=items.filter(item=>!item.readAt).length",
    "style={{ zIndex: 65 }}",
  ]) {
    assert.ok(source.includes(token), `as notificações perderam ${token}`);
  }
  assert.equal((source.match(/data-testid=/g) ?? []).length, 5);
});

test("o bridge do WhatsApp preserva o contrato de abertura", () => {
  const source = sources.get("src/app/whatsapp-bridge.tsx");
  for (const token of [
    'data-testid="whatsapp-bridge"',
    'role="status"',
    'type="tel"',
    "maxLength={60}",
    "required",
    'placeholder="+55 11 99999-9999"',
    '"/api/backend/conversations/" +',
    '"/whatsapp?view=" +',
    "onOpen(d.conversationId)",
    "O histórico atual é preservado.",
  ]) {
    assert.ok(source.includes(token), `o bridge perdeu ${token}`);
  }
  assert.equal((source.match(/data-testid=/g) ?? []).length, 1);
});
