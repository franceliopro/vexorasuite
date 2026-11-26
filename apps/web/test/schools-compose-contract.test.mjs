import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const read = (file) => fs.readFileSync(new URL(`../${file}`, import.meta.url), "utf8");
const compose = read("../../infra/schools/docker-compose.yml");
const guide = read("../../infra/schools/DOKPLOY.md");
const migration = read("../../infra/schools/migrations/001_tenant_link.sql");
const workflow = read("../../.github/workflows/schools-contract.yml");
const rootCompose = read("../../docker-compose.yml");
const centralGuide = read("../../docs/deployment-dokploy.md");

test("a stack de escolas é separada e não publica o banco", () => {
  assert.match(compose, /name: vexora-schools/);
  assert.match(compose, /image: postgres:17-alpine/);
  assert.match(compose, /schools-pgdata:\/var\/lib\/postgresql\/data/);
  assert.match(compose, /^\s*expose:\s*$/m);
  assert.doesNotMatch(compose, /^\s*ports:\s*$/m);
  assert.doesNotMatch(compose, /^\s*-\s*"\d+:5432"\s*$/m);
  assert.doesNotMatch(rootCompose, /vexora-schools|schools-pgdata/i);
});

test("segredos e banco vêm do cofre por interpolação obrigatória", () => {
  for (const name of ["SCHOOLS_POSTGRES_USER", "SCHOOLS_POSTGRES_PASSWORD", "SCHOOLS_POSTGRES_DB"]) {
    assert.match(compose, new RegExp(`\\$\\{${name}:\\?`), `variável não obrigatória: ${name}`);
  }
  assert.doesNotMatch(compose, /(?:password|user|db):\s*[A-Za-z0-9]/i);
  assert.doesNotMatch(guide, /(?:POSTGRES_PASSWORD|token|senha)\s*=\s*["']?[A-Za-z0-9+/]{16,}/i);
});

test("a migration cria apenas o vínculo tenant-scoped", () => {
  assert.match(compose, /\.\/migrations:\/docker-entrypoint-initdb\.d:ro/);
  assert.equal([...migration.matchAll(/CREATE TABLE/gi)].length, 1);
  assert.match(migration, /CREATE TABLE IF NOT EXISTS tenant_links/);
  assert.match(migration, /tenant_id\s+UUID\s+NOT NULL/);
  assert.match(migration, /CONSTRAINT tenant_links_tenant_provider_customer_key UNIQUE \(tenant_id, provider, external_customer_id\)/);
  assert.match(migration, /CHECK \(status IN \('ACTIVE', 'SUSPENDED'\)\)/);
  assert.match(migration, /Tenant autenticado na Véxora; nunca vem do sistema externo/);
  assert.doesNotMatch(migration, /password|secret|token/i);
});

test("o guia não afirma deploy, integração ou cadastro acadêmico", () => {
  assert.match(guide, /Projeto Dokploy \*\*separado\*\*/);
  assert.match(guide, /Nenhuma credencial/);
  assert.match(guide, /\*\*não\*\* prova deploy/);
  assert.match(guide, /Sem alunos, turmas ou envios neste slice/);
  assert.match(guide, /Nenhuma IA é chamada daqui/);
});

test("o CI valida o compose e a unicidade da tríade", () => {
  assert.match(workflow, /docker compose -f infra\/schools\/docker-compose\.yml config/);
  assert.match(workflow, /node --test apps\/web\/test\/schools-compose-contract\.test\.mjs/);
  assert.match(workflow, /tenant_links_tenant_provider_customer_key/);
  assert.match(workflow, /ci-placeholder-not-a-production-secret/);
});

test("o guia central registra a decisão sem afirmar implantação", () => {
  assert.match(centralGuide, /### Escolas \(decisão de 26\/11\/2026\)/);
  assert.match(centralGuide, /infra\/schools\/docker-compose\.yml/);
  assert.match(centralGuide, /infra\/schools\/DOKPLOY\.md/);
  assert.match(centralGuide, /não prova deploy/);
});
