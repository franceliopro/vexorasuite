import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const read = (file) => fs.readFileSync(new URL(`../${file}`, import.meta.url), "utf8");
const compose = read("../../infra/telephony/docker-compose.yml");
const guide = read("../../infra/telephony/DOKPLOY.md");
const migration = read("../../infra/telephony/migrations/001_call_events.sql");
const dockerfile = read("../../apps/telephony/Dockerfile");
const workflow = read("../../.github/workflows/telephony-service.yml");
const rootCompose = read("../../docker-compose.yml");
const centralGuide = read("../../docs/deployment-dokploy.md");
const productFocus = read("../../docs/product-focus.md");
const status = read("../../docs/implementation-status.md");
const register = read("../../docs/implementation-register.md");

test("a stack de telefonia é separada e não publica o banco", () => {
  assert.match(compose, /name: vexora-telephony/);
  assert.match(compose, /image: postgres:17-alpine/);
  assert.match(compose, /telephony-pgdata:\/var\/lib\/postgresql\/data/);
  const databaseBlock = compose.split(/\n {2}telephony:/)[0];
  assert.match(databaseBlock, /^ {2}database:/m);
  assert.match(databaseBlock, /^ {4}expose:\s*$/m);
  assert.doesNotMatch(databaseBlock, /^ {4}ports:\s*$/m);
  assert.doesNotMatch(rootCompose, /vexora-telephony|telephony-pgdata/i);
});

test("segredos e configuração por tenant vêm do cofre por interpolação obrigatória", () => {
  for (const name of [
    "TELEPHONY_POSTGRES_USER",
    "TELEPHONY_POSTGRES_PASSWORD",
    "TELEPHONY_POSTGRES_DB",
    "TELEPHONY_TENANTS",
  ]) {
    assert.match(compose, new RegExp(`\\$\\{${name}:\\?`), `variável não obrigatória: ${name}`);
  }
  assert.doesNotMatch(compose, /(?:webhookSecret|POSTGRES_PASSWORD):\s*[A-Za-z0-9+/]{16,}/i);
  assert.doesNotMatch(guide, /"webhookSecret"\s*:\s*"[A-Za-z0-9+/]{24,}"/);
});

test("o Dockerfile apontado pelo Compose segue o padrão do monorepo e não contém segredos", () => {
  assert.match(compose, /dockerfile: apps\/telephony\/Dockerfile/);
  assert.match(compose, /context: \.\.\/\.\./);
  assert.match(dockerfile, /FROM node:26\.13\.0-alpine AS base/);
  assert.match(dockerfile, /pnpm --filter @vexorasuite\/telephony build/);
  assert.doesNotMatch(dockerfile, /TELEPHONY_TENANTS|POSTGRES_PASSWORD|webhookSecret/);
  assert.match(workflow, /docker build --file apps\/telephony\/Dockerfile \./);
});

test("a migration garante consentimento, idempotência e hash sem número em texto", () => {
  assert.match(migration, /CREATE TABLE IF NOT EXISTS call_consent/);
  assert.match(migration, /CREATE TABLE IF NOT EXISTS call_events/);
  assert.match(migration, /CREATE TABLE IF NOT EXISTS telephony_audit/);
  assert.match(migration, /call_consent_tenant_channel_party_key UNIQUE \(tenant_id, channel, party_hash\)/);
  assert.match(migration, /call_events_idempotency_key UNIQUE \(tenant_id, provider, external_call_id, event_type\)/);
  assert.match(migration, /CONSTRAINT call_events_media_requires_consent CHECK/);
  assert.match(migration, /ai_allowed\s+BOOLEAN\s+NOT NULL DEFAULT false/);
  assert.match(migration, /length\(party_hash\) = 64/);
  assert.doesNotMatch(migration, /\b(phone|phone_number|numero|telefone)\s+(TEXT|VARCHAR)/i);
});

test("o guia não afirma chamada, deploy ou integração com operadora", () => {
  assert.match(guide, /Reabertura aprovada pelo proprietário em 26\/11\/2026/);
  assert.match(guide, /TELEPHONY_MODE=simulation/);
  assert.match(guide, /\*\*não\*\* prova deploy/);
  assert.match(guide, /chamada, mensagem ou IA é executada/);
  assert.match(guide, /scraping/i);
});

test("o CI valida compose, migration, build e testes do serviço", () => {
  assert.match(workflow, /docker compose -f infra\/telephony\/docker-compose\.yml config/);
  assert.match(workflow, /node --test apps\/web\/test\/telephony-service-contract\.test\.mjs/);
  assert.match(workflow, /pnpm --filter @vexorasuite\/telephony test/);
  assert.match(workflow, /call_events_media_requires_consent/);
  assert.match(workflow, /call_events_idempotency_key/);
  assert.match(workflow, /pg_isready -h 127\.0\.0\.1/);
  assert.match(workflow, /ci-placeholder-not-a-production-secret/);
});

test("os documentos registram a reabertura sem prometer execução real", () => {
  assert.match(productFocus, /Reabertura de 26\/11\/2026/);
  assert.match(productFocus, /TELEPHONY_MODE=simulation/);
  assert.match(productFocus, /nunca scraping/);
  assert.match(status, /Telefonia\/SMS e chamadas ao vivo com IA/);
  assert.match(status, /Não entregue:/);
  assert.match(status, /aiInvoked: false/);
  assert.match(register, /Reabertura aprovada em 26\/11\/2026 \(item 13\)/);
  assert.match(register, /Nenhuma chamada, mensagem ou IA real foi executada/);
  assert.match(centralGuide, /Telefonia \(reabertura aprovada em 26\/11\/2026\)/);
  assert.match(centralGuide, /TELEPHONY_MODE=simulation/);
  assert.match(centralGuide, /não prova deploy/);
});
