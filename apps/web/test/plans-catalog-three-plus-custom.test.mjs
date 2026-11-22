import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const webRoot = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const apiRoot = path.resolve(webRoot, "../api");
const read = (root, file) => fs.readFileSync(path.join(root, file), "utf8");

const migration = read(apiRoot, "prisma/migrations/20261122010000_three_plans_and_custom/migration.sql");
const billing = read(apiRoot, "src/operations/billing.controller.ts");
const catalog = read(webRoot, "src/app/client-plans-workspace.tsx");

test("o catálogo público tem três planos e uma opção personalizada", () => {
  for (const code of ["essencial", "crescimento", "completa"]) {
    assert.match(migration, new RegExp(`'${code}'`));
  }
  assert.match(migration, /'personalizado'/);
  assert.match(migration, /WHERE code NOT IN \('essencial', 'crescimento', 'completa', 'personalizado'\)/);
  assert.doesNotMatch(migration, /'parceiro',\s*'PLAN'/);
});

test("o personalizado não gera cobrança automática", () => {
  assert.match(billing, /if \(code === "personalizado"\) throw new BadRequestException/);
  assert.match(catalog, /const CUSTOM_PLAN_CODE = "personalizado";/);
  assert.match(catalog, /Sob consulta/);
  assert.match(catalog, /contratado com a Véxora/);
  assert.match(catalog, /p\.code === CUSTOM_PLAN_CODE \? \(\s*<a className=\{primaryTw\}/);
  assert.match(catalog, /\) : currentPlanCode === p\.code \? \(/);
});

test("os contratos de ativação e entitlements permanecem", () => {
  assert.match(catalog, /onClick=\{\(\) => void activate\(p\.code, p\.name\)\}/);
  assert.match(catalog, /planCode: code/);
  assert.match(read(apiRoot, "src/auth/plans.controller.ts"), /isPublic !== false/);
});
