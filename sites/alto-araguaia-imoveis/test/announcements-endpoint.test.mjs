import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

const form = read("src/components/ContactForm.astro");
const page = read("src/pages/anuncie-seu-imovel.astro");

test("a página de anúncio usa um endpoint opcional do Worker", () => {
  assert.ok(page.includes("PUBLIC_ANNOUNCEMENTS_ENDPOINT"));
  assert.ok(page.includes("endpoint={announcementEndpoint}"));
  assert.ok(form.includes("endpoint = import.meta.env.PUBLIC_CONTACT_ENDPOINT ?? \"\""));
  assert.ok(form.includes("data-endpoint={endpoint}"));
  assert.ok(form.includes("if (endpoint)"));
});

test("sem endpoint o formulário continua no WhatsApp e não promete envio", () => {
  assert.ok(form.includes("Sem endpoint configurado, abrimos o WhatsApp"));
  assert.ok(form.includes("Confirme o envio lá"));
  assert.ok(form.includes("Canal de atendimento em configuração"));
});

test("resposta de sucesso do anúncio diz recebido, não publicado", () => {
  assert.ok(form.includes("data-success-message={successMessage}"));
  assert.ok(form.includes("Recebemos sua submissão. A equipe irá analisá-la"));
  assert.ok(form.includes("form.dataset.successMessage"));
  assert.ok(!form.includes("Anúncio publicado"));
});
