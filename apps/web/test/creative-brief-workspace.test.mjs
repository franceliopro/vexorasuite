import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const read = (file) => fs.readFileSync(new URL(`../${file}`, import.meta.url), "utf8");
const brief = read("src/app/creative-brief-workspace.tsx");
const page = read("src/app/page.tsx");

test("o intake captura todos os blocos obrigatórios do briefing", () => {
  for (const id of [
    "creative-brief-workspace",
    "creative-brief-form",
    "creative-brief-title",
    "creative-brief-objective",
    "creative-brief-channel-format",
    "creative-brief-identity",
    "creative-brief-approved-source",
    "creative-brief-deadline",
    "creative-brief-approver",
    "creative-brief-destination",
    "creative-brief-submit",
    "creative-brief-list",
  ]) {
    assert.ok(brief.includes(`data-testid="${id}"`), `falta o contrato ${id}`);
  }
  assert.ok(brief.includes('type="date"'), "a data limite precisa ser explícita");
  assert.ok(brief.includes("/api/backend/marketing/creative-briefs"));
});

test("o briefing não afirma geração, aprovação, publicação ou entrega", () => {
  assert.ok(brief.includes("Nenhuma peça foi criada, aprovada, publicada ou entregue."));
  assert.ok(brief.includes("somente recebido"));
  for (const claim of ["Peça gerada", "Arte publicada", "Entrega automática", "Briefing aprovado"]) {
    assert.equal(brief.includes(claim), false, `afirmação indevida: ${claim}`);
  }
  assert.ok(brief.includes('method: "POST"'), "o envio do briefing precisa ser explícito");
});

test("Briefings e os menus mortos não são expostos na navegação", () => {
  for (const dead of [
    '{ label: "Briefings", icon: "file-text" }',
    '"Briefings":()=>import("./creative-brief-workspace")',
    'active === "Briefings"',
    "'Briefings':'MARKETING'",
    'label: "Briefings", target: "Briefings"',
    '{ label: "Marketing"',
    '{ label: "Sites"',
  ]) {
    assert.equal(page.includes(dead), false, `entrada morta ainda presente: ${dead}`);
  }
  assert.ok(page.includes('"Biblioteca de referências":()=>import("./creative-library-workspace")'));
});

test("a fatia respeita as regras de classes do design system", () => {
  for (const forbidden of ["ov-", "vx-", "ib-", "rw-", "auth-", "alarm-", "platform-admin-", "content-card", "primary-button", "secondary-button", "icon-button", "vx-spin", "!important", "@apply", "color-mix("]) {
    assert.equal(brief.includes(forbidden), false, `classe proibida: ${forbidden}`);
  }
  assert.equal(/\[[a-z-]+:\s*[^]\s]+\]/.test(brief), false, "valor arbitrário em classe");
  assert.equal(/className="[^"]*#[0-9a-fA-F]{3,8}/.test(brief), false, "hex direto em classe");
});
