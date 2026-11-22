import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const read = (relative) => readFileSync(resolve(root, relative), "utf8");
const chatbot = read("apps/web/src/app/chatbot-workspace.tsx");
const overview = read("apps/web/src/app/overview-intelligence.tsx");
const config = read("apps/web/tailwind.config.ts");

function classStrings(source) {
  return [
    ...source.matchAll(/\bconst\s+[A-Za-z_$][\w$]*\s*=\s*"([^"]*)"/g),
    ...source.matchAll(/className="([^"]*)"/g),
    ...source.matchAll(/className=\{`([^`]*)`\}/g),
  ].map((match) => match[1]);
}

const banned = [
  "ov-",
  "vx-",
  "ib-",
  "rw-",
  "auth-",
  "alarm-",
  "platform-admin-",
  "vx-rich-",
  "vx-post-",
  "vx-gallery-",
  "design-approval-",
  "content-card",
  "settings-card",
  "primary-button",
  "secondary-button",
  "text-button",
  "icon-button",
  "vx-spin",
];

test("chatbot workspace nao usa tokens legados ou valores arbitrrios em classes", () => {
  const classes = classStrings(chatbot);
  assert.ok(classes.length > 100, "amostra de classes insuficiente");
  for (const value of classes) {
    const normalized = value
      .replace(/\bov-laptop:/g, "")
      .replace(/\bib-narrow:/g, "")
      .replace(/\brw-laptop:/g, "");
    for (const token of banned) {
      assert.equal(
        normalized.includes(token),
        false,
        `token legado '${token}' ainda presente em classe: ${value}`,
      );
    }
    const css = value.replace(/\$\{[^}]*\}/g, "");
    assert.equal(css.includes("["), false, `valor arbitrario em classe: ${value}`);
    assert.equal(/#[0-9a-fA-F]{3,8}/.test(css), false, `hex em classe: ${value}`);
    assert.equal(css.includes("!important"), false);
    assert.equal(css.includes("@apply"), false);
    assert.equal(css.includes("@tailwind base"), false);
    assert.equal(css.includes("color-mix("), false);
    assert.equal(css.includes("ov-tablet:"), false);
  }
  assert.match(chatbot, /#[0-9a-fA-F]{3,8}/, "hex de dados deve permanecer so em valores/HTML");
  assert.match(chatbot, /ov-laptop:/);
});

test("chatbot workspace preserva contratos funcionais e ids de integracao", () => {
  assert.match(chatbot, /id="chatbot-ai-title"/);
  assert.match(chatbot, /id="chatbot-ai-request-input"/);
  assert.match(chatbot, /aria-labelledby="chatbot-ai-title"/);
  assert.match(chatbot, /htmlFor="chatbot-ai-request-input"/);
  assert.match(chatbot, /id="vx-wire-gradient"/);
  assert.match(chatbot, /url\(#vx-wire-gradient\)/);
  assert.match(chatbot, /id="vx-wire-arrow"/);
  assert.match(chatbot, /url\(#vx-wire-arrow\)/);
  assert.match(chatbot, /"etapa-"\+Date\.now\(\)/);
  assert.match(chatbot, /data-flow-node-head/);
  assert.match(chatbot, /data-flow-input-port/);
  assert.match(chatbot, /data-flow-outputs/);
  assert.match(chatbot, /data-flow-public-page/);
  assert.match(chatbot, /chatbot-delete-block/);
  assert.match(chatbot, /--inspector-width/);
  assert.doesNotMatch(chatbot, /--vx-flow-inspector-width/);
  assert.match(chatbot, /animate-dialog-scrim/);
  assert.match(chatbot, /animate-dialog-in/);
  assert.doesNotMatch(chatbot, /right-\[-8px\]/);
});

test("visao geral preserva contratos funcionais e nao recebe classes legadas decorativas", () => {
  assert.match(overview, /data-testid="ov-hero"/);
  for (const value of classStrings(overview)) {
    assert.equal(
      /(^|\s)ov-(?!laptop:)/.test(value),
      false,
      `ov-* decorativo em classe: ${value}`,
    );
  }
  assert.match(overview, /ov-laptop:/);
  assert.match(overview, /id="vxHourlyFill"/);
  assert.match(overview, /url\(#vxHourlyFill\)/);
  assert.match(overview, /id="vxHourlyStroke"/);
  assert.match(overview, /url\(#vxHourlyStroke\)/);
});

test("configuracao mantem keyframes legados para outros arquivos e expoe aliases neutros", () => {
  assert.match(config, /"vx-scrim-in"/);
  assert.match(config, /"vx-in"/);
  assert.match(config, /"dialog-scrim":\s*"vx-scrim-in/);
  assert.match(config, /"dialog-in":\s*"vx-in/);
  assert.match(config, /var\(--inspector-width, 360px\)/);
  assert.doesNotMatch(config, /--vx-flow-inspector-width/);
});
