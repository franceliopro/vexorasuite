import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const read = (file) => fs.readFileSync(new URL(`../${file}`, import.meta.url), "utf8");
const compose = read("../../infra/documenso/compose.yml");
const guide = read("../../infra/documenso/DOKPLOY.md");
const rootCompose = read("../../docker-compose.yml");
const centralGuide = read("../../docs/deployment-dokploy.md");

test("a stack Documenso usa a imagem oficial sem fork nem licença paga", () => {
  assert.match(compose, /name: vexora-documenso/);
  assert.match(compose, /image: \$\{DOCUMENSO_IMAGE:-documenso\/documenso:latest\}/);
  assert.doesNotMatch(compose, /\bbuild:/);
  assert.doesNotMatch(compose, /LICENSE_KEY/);
});

test("todos os segredos vêm do cofre por interpolação obrigatória", () => {
  for (const name of [
    "DOCUMENSO_POSTGRES_PASSWORD",
    "DOCUMENSO_NEXTAUTH_SECRET",
    "DOCUMENSO_ENCRYPTION_KEY",
    "DOCUMENSO_ENCRYPTION_SECONDARY_KEY",
    "DOCUMENSO_SMTP_PASSWORD",
    "DOCUMENSO_SIGNING_PASSPHRASE",
    "DOCUMENSO_CERT_PATH",
  ]) {
    assert.match(compose, new RegExp(`\\$\\{${name}:\\?`), `segredo não obrigatório: ${name}`);
  }
  assert.doesNotMatch(compose, /postgresql:\/\/[^\$]/);
  assert.doesNotMatch(compose, /(?:password|secret|passphrase):\s*[A-Za-z0-9]/i);
  assert.doesNotMatch(guide, /NEXTAUTH_SECRET\s*=\s*["']?[A-Za-z0-9+/]{16,}/);
});

test("banco e volumes são exclusivos e o banco não é publicado", () => {
  assert.match(compose, /image: postgres:15/);
  assert.match(compose, /documenso-pgdata:\/var\/lib\/postgresql\/data/);
  assert.match(compose, /condition: service_healthy/);
  assert.doesNotMatch(compose, /^\s*-\s*"\d+:5432"\s*$/m);
  assert.doesNotMatch(rootCompose, /documenso/i);
});

test("o guia de Dokploy preserva AGPL e não afirma deploy nem assinatura", () => {
  assert.match(guide, /AGPL-3\.0/);
  assert.match(guide, /Não fork, não modificar a imagem/);
  assert.match(guide, /Nunca commitar esse token/);
  assert.match(guide, /\*\*não\*\* prova assinatura concluída/);
  assert.match(guide, /Projeto Dokploy \*\*separado\*\*/);
});

test("o guia central aponta para a stack separada sem afirmar deploy", () => {
  assert.match(centralGuide, /### Documenso \(decisão de 25\/11\/2026\)/);
  assert.match(centralGuide, /infra\/documenso\/compose\.yml/);
  assert.match(centralGuide, /infra\/documenso\/DOKPLOY\.md/);
  assert.match(centralGuide, /AGPL-3\.0/);
  assert.match(centralGuide, /não prova deploy nem funcionamento da integração/);
});
