import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const read = (file) => fs.readFileSync(new URL(file, import.meta.url), "utf8");
const page = read("../src/app/page.tsx");
const experience = read("../src/app/school-experience.tsx");
const ui = read("../src/app/school-ui.tsx");
const policy = read("../../api/src/auth/module-policy.ts");
const service = read("../../api/src/modules/school/school.service.ts");
const rules = read("../../api/src/modules/school/school-rules.ts");
const readService = read("../../api/src/modules/school/school-read.service.ts");
const templates = read("../../api/src/operations/business-templates.ts");
const webPackage = read("../package.json");

test("a Visão geral do perfil escolar abre o app em vez do painel genérico", () => {
  assert.ok(page.includes('import { SchoolExperience } from "./school-experience"'));
  assert.match(page, /schoolProfile \? <SchoolExperience userName=/);
  assert.ok(page.includes('const isOverview = active === "Visão geral";'));
  assert.ok(page.includes('"Matrículas":()=>import("./school-enrollments-workspace")'));
  assert.match(page, /'Matrículas':'SCHOOL'/);
  assert.ok(policy.includes('if (/^school(?:\\/|$)/.test(p)) return ["SCHOOL"];'));
  assert.ok(policy.includes('if (/^school-enrollments(?:\\/|$)/.test(p)) return ["SCHOOL"];'));
});

test("o perfil music-school não expõe Atendimento, CRM nem agentes de IA", () => {
  const segment = templates.split("\n").find((line) => line.includes("id:'music-school'"));
  assert.ok(segment, "segmento music-school ausente");
  assert.match(segment, /modules:\['SCHOOL','CALENDAR','FINANCE','AUTOMATION','SETTINGS'\]/);
  assert.doesNotMatch(segment, /'INBOX'|'CRM'/);

  const start = templates.indexOf("const SCHOOL_PROFILE_OVERRIDES");
  const override = templates.slice(start, templates.indexOf("\n};", start));
  assert.match(override, /overview: 'SCHOOL'/);
  assert.match(override, /aiUses: \[\]/);
  assert.match(override, /Chatbot da escola/);
  assert.match(override, /label: 'Matrículas', target: 'Matrículas'/);
  assert.doesNotMatch(override, /Agentes de IA|Atendimento|CRM/);
});

test("o app é mobile first com botões grandes, cores e uma janela por vez", () => {
  for (const token of ["min-h-12", "min-h-14", "min-h-16", "tileGrid", "quickButton", "metricGrid", "amber-100", "amber-600"]) {
    assert.ok(ui.includes(token), `token de design ausente: ${token}`);
  }
  assert.match(ui, /export function ActionTile/);
  assert.match(ui, /export function QuickAction/);
  assert.match(ui, /export function MetricTile/);
  assert.match(ui, /export function BarChart/);
  assert.match(ui, /export function CourseCard/);
  assert.match(ui, /export function SchoolSheet/);
  assert.match(experience, /const \[tab, setTab\]/);
  assert.match(experience, /const \[sheet, setSheet\]/);
  assert.match(experience, /setTab\(id as Tab\); setSheet\(null\)/);
  assert.match(experience, /vexora:school-tab/);
  assert.match(ui, /grid grid-cols-5/);
  assert.match(webPackage, /"@tailwindcss\/postcss": "4\.3\.5"/);
  assert.match(webPackage, /"tailwindcss": "4\.3\.5"/);
});

test("o catálogo mostra foto, nome e detalhes com o mesmo padrão do formulário", () => {
  assert.match(ui, /course\.imageUrl \?/);
  assert.match(ui, /alt=\{`Foto do curso \$\{course\.name\}`\}/);
  assert.match(ui, /<Music2/);
  assert.match(ui, /course\.summary/);
  assert.match(ui, /<h3/);
  assert.match(experience, /<CourseCard/);
  assert.match(experience, /onEnroll=\{\(\) =>/);
  assert.match(experience, /school-course-sheet/);
  const publicForm = read("../src/app/m/[token]/page.tsx");
  for (const token of ["schoolTw.card", "schoolTw.tile", "schoolTw.buttonPrimary", "data.course?.imageUrl", "Foto do curso"]) {
    assert.ok(publicForm.includes(token), `padrão visual ausente no formulário: ${token}`);
  }
});

test("o fluxo recorrente registra aula, conteúdo e presença pareada", () => {
  for (const token of [
    'kind: "SESSION"',
    'kind: "LESSON_PLAN"',
    "paired: true",
    "studentStatus:",
    "teacherStatus:",
    "school-lesson-flow",
    "school-paired-attendance",
    "school-lesson-submit",
  ]) {
    assert.ok(experience.includes(token), `fluxo de aula ausente: ${token}`);
  }
  for (const token of ['kind === "SESSION"', 'kind === "LESSON_PLAN"', "recordPairedAttendance"]) {
    assert.ok(service.includes(token), `regra de aula ausente: ${token}`);
  }
  assert.match(service, /studentStatus \?\? body\?\.status/);
  assert.match(service, /teacherStatus \?\? body\?\.status/);
  assert.match(rules, /ATTENDANCE_STATUSES = \["PRESENT", "ABSENT", "JUSTIFIED", "MAKEUP", "CANCELLED"\]/);
  assert.match(rules, /SESSION_STATUSES = \["SCHEDULED", "HELD", "CANCELLED"\]/);
});

test("consultas e gráficos mostram saldo, faltas, aulas ministradas e financeiro", () => {
  for (const token of [
    "Aulas restantes",
    "Faltas",
    "Aulas ministradas",
    "<BarChart",
    "finance-chart-students",
    'kind: "PAYMENT_RECEIPT"',
    'kind: "MARK_OVERDUE"',
  ]) {
    assert.ok(experience.includes(token), `indicador ausente: ${token}`);
  }
  assert.match(service, /balanceFor\(/);
  assert.match(readService, /attendanceStats\(/);
  assert.match(service, /kind === "PAYMENT_RECEIPT"/);
  assert.match(service, /kind === "MARK_OVERDUE"/);
  assert.match(service, /externalReference/);
  assert.match(service, /PROVIDER_CONFIRMED/);
});

test("baixas e atrasos permanecem como ações humanas, sem cobrança automática", () => {
  assert.match(experience, /Baixa informada por humano/);
  assert.match(experience, /Nenhuma cobrança automática/);
  assert.match(service, /executed: false/);
  assert.match(service, /confirmed: false/);
  assert.match(service, /notified: false/);
});
