import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const read = (file) => fs.readFileSync(new URL(file, import.meta.url), "utf8");
const page = read("../src/app/page.tsx");
const admin = read("../src/app/platform-admin-workspace.tsx");
const session = read("../src/app/auth-screen.tsx");
const controller = read("../../api/src/auth/plans.controller.ts");
const authController = read("../../api/src/auth/auth.controller.ts");
const entitlements = read("../../api/src/auth/entitlements.ts");

test("administração Véxora escolhe exatamente uma plataforma de pagamento por empresa", () => {
  assert.match(controller, /customers\/:id\/payment-provider/);
  assert.match(controller, /canonicalPaymentProvider\(/);
  assert.match(controller, /withPaymentProvider\(/);
  assert.match(controller, /preservePaymentProvider\(/);
  assert.match(entitlements, /paymentProvider: "ASAAS"/);
  assert.match(entitlements, /paymentProviderOf\(raw: unknown\): PaymentProvider/);
  assert.match(admin, /Plataforma de pagamento/);
  assert.match(admin, /data-testid="payment-platform-select"/);
  assert.match(admin, /Asaas \(Recomendado — mais completo\)/);
  assert.ok(admin.indexOf('id: "ASAAS"') < admin.indexOf('id: "STRIPE"'));
  assert.ok(admin.indexOf('id: "STRIPE"') < admin.indexOf('id: "INFINITEPAY"'));
  assert.match(admin, /As formas de pagamento disponíveis ao cliente não são alteradas aqui/);
});

test("menu mostra somente a plataforma escolhida, mesmo para admin da plataforma", () => {
  assert.match(session, /paymentProvider\?: "ASAAS" \| "STRIPE" \| "INFINITEPAY"/);
  assert.match(authController, /paymentProvider:paymentProviderOf\(tenant\?\.entitlements\)/);
  assert.match(page, /const selectedPaymentProvider = session\?\.paymentProvider \|\| "ASAAS"/);
  assert.match(page, /const providerVisible = \(label: string\)/);
  assert.match(page, /providerVisible\(item\.label\)/);
  assert.match(page, /moduleVisible\(child\.label\)&&providerVisible\(child\.label\)/);
  assert.match(page, /!moduleVisible\(active\)\|\|!providerVisible\(active\)/);
  assert.match(page, /if\(required==="SCHOOL"\)return session\?\.tenant\.kind!=="PLATFORM"/);
});
