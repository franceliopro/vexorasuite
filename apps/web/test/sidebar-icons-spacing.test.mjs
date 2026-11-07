import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const css = fs.readFileSync(new URL("../src/app/vexora.css", import.meta.url), "utf8");

test("sidebar utility icons stay compact and stack in the collapsed rail", () => {
  assert.match(css, /\.sidebar\.sidebar-compact \.sidebar-utilities\{flex-direction:column/);
  assert.match(css, /\.sidebar-icon\{[^}]*width:36px/);
  assert.match(css, /\.nav-item\{[^}]*min-height:42px/);
});
