import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const read = (file) => fs.readFileSync(new URL(file, import.meta.url), "utf8");
const page = read("../src/app/page.tsx");
const workspace = read("../src/app/music-school-workspace.tsx");
const policy = read("../../api/src/auth/module-policy.ts");
const service = read("../../api/src/modules/music-school/music-school.service.ts");

test("Gestão escolar é item único do menu e exige SCHOOL", () => {
  assert.match(page, /\{ label: "Gestão escolar", icon: "graduation-cap" \}/);
  assert.ok(page.includes('"Gestão escolar":()=>import("./school-workspace")'));
  assert.match(page, /'Gestão escolar':'SCHOOL'/);
  assert.match(page, /active === "Gestão escolar" \? \(/);
  assert.match(page, /canConfigure \? <SchoolWorkspace \/>/);
  assert.ok(
    page.includes('if(required==="SCHOOL")return session?.tenant.kind!=="PLATFORM"&&(session?.allowedModules||[]).includes("SCHOOL")'),
    "a home deve negar SCHOOL à PLATFORM e a quem não o possui",
  );
  assert.ok(policy.includes('/^music-school(?:\\/|$)/'), "a política legada deve mapear music-school para SCHOOL");
  assert.ok(policy.includes('/^school(?:\\/|$)/'), "a política deve mapear school para SCHOOL");
  assert.match(policy, /return \["SCHOOL"\]/);
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
  assert.match(service, /executed: false,[\s\S]*?confirmed: false/);
  const readService = read("../../api/src/modules/music-school/music-school-read.service.ts");
  assert.match(readService, /executed: false, confirmed: false/);
});

test("detalhes ficam em seções expansíveis e a interface permanece responsiva", () => {
  assert.match(workspace, /<details /);
  assert.match(workspace, /data-testid="music-school-class-form"/);
  assert.match(workspace, /data-testid="music-school-enroll-form"/);
  assert.match(workspace, /data-testid="music-school-attendance-form"/);
  assert.match(workspace, /lg:grid-cols-3/);
});
