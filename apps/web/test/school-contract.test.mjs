import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const read = (file) => fs.readFileSync(new URL(file, import.meta.url), "utf8");
const page = read("../src/app/page.tsx");
const workspace = read("../src/app/school-workspace.tsx");
const policy = read("../../api/src/auth/module-policy.ts");
const service = read("../../api/src/modules/school/school.service.ts");

test("Gestão escolar é item único do menu, não herda CALENDAR e não aparece como Escola de Música", () => {
  assert.match(page, /\{ label: "Gestão escolar", icon: "graduation-cap" \}/);
  assert.ok(page.includes('"Gestão escolar":()=>import("./school-workspace")'));
  assert.match(page, /'Gestão escolar':'SCHOOL'/);
  assert.match(page, /active === "Gestão escolar" \? \(/);
  assert.match(page, /canConfigure \? <SchoolWorkspace \/>/);
  assert.doesNotMatch(page, /Escola de Música|music-school-workspace/);
  assert.ok(policy.includes('^school(?:\\/|$)'), "a política deve mapear school para SCHOOL");
  assert.match(policy, /return \["SCHOOL"\]/);
  assert.ok(policy.includes('"SCHOOL"'), "SCHOOL deve ser um módulo explícito");
  assert.doesNotMatch(policy, /Escola de Música herda CALENDAR/);
});

test("workspace usa somente endpoints tenant-scoped da Gestão escolar", () => {
  for (const endpoint of [
    "school/snapshot",
    "school/records",
    "school/attendances",
  ]) {
    assert.ok(workspace.includes(endpoint), `endpoint ausente: ${endpoint}`);
  }
  assert.match(workspace, /fetch\(`\/api\/backend\/\$\{path\}`/);
  assert.match(workspace, /cache: "no-store"/);
});

test("plano de aula usa editor rico Tiptap com formatação, mídia e auto-embed", () => {
  for (const token of [
    "@tiptap/react",
    "useEditor",
    "EditorContent",
    "StarterKit",
    "Image.configure",
    "allowBase64",
    'type="file"',
    "readAsDataURL",
    "setImage",
    "insertContent",
    "handlePaste",
    "clipboardData",
    "schoolYoutube",
    "iframe.school-youtube",
    "youtube-nocookie.com/embed/",
    'role="toolbar"',
    'aria-label="Formatação',
    "Alternar",
  ]) {
    assert.ok(workspace.includes(token), `editor ausente: ${token}`);
  }
  assert.match(workspace, /immediatelyRender: false/);
  assert.match(workspace, /levels: \[2, 3\]/);
  assert.match(workspace, /2 \* 1024 \* 1024/);
  assert.match(workspace, /rel="noopener noreferrer"/);
});

test("indicadores e saldos aparecem com gráfico e texto honesto", () => {
  assert.match(workspace, /<svg /);
  assert.match(workspace, /role="img"/);
  assert.match(workspace, /aria-label/);
  assert.match(workspace, /Faltam/);
  assert.match(workspace, /Contratadas:/);
  assert.match(workspace, /Consumidas:/);
});

test("todos os formulários possuem data-testid estável", () => {
  for (const testId of [
    "school-course-form",
    "school-subject-form",
    "school-person-form",
    "school-room-form",
    "school-class-form",
    "school-enroll-form",
    "school-session-form",
    "school-attendance-form",
    "school-plan-form",
    "school-grade-form",
    "school-guardian-form",
    "school-notice-form",
    "school-material-form",
    "school-paired-attendance-form",
    "school-lesson-summary-form",
    "school-billing-policy-form",
    "school-payment-receipt-form",
    "school-overdue-form",
    "school-cancellation-form",
  ]) {
    assert.ok(workspace.includes(`data-testid="${testId}"`), `formulário ausente: ${testId}`);
  }
  assert.match(workspace, /<details /);
  assert.match(workspace, /lg:grid-cols-3/);
  assert.match(workspace, /min-h-control/);
});

test("avisos e mensalidades permanecem agendados, sem afirmação de envio", () => {
  assert.match(workspace, /Cobrança agendada — não enviada/);
  assert.match(workspace, /nenhum envio/i);
  assert.doesNotMatch(workspace, /Pagamento confirmado|Mensagem enviada|Notificação enviada|Publicado/);
  assert.match(service, /tuitionStatus: "SCHEDULED"/);
  assert.match(service, /status: "SCHEDULED"/);
  assert.match(service, /executed: false/);
  assert.match(service, /confirmed: false/);
});

test("requisitos Fermata são regras determinísticas e configuração, sem disparo real", () => {
  for (const token of [
    "school-paired-attendance-form",
    "school-lesson-summary-form",
    "school-billing-policy-form",
    "school-payment-receipt-form",
    "school-overdue-form",
    "school-cancellation-form",
    "Dias de aula contabilizados",
    "Multa calculada",
    "Cancelamento somente com aprovação",
  ]) {
    assert.ok(workspace.includes(token), `controlo ausente: ${token}`);
  }
  assert.match(service, /penaltyForBreach/);
  assert.match(service, /billingPeriodKey/);
  assert.match(service, /recordPairedAttendance/);
  assert.match(service, /cancellationStatus: "SUGGESTED"/);
  assert.match(service, /notified: false/);
});
