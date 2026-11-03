import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const root = new URL("../../../", import.meta.url);
const compose = fs.readFileSync(new URL("docker-compose.yml", root), "utf8");
const envExample = fs.readFileSync(new URL(".env.example", root), "utf8");

test("the deployment compose contract is represented in the environment example", () => {
  const referenced = [...compose.matchAll(/\$\{([A-Z][A-Z0-9_]*)(?::-[^}]*)?(?::\?[^}]*)?\}/g)]
    .map((match) => match[1]);
  const documented = new Set(
    [...envExample.matchAll(/^([A-Z][A-Z0-9_]*)=/gm)].map((match) => match[1]),
  );

  for (const name of new Set(referenced)) {
    assert.ok(documented.has(name), `compose variable is missing from .env.example: ${name}`);
  }
});

test("runtime settings are actually wired into the API and WAHA services", () => {
  assert.match(compose, /RATE_LIMIT_ENABLED: \$\{RATE_LIMIT_ENABLED:-true\}/);
  assert.match(compose, /RATE_LIMIT_AUTH_AUX_PER_MIN: \$\{RATE_LIMIT_AUTH_AUX_PER_MIN:-60\}/);
  assert.match(compose, /RATE_LIMIT_UPLOAD_PER_MIN: \$\{RATE_LIMIT_UPLOAD_PER_MIN:-60\}/);
  assert.match(compose, /image: \$\{WAHA_IMAGE:-devlikeapro\/waha:gows\}/);
  assert.match(compose, /WHATSAPP_DEFAULT_ENGINE: \$\{WHATSAPP_DEFAULT_ENGINE:-GOWS\}/);
});
