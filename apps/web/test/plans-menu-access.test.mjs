import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const read = (file) => fs.readFileSync(new URL(`../${file}`, import.meta.url), "utf8");
const home = read("src/app/page.tsx");
const platform = read("src/app/platform-admin-workspace.tsx");

test("Planos e preços fica fora do menu do cliente por padrão", () => {
  assert.ok(home.includes("'Planos e preços':'PLANS'"));
  assert.ok(home.includes('const plansMenuVisible = session?.tenant.kind !== "PLATFORM" && (session?.allowedModules || []).includes("PLANS")'));
  assert.ok(home.includes('(target !== "Planos e preços" || plansMenuVisible)'));
  assert.ok(home.includes("plansMenuVisible && canManage ? <ClientPlansWorkspace"));
  assert.ok(!home.includes("'Planos e preços':'SETTINGS'"));
});

test("a administração pode liberar Planos e preços para um ou vários clientes", () => {
  assert.ok(platform.includes('/plans/customers/${customerId}/plans-access'));
  assert.ok(platform.includes('JSON.stringify({ enabled })'));
  assert.ok(platform.includes('strArr(c.entitlements?.modules).includes("PLANS")'));
  assert.ok(platform.includes('data-testid="plans-access-toggle"'));
  assert.ok(platform.includes('aria-label={"Planos e preços para " + c.name}'));
});
