import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const read = (file) => fs.readFileSync(new URL(file, import.meta.url), "utf8");
const page = read("../src/app/page.tsx");
const workspace = read("../src/app/music-school-workspace.tsx");
const policy = read("../../api/src/auth/module-policy.ts");
const service = read("../../api/src/modules/music-school/music-school.service.ts");

test("Escola de Música é item único do menu e herda CALENDAR", () => {
  assert.match(page, /\{ label: "Escola de Música", icon: "graduation-cap" \}/);
  assert.ok(page.includes('"Escola de Música":()=>import("./music-school-workspace")'));
  assert.match(page, /'Escola de Música':'CALENDAR'/);
  assert.match(page, /active === "Escola de Música" \? \(/);
  assert.match(page, /canConfigure \? <MusicSchoolWorkspace \/>/);
  assert.match(policy, /\^music-school(?:\/|\$)/);
  assert.match(policy, /return \["CALENDAR"\]/);
});

test("workspace usa somente endpoints tenant-scoped da Escola de Música", () => {
  for (const endpoint of [
    "music-school/classes",
    "music-school/classes/${enrollForm.classId}/enrollments",
    "music-school/attendances",
    "music-school/balances",
    "music-school/options",
  ]) {
    assert.ok(workspace.includes(endpoint), `endpoint ausente: ${endpoint}`);
  }
  assert.match(workspace, /fetch\(`\/api\/backend\/\$\{path\}`/);
  assert.match(workspace, /cache: "no-store"/);
});

test("cobrança aparece como agendada, sem afirmação de pagamento ou envio", () => {
  assert.match(workspace, /Cobrança agendada — não enviada/);
  assert.match(workspace, /nenhum envio executado/i);
  assert.doesNotMatch(workspace, /Pagamento confirmado|Cobrança confirmada|Mensagem enviada|Notificação enviada/);
  assert.match(service, /billingStatus: "SCHEDULED"/);
  assert.match(service, /executed: false, confirmed: false/);
});

test("detalhes ficam em seções expansíveis e a interface permanece responsiva", () => {
  assert.match(workspace, /<details /);
  assert.match(workspace, /data-testid="music-school-class-form"/);
  assert.match(workspace, /data-testid="music-school-enroll-form"/);
  assert.match(workspace, /data-testid="music-school-attendance-form"/);
  assert.match(workspace, /lg:grid-cols-3/);
});
