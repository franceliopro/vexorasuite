import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const webRoot = new URL("../src/app/", import.meta.url);
const apiRoot = new URL("../../api/src/", import.meta.url);
const read = (root, file) => readFileSync(new URL(file, root), "utf8");

const stripeProxy = read(webRoot, "api/webhooks/stripe/[tenantId]/route.ts");
const infiniteProxy = read(webRoot, "api/webhooks/infinitepay/[tenantId]/route.ts");
const ui = read(webRoot, "payment-providers-settings.tsx");
const modulePolicy = read(apiRoot, "auth/module-policy.ts");
const status = readFileSync(new URL("../../../docs/implementation-status.md", import.meta.url), "utf8");

test("proxy do Stripe preserva corpo cru e assinatura", () => {
  assert.match(stripeProxy, /stripe-signature/);
  assert.match(stripeProxy, /await request\.arrayBuffer\(\)/);
  assert.doesNotMatch(stripeProxy, /request\.json\(\)/);
  assert.match(stripeProxy, /export const runtime = "nodejs"/);
});

test("proxy da InfinitePay encaminha o aviso sem inventar assinatura", () => {
  assert.match(infiniteProxy, /await request\.arrayBuffer\(\)/);
  assert.doesNotMatch(infiniteProxy, /stripe-signature/);
  assert.match(infiniteProxy, /ocorre no payment_check/);
});

test("UI expõe as duas integrações sem afirmar pagamento confirmado", () => {
  assert.match(ui, /\/api\/backend\/integrations\/stripe/);
  assert.match(ui, /\/api\/backend\/integrations\/infinitepay/);
  assert.match(ui, /Sem sandbox e sem recorrência pela API/);
  assert.match(ui, /A confirmação exige consulta ao payment_check/);
});

test("rotas de integração financeira caem no módulo FINANCE", () => {
  assert.ok(modulePolicy.includes("integrations\\/(?:asaas|stripe|infinitepay)"));
});

test("documentação canônica registra os adaptadores implantados", () => {
  const line = status.split("\n").find((row) => row.startsWith("| Stripe e InfinitePay"));
  assert.ok(line);
  assert.match(line, /\[~\]/);
  assert.doesNotMatch(line, /adaptadores ainda não implementados/);
});
