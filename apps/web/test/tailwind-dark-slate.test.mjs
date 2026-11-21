import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const read = (file) => fs.readFileSync(path.join(rootDir, file), "utf8");
const legacy = read("src/app/vexora.css");

/** Regras realmente escuras: ignora seletores `:not([data-theme=dark])`, que são o tema claro. */
const darkRules = (legacy.match(/[^}]*\}/g) ?? [])
  .map((rule) => rule.trim())
  .filter((rule) => /(?:^|[\s,])(?::root\[data-theme=dark\]|\.topbar\.topbar-dark)/.test(rule))
  .filter((rule) => !/:not\(\[data-theme=dark\]\)/.test(rule));
const darkCss = darkRules.join("\n");
const darkTheme = [...legacy.matchAll(/:root\[data-theme=dark\]\s*\{[\s\S]*?\n\}/g)]
  .map((match) => match[0])
  .join("\n");

/** Tons do antigo blue-dark/navy e azuis de realce que o dark real da TW não usa. */
const blueDarkTones = [
  "#04122A", "#0B1114", "#0B1F3A", "#0D2C52", "#101730", "#141B33",
  "#141D38", "#18203C", "#18233B", "#164E8A", "#1B2A5C", "#1D4ED8",
  "#22304F", "#22386B", "#232C47", "#22D3EE", "#2B3A5C", "#33405F",
  "#38BDF8", "#5FB2FF", "#60A5FA", "#6EB2FF", "#7DD3FC", "#8AE3FD",
  "#8FBCFF", "#9CD0FF", "#A9BFE3", "#BFE3FF", "#C2D3EE", "#CBD6F2",
  "#CDD6F2", "#E7EEFF", "#F5F8F6", "#FAFCFF",
];

test("o dark não mantém realces fixos de blue-dark", () => {
  for (const tone of blueDarkTones) {
    assert.doesNotMatch(darkCss, new RegExp(tone, "i"), `o dark ainda usa ${tone}`);
  }
});

test("o editor e o preview de site não repintam com blue-dark", () => {
  for (const tone of ["#0B1020", "#DDE6FF"]) {
    assert.doesNotMatch(legacy, new RegExp(tone, "i"), `ainda usa ${tone}`);
  }
  for (const tone of ["#0F172A", "#E2E8F0"]) {
    assert.match(legacy, new RegExp(tone, "i"), `falta o slate ${tone}`);
  }
});

test("as superfícies escuras e de conversa usam tokens slate", () => {
  for (const token of [
    "--bg:#0F172A",
    "--s1:#1E293B",
    "--s2:#334155",
    "--tx:#F8FAFC",
    "--ln:#334155",
    "--sb-bg:#020617",
    "--msg-tx:var(--tx)",
    "--bubble-in:var(--s2)",
    "--bubble-in-border:var(--ln2)",
    "--bubble-out:color-mix(in srgb,var(--primary) 22%,var(--s2))",
    "--chat-bg-base:var(--bg)",
    "--composer-ic:var(--tx2)",
  ]) {
    assert.ok(darkTheme.includes(token), `o dark deve mapear ${token}`);
  }
});

test("topbar escura, hero financeiro e marca não repintam a superfície", () => {
  const topbar = darkRules.find((rule) => /\.topbar\.topbar-dark\{/.test(rule)) ?? "";
  assert.match(topbar, /background:linear-gradient\(100deg,var\(--s2\),var\(--s1\) 52%,var\(--bg\)\)/);
  assert.doesNotMatch(topbar, /#0B1114|#0F1619/);

  const finance = darkRules.find((rule) => rule.includes(" .finance-hero{")) ?? "";
  assert.match(finance, /color-mix\(in srgb,var\(--primary\) 12%,var\(--s1\)\)/);
  assert.doesNotMatch(finance, /42%/);

  const brand = darkRules.find((rule) => rule.includes(" .brand-mark{")) ?? "";
  assert.match(brand, /var\(--vx-core-brand-mark\)|var\(--primary\)/);

  const sidebarBrand = darkRules.find((rule) => rule.includes(" .sidebar .brand-mark{")) ?? "";
  assert.match(sidebarBrand, /var\(--vx-core-brand-mark\)|var\(--primary\)/);
});
