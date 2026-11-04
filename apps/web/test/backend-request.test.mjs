import test from "node:test";
import assert from "node:assert/strict";
import { trustedRequestOrigin } from "../src/lib/backend-request.ts";

const originalNodeEnv = process.env.NODE_ENV;

test.afterEach(() => {
  if (originalNodeEnv === undefined) delete process.env.NODE_ENV;
  else process.env.NODE_ENV = originalNodeEnv;
});

function request(origin, headers = {}) {
  return new Request("https://web.internal/api/conversations", {
    method: "POST",
    headers: { origin, ...headers },
  });
}

test("production trusts the configured public URL", () => {
  process.env.NODE_ENV = "production";
  assert.equal(trustedRequestOrigin(request("https://app.vexorasuite.com.br"), "https://app.vexorasuite.com.br"), true);
  assert.equal(trustedRequestOrigin(request("https://evil.example"), "https://app.vexorasuite.com.br"), false);
});

test("production never expands trust from client-controlled forwarded host headers", () => {
  process.env.NODE_ENV = "production";
  const headers = {
    host: "evil.example",
    "x-forwarded-host": "evil.example",
    "x-forwarded-proto": "https",
  };
  assert.equal(trustedRequestOrigin(request("https://evil.example", headers)), false);
});

test("development keeps the local request origin available without forwarded headers", () => {
  process.env.NODE_ENV = "development";
  assert.equal(trustedRequestOrigin(request("https://web.internal")), true);
  assert.equal(
    trustedRequestOrigin(request("https://evil.example", {
      host: "evil.example",
      "x-forwarded-host": "evil.example",
      "x-forwarded-proto": "https",
    })),
    false,
  );
});

test("requests without an Origin preserve the existing compatibility behavior", () => {
  process.env.NODE_ENV = "production";
  const noOrigin = new Request("https://web.internal/api/conversations", { method: "POST" });
  assert.equal(trustedRequestOrigin(noOrigin, "https://app.vexorasuite.com.br"), true);
});
