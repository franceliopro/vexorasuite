import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const layout = fs.readFileSync(new URL("../src/app/layout.tsx", import.meta.url), "utf8");
const manifest = fs.readFileSync(new URL("../src/app/manifest.ts", import.meta.url), "utf8");

test("uses the consolidated design system entrypoint", () => {
  assert.match(layout, /import "\.\/globals\.css";/);
  assert.match(layout, /import "\.\/vexora-design-system\.css";/);
  assert.doesNotMatch(layout, /mobile-app\.css|mobile-scroll\.css|home-presentation\.css|scrollbars\.css/);
});

test("manifest opens Véxora as an installable standalone app", () => {
  assert.match(manifest, /display:'standalone'/);
  assert.match(manifest, /prefer_related_applications:false/);
  assert.match(manifest, /start_url:'\/'/);
  assert.match(manifest, /scope:'\/'/);
});
