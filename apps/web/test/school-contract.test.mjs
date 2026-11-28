import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const read = (file) => fs.readFileSync(new URL(file, import.meta.url), "utf8");
const page = read("../src/app/page.tsx");
const workspace = read("../src/app/school-workspace.tsx");
const experience = read("../src/app/school-experience.tsx");
const ui = read("../src/app/school-ui.tsx");
const policy = read("../../api/src/auth/module-policy.ts");
const service = read("../../api/src/modules/school/school.service.ts");
const rules = read("../../api/src/modules/school/school-rules.ts");
const defaults = read("../../api/src/modules/school/music-school-defaults.ts");

test("Gestão escolar é item único do menu, não herda CALENDAR e não aparece como Escola de Música", () => {
  assert.match(page, /\{ label: "Gestão escolar", icon: "graduation-cap" \}/);
  assert.ok(page.includes('"Gestão escolar":()=>import("./school-workspace")'));
  assert.match(page, /'Gestão escolar':'SCHOOL'/);
  assert.match(page, /active === "Gestão escolar" \? \(/);
  assert.match(page, /canConfigure \? <SchoolWorkspace \/>/);
  assert.doesNotMatch(page, /Escola de Música|music-school-workspace/);
  const override = read("../../api/src/operations/business-templates.ts");
  const start = override.indexOf("label: 'Gestão escolar'");
  const section = override.slice(start, override.indexOf("label: 'Matrículas'", start));
  assert.ok(start >= 0, "item único da gestão escolar ausente no perfil");
  assert.doesNotMatch(section, /children/);
  assert.ok(policy.includes('^school(?:\\/|$)'), "a política deve mapear school para SCHOOL");
  assert.match(policy, /return \["SCHOOL"\]/);
  assert.ok(policy.includes('"SCHOOL"'), "SCHOOL deve ser um módulo explícito");
  assert.doesNotMatch(policy, /Escola de Música herda CALENDAR/);
});

test("a gestão enxuta usa somente endpoints tenant-scoped e upload autenticado", () => {
  for (const endpoint of [
    "school/snapshot",
    "school/seed-default-courses",
    "school/records",
    "school/images/course",
  ]) {
    assert.ok(workspace.includes(endpoint), `endpoint ausente: ${endpoint}`);
  }
  assert.match(workspace, /fetch\(`\/api\/backend\/\$\{path\}`/);
  assert.match(workspace, /cache: "no-store"/);
  assert.match(workspace, /new FormData\(\)/);
  assert.doesNotMatch(workspace, /music-school\/|classId|school-class-form/);
});

test("os seis cursos padrão seguem a ordem pedida e o formulário só tem nome, foto e descrição", () => {
  const names = [...defaults.matchAll(/name:\s*"([^"]+)"/g)].map((match) => match[1]);
  assert.deepEqual(names, ["Violão", "Baixo", "Teclado", "Bateria", "Sax", "Canto"]);
  const start = workspace.indexOf('data-testid="school-course-form"');
  const form = workspace.slice(start, workspace.indexOf('data-testid="school-teacher-form"', start));
  for (const token of [
    "Nome do curso", "Foto do computador", 'type="file"', 'data-testid="school-course-photo"',
    "Descrição / detalhes", "A foto é enviada e salva nesta empresa",
  ]) {
    assert.ok(form.includes(token), `campo ausente no cadastro de curso: ${token}`);
  }
  assert.doesNotMatch(form, /Nível|Duração|Mensalidade|turma|Turma/);
  assert.match(service, /kind: "COURSE"/);
});

test("o plano individual não aparece como turma na interface", () => {
  for (const file of [workspace, experience, ui, page]) {
    assert.doesNotMatch(file, />\s*Turma\b|\bTurmas\b|turma\(s\)/);
  }
  assert.match(service, /individualClass\(/);
  assert.match(service, /Plano do aluno/);
});

test("a Visão geral mantém aula, presença pareada, resumo, saldo e gráficos", () => {
  for (const token of [
    "school-lesson-flow", "school-paired-attendance", "school-lesson-submit",
    "Aulas restantes", "Faltas", "Aulas ministradas", "<BarChart", "finance-chart-students",
    "Presença de aluno e professor", "resumo do que foi estudado",
  ]) {
    assert.ok(experience.includes(token) || workspace.includes(token), `fluxo ausente: ${token}`);
  }
  assert.match(ui, /role="img"/);
  assert.match(ui, /aria-label/);
  assert.match(experience, /De \$\{selectedBalance\.contracted\} contratadas/);
});

test("todos os formulários ativos possuem data-testid estável", () => {
  for (const testId of [
    "school-course-form", "school-course-photo", "school-teacher-form", "school-student-form",
    "school-enroll-form", "school-lesson-flow", "school-paired-attendance", "school-lesson-submit",
  ]) {
    const source = testId.startsWith("school-lesson") || testId === "school-paired-attendance" ? experience : workspace;
    assert.ok(source.includes(`data-testid="${testId}"`), `formulário ausente: ${testId}`);
  }
  assert.match(workspace, /<details /);
});

test("cobranças, lembretes e notificações permanecem como configuração sem envio afirmado", () => {
  assert.match(workspace, /Nenhuma cobrança|nenhum envio é afirmado/i);
  assert.match(experience, /Nenhuma cobrança automática/);
  assert.match(experience, /Baixa informada por humano/);
  assert.match(experience, /Nenhuma mensagem foi enviada/);
  assert.doesNotMatch(workspace, /Pagamento confirmado|Mensagem enviada|Notificação enviada|Publicado/);
  assert.doesNotMatch(experience, /Pagamento confirmado|Mensagem enviada|Notificação enviada/);
  assert.match(service, /tuitionStatus: "SCHEDULED"/);
  assert.match(service, /status: "SCHEDULED"/);
  assert.match(service, /executed: false/);
  assert.match(service, /confirmed: false/);
});

test("requisitos Fermata são regras determinísticas e configuração, sem disparo real", () => {
  for (const token of [
    "Duas mensalidades em atraso", "20%", "30 minutos antes da aula", "5 dias antes",
    "Presença de aluno e professor", "resumo do que foi estudado", "dias de aula contabilizados",
  ]) {
    assert.ok(workspace.toLowerCase().includes(token.toLowerCase()), `regra ausente: ${token}`);
  }
  for (const token of [
    "teacherReminderMinutesBefore", "paymentReminderDaysBefore", "penaltyForBreach",
    "billingPeriodKey", "recordPairedAttendance", "cancellationStatus: status",
    '"SUGGESTED"', "notified: false",
  ]) {
    assert.ok(service.includes(token), `regra determinística ausente: ${token}`);
  }
  assert.match(rules, /CLASS_PERIODS = \["MANHA", "TARDE", "NOITE"\]/);
  assert.match(rules, /CONTRACT_PERIODS = \["MONTHLY", "QUARTERLY", "SEMESTER", "YEARLY"\]/);
});
