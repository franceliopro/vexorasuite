import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const wizard = read("src/app/sites/wizard/wizard-shell.tsx");
const workspace = read("src/app/sites-workspace.tsx");

test("wizard sends the description and optional layout image as the IA source", () => {
  assert.ok(wizard.includes("| { kind: 'ia'; prompt: string; layoutImage?: LayoutImageReference }"));
  assert.ok(wizard.includes("source = { kind: 'ia', prompt: prompt.trim(), layoutImage: layoutImage ?? undefined };"));
  assert.ok(wizard.includes("(origem === 'ia' && (prompt.trim().length >= 3 || layoutImage !== null))"));
  assert.ok(wizard.includes("Descreva a ideia (opcional se houver imagem)"));
  assert.ok(wizard.includes("Imagem de layout (opcional)"));
  assert.ok(wizard.includes("A IA usa a imagem para sugerir a estrutura"));
});

test("wizard resizes the layout image locally before sending it", () => {
  assert.ok(wizard.includes("async function fileToLayoutImage(file: File): Promise<LayoutImageReference>"));
  assert.ok(wizard.includes("const LAYOUT_IMAGE_MAX_BYTES = 8 * 1024 * 1024;"));
  assert.ok(wizard.includes("const LAYOUT_IMAGE_MAX_SIDE = 1600;"));
  assert.ok(wizard.includes("canvas.toDataURL('image/jpeg', 0.82)"));
  assert.ok(wizard.includes("URL.revokeObjectURL(url)"));
});

test("wizard exposes image upload as an explicit source and requires the capture", () => {
  assert.ok(wizard.includes("| { kind: 'image'; layoutImage: LayoutImageReference; prompt?: string }"));
  assert.ok(wizard.includes("label: 'Upload de imagem'"));
  assert.ok(wizard.includes("(origem === 'image' && layoutImage !== null)"));
  assert.ok(wizard.includes("if (origem === 'image' && !layoutImage)"));
  assert.ok(wizard.includes("Imagem do layout (obrigatória)"));
  assert.ok(wizard.includes("aria-required={value === 'image'}"));
  assert.ok(wizard.includes("A imagem recria a estrutura do rascunho"));
  assert.ok(wizard.includes("source = { kind: 'image', layoutImage, ...(prompt.trim() ? { prompt: prompt.trim() } : {}) };"));
});

test("site creation forwards prompt and layout image to the backend", () => {
  assert.ok(workspace.includes('if (source.kind === "ia" || source.kind === "image") {'));
  assert.ok(workspace.includes('if (source.prompt) body.prompt = source.prompt;'));
  assert.ok(workspace.includes('if (source.layoutImage) body.layoutImage = source.layoutImage;'));
  assert.ok(workspace.includes("Rascunho recriado a partir da imagem de layout"));
  assert.ok(workspace.includes("Rascunho com estrutura sugerida pela imagem de layout"));
  assert.ok(workspace.includes('Avisos: ${warnings.slice(0, 2).join(" ")}'));
});

test("wizard asks for an optional logo and forwards it to the backend", () => {
  assert.ok(wizard.includes("URL do logotipo (opcional)"));
  assert.ok(wizard.includes("Se deixar em branco, criamos um logotipo provisório"));
  assert.ok(wizard.includes("logoUrl: logoUrl.trim() || undefined"));
  assert.ok(workspace.includes("if (input.logoUrl) body.logoUrl = input.logoUrl;"));
});

test("editor exposes generated pages in the page selector", () => {
  const editorShell = read("src/app/sites/editor/editor-shell.tsx");
  assert.ok(editorShell.includes("Início (index)"));
  assert.ok(editorShell.includes("rascunho legal"));
  assert.ok(editorShell.includes("activeRoot ? [activeRoot] : []"));
});
