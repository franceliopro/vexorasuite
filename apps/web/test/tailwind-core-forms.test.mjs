import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

const alarms = read("src/app/alarm-center.tsx");
const course = read("src/app/course-workspace.tsx");
const post = read("src/app/post-body-editor.tsx");
const photo = read("src/app/profile-photo-editor.tsx");
const prompt = read("src/app/rich-prompt-editor.tsx");
const screens = [alarms, course, post, photo, prompt];

function classValues(source) {
  const values = [];
  for (const match of source.matchAll(/className\s*=\s*(?:"([^"]*)"|\{([\s\S]*?)\})/g)) {
    if (match[1] !== undefined) {
      values.push(match[1]);
      continue;
    }
    for (const literal of match[2].matchAll(/(["'])([^"']*)\1/g)) values.push(literal[2]);
  }
  return values.join("\n");
}
const classes = screens.map(classValues).join("\n");

test("os formularios e editores nao usam mais classes componente de botao legadas", () => {
  assert.doesNotMatch(classes, /\b(?:primary-button|secondary-button|text-button|danger-button|danger-text|icon-button)\b/);
});

test("os formularios e editores usam so utilities, sem remendos", () => {
  for (const forbidden of [
    /\[[a-z-]+:\s*[^]\s]+\]/,
    /#[0-9a-fA-F]{3,8}\b/,
    /color-mix\(/,
    /!important/,
    /@apply/,
    /@tailwind\s+base/,
  ]) {
    const match = screens.join("\n").match(forbidden);
    assert.equal(match, null, `remendo visual encontrado: ${match?.[0]}`);
  }
  for (const utility of [
    "min-h-control items-center justify-center gap-2 rounded-token-sm bg-blue-600",
    "border border-line bg-surface-2 px-4 text-body font-bold text-ink",
    "min-h-8 items-center justify-center gap-2 rounded-token-sm px-1.5 text-body font-bold text-blue-600",
  ]) {
    assert.ok(screens.join("\n").includes(utility), `falta a utility ${utility}`);
  }
});

test("os contratos dos formularios e editores permanecem intactos", () => {
  for (const token of [
    "/api/backend/reminders/alarms", 'role="alertdialog"', "alarm-snooze", "alarm-stop", "Adiar 5 min", "Parar",
  ]) assert.ok(alarms.includes(token), `alarmes perdeu ${token}`);
  for (const token of ["course-print", "Certificado", "window.print()"]) {
    assert.ok(course.includes(token), `curso perdeu ${token}`);
  }
  for (const token of [
    "tiptap", 'role="toolbar"', 'role: "textbox"', "Inserir galeria", "Inserir link", "Youtube", "Corpo do texto",
  ]) assert.ok(post.includes(token), `editor de texto perdeu ${token}`);
  for (const token of ["/api/backend/profile/", 'role="status"', "Trocar foto", "accept=\"image/*\""]) {
    assert.ok(photo.includes(token), `foto perdeu ${token}`);
  }
  for (const token of [
    "VexoraDialog", 'role="toolbar"', "Concluir edição", "Alternar texto de origem", "markdown",
  ]) assert.ok(prompt.includes(token), `prompt perdeu ${token}`);
});
