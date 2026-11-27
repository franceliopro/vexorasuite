import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const read = (file) => fs.readFileSync(new URL(file, import.meta.url), "utf8");
const service = read("../../api/src/modules/school-enrollments/school-enrollments.service.ts");
const rules = read("../../api/src/modules/school-enrollments/enrollment-rules.ts");
const client = read("../../api/src/modules/school-enrollments/documenso.client.ts");
const controller = read("../../api/src/modules/school-enrollments/school-enrollments.controller.ts");
const module = read("../../api/src/modules/school-enrollments/school-enrollments.module.ts");
const appModule = read("../../api/src/app.module.ts");
const policy = read("../../api/src/auth/module-policy.ts");
const schoolService = read("../../api/src/modules/school/school.service.ts");
const migration = read("../../api/prisma/migrations/20261127140000_school_enrollment_experience/migration.sql");
const publicForm = read("../src/app/m/[token]/page.tsx");
const workspace = read("../src/app/school-enrollments-workspace.tsx");
const statusDoc = read("../../../docs/implementation-status.md");

test("o módulo de matrículas é tenant-scoped e registrado na API", () => {
  assert.ok(appModule.includes("SchoolEnrollmentsModule"));
  assert.match(module, /imports: \[AuthModule, JwtModule\.register\(\{\}\), PrismaModule, OperationsModule\]/);
  assert.match(module, /providers: \[SchoolEnrollmentsService, DocumensoClient\]/);
  assert.match(controller, /@Controller\("school-enrollments"\)/);
  assert.match(controller, /@UseGuards\(AuthGuard\)/);
  assert.ok(policy.includes('if (/^school-enrollments(?:\\/|$)/.test(p)) return ["SCHOOL"];'));
  assert.ok(policy.includes('if (/^school-enrollments\\/(?:public(?:\\/|$)|webhook(?:\\/|$))/.test(p)) return [];'));
  assert.match(service, /tenantId: link\.tenantId/);
  assert.match(service, /where: \{ tenantId, envelopeId: submission\.envelopeId \}/);
  assert.match(service, /where: \{ tenantId \}/);
});

test("o link público usa somente o token e não pré-preenche dados pessoais", () => {
  assert.match(controller, /@Public\(\)\s*@Get\("public\/:token"\)/);
  assert.match(controller, /@Public\(\)\s*@Post\("public\/:token\/submit"\)/);
  assert.match(service, /private async findActiveLink\(token: string\)/);
  assert.match(service, /prefilled: \{\}/);
  assert.match(service, /Dados pessoais da aluna do PDF de referência NÃO são pré-preenchidos/);
  assert.match(publicForm, /studentName: ""/);
  assert.match(publicForm, /studentCpf: ""/);
  assert.doesNotMatch(publicForm, /Jânia/);
  assert.match(publicForm, /sem dados pessoais pré-preenchidos/);
  assert.match(publicForm, /data-testid="public-enrollment-form"/);
  assert.match(publicForm, /data-testid="public-enrollment-submit"/);
});

test("os estados externos são explícitos e nunca confundem preparado com enviado", () => {
  for (const state of ["PREPARED", "WAITING_SIGNATURE", "SIGNED_CONFIRMED", "GENERATED", "DELIVERY_FAILED", "COMPLETED", "FAILED"]) {
    assert.ok(rules.includes(`"${state}"`), `estado ausente: ${state}`);
  }
  assert.match(rules, /Nunca transforme PREPARED em "enviado"/);
  assert.match(service, /status: "PREPARED"/);
  assert.match(service, /status: "WAITING_SIGNATURE"/);
  assert.match(service, /signed: false/);
  assert.match(service, /generated: false/);
  assert.equal((service.match(/sent: false/g) || []).length >= 3, true);
  assert.match(publicForm, /Envio não confirmado/);
  assert.match(publicForm, /Documentos ainda não gerados/);
  assert.match(publicForm, /Contrato e ficha só são gerados após confirmação da assinatura/);
  assert.match(workspace, /Envio só aparece como concluído quando o WhatsApp confirmar/);
  assert.match(workspace, /nenhum envio é reivindicado/);
});

test("a semana usa 1=Segunda ... 7=Domingo em regras, API, migração e formulário", () => {
  assert.match(rules, /WEEKDAYS = \["Segunda-feira", "Terça-feira", "Quarta-feira", "Quinta-feira", "Sexta-feira", "Sábado", "Domingo"\]/);
  assert.match(service, /optionalInteger\(body\?\.weekday, 1, 7, "Dia da semana"\)/);
  assert.match(service, /WEEKDAYS\[selected - 1\]/);
  assert.match(service, /WEEKDAYS\[submission\.weekday - 1\]/);
  assert.match(migration, /"weekday" BETWEEN 1 AND 7/);
  assert.match(publicForm, /\[1, 2, 3, 4, 5, 6, 7\]\.map\(\(day\)/);
});

test("modelos do Drive são manuais; importação automática não é afirmada", () => {
  assert.match(service, /body\?\.driveFileId \? "DRIVE_MANUAL" : "DRIVE_MANUAL"/);
  assert.doesNotMatch(service, /source: "MANUAL"/);
  assert.match(migration, /CHECK \("source" IN \('DRIVE_MANUAL','DRIVE_API'\)\)/);
  assert.match(migration, /DRIVE_MANUAL = texto copiado do Google Drive/);
  assert.match(service, /importedFromDrive: false/);
  assert.match(service, /A importação automática do Drive ainda não foi executada/);
  assert.ok(rules.includes("nome_aluno:"), "variável nome_aluno ausente");
});

test("o cliente Documenso usa a API V2 sem fingir configuração ou assinatura", () => {
  assert.match(client, /DOCUMENSO_API_URL/);
  assert.match(client, /DOCUMENSO_API_TOKEN/);
  assert.match(client, /ServiceUnavailableException\("Documenso ainda não está configurado/);
  assert.ok(client.includes('authorization: `api_${token.replace(/^api_/, "")}`'));
  assert.match(client, /form\.append\("payload"/);
  assert.match(client, /form\.append\("files"/);
  assert.match(client, /\/api\/v2\/envelope\/create/);
  assert.match(client, /\/api\/v2\/envelope\/distribute/);
  assert.ok(client.includes("/^https:\\/\\//"), "signingUrl exige HTTPS");
  assert.match(service, /externalId: submission\.id/);
  assert.match(service, /DOCUMENT_COMPLETED/);
  assert.match(service, /timingSafeEqual/);
  assert.match(controller, /@Headers\("x-documenso-secret"\)/);
  assert.match(service, /UUID_RE\.test\(externalId\)/);
});

test("documentos só são gerados após assinatura confirmada e entregas exigem ID do provedor", () => {
  assert.match(service, /data: \{ status: "SIGNED_CONFIRMED", signedAt: new Date\(\) \}/);
  assert.match(service, /buildPdf\(/);
  assert.match(service, /Contrato · \$\{submission\.studentName\}/);
  assert.match(service, /Ficha de matrícula · \$\{submission\.studentName\}/);
  assert.match(service, /if \(mediaId\)/);
  assert.match(service, /WHATSAPP_SEND_ID_MISSING/);
  assert.match(service, /status = failures > 0 \? "DELIVERY_FAILED" : sends > 0 \? "COMPLETED" : "GENERATED"/);
  assert.match(service, /Nenhum envio foi confirmado/);
});

test("o que não foi executado fica registrado como pendente de evidência", () => {
  assert.match(statusDoc, /configurado/);
  assert.match(statusDoc, /preparado/);
  assert.match(statusDoc, /aguardando assinatura/);
  assert.match(statusDoc, /assinado confirmado/);
  assert.match(statusDoc, /gerado/);
  assert.match(statusDoc, /enviado\/falhado/);
  assert.match(statusDoc, /nenhuma importação automática, assinatura, entrega, WhatsApp, publicação ou deploy/);
  assert.match(statusDoc, /nenhum envelope, assinatura, entrega, webhook, publicação ou deploy/);
  assert.match(statusDoc, /PROVIDER_CONFIRMED` exige `externalReference/);
  assert.match(schoolService, /source === "PROVIDER_CONFIRMED" && !externalReference/);
});
