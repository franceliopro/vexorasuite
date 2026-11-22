import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

/**
 * Guard de espaçamento do grupo B: todo <fieldset> destes arquivos precisa
 * de mt-3 na classe efetiva (literal ou constante TW), sem margens concorrentes.
 */
const FILES = [
  "src/app/finance-workspace.tsx",
  "src/app/platform-admin-workspace.tsx",
  "src/app/provider-connections.tsx",
  "src/app/greeting-settings.tsx",
];

const read = (file) => fs.readFileSync(new URL(`../${file}`, import.meta.url), "utf8");

/** Constantes TW simples: const nome = "classes..." */
function constantsOf(src) {
  const constants = new Map();
  for (const match of src.matchAll(/\bconst\s+([A-Za-z_$][\w$]*)\s*=\s*"([^"]*)"/g)) {
    constants.set(match[1], match[2]);
  }
  return constants;
}

/** Abre cada tag <fieldset>, respeitando aspas e expressões JSX aninhadas. */
function fieldsetTags(src) {
  const tags = [];
  const opening = /<fieldset\b/g;
  for (let match; (match = opening.exec(src)); ) {
    const index = match.index;
    let end = opening.lastIndex;
    let quote = null;
    let braces = 0;
    for (; end < src.length; end += 1) {
      const ch = src[end];
      if (quote) {
        if (ch === "\\") { end += 1; continue; }
        if (ch === quote) quote = null;
        continue;
      }
      if (ch === '"' || ch === "'" || ch === "`") { quote = ch; continue; }
      if (ch === "{") { braces += 1; continue; }
      if (ch === "}") { braces = Math.max(0, braces - 1); continue; }
      if (ch === ">" && braces === 0) break;
    }
    tags.push({ index, text: src.slice(opening.lastIndex, end) });
    opening.lastIndex = end + 1;
  }
  return tags;
}

/** Valores brutos do atributo className de uma tag (literal ou expressão). */
function classNameExpressions(tag) {
  const values = [];
  const attribute = /\bclassName\s*=/g;
  for (let match; (match = attribute.exec(tag)); ) {
    let cursor = attribute.lastIndex;
    while (/\s/.test(tag[cursor] ?? "")) cursor += 1;
    const delimiter = tag[cursor];
    if (delimiter === '"' || delimiter === "'") {
      const start = cursor + 1;
      cursor = start;
      while (cursor < tag.length && tag[cursor] !== delimiter) cursor += 1;
      values.push(tag.slice(start - 1, cursor + 1));
      attribute.lastIndex = cursor + 1;
    } else if (delimiter === "{") {
      let depth = 0;
      let quote = null;
      const start = cursor + 1;
      for (cursor = start; cursor < tag.length; cursor += 1) {
        const ch = tag[cursor];
        if (quote) {
          if (ch === "\\") { cursor += 1; continue; }
          if (ch === quote) quote = null;
          continue;
        }
        if (ch === '"' || ch === "'" || ch === "`") { quote = ch; continue; }
        if (ch === "{") { depth += 1; continue; }
        if (ch === "}") { if (depth === 0) break; depth -= 1; continue; }
      }
      values.push(tag.slice(start, cursor));
      attribute.lastIndex = cursor + 1;
    }
  }
  return values;
}

/** Resolve a expressão para uma ou mais strings de classes. */
function resolveClasses(expression, constants) {
  const text = expression.trim();
  if (/^(["'])([\s\S]*)\1$/.test(text)) return [text.slice(1, -1)];
  if (/^[A-Za-z_$][\w$]*$/.test(text)) {
    return constants.has(text) ? [constants.get(text)] : [];
  }
  if (/^`[\s\S]*`$/.test(text)) {
    return [text.slice(1, -1).replace(/\$\{([^}]*)\}/g, (_, name) => constants.get(name.trim()) ?? "")];
  }
  const found = [];
  for (const match of text.matchAll(/(["'])([^"']*)\1/g)) found.push(match[2]);
  for (const match of text.matchAll(/\b([A-Za-z_$][\w$]*)\b/g)) {
    if (constants.has(match[1])) found.push(constants.get(match[1]));
  }
  return found;
}

for (const file of FILES) {
  test(`${file}: todo fieldset com mt-3`, () => {
    const src = read(file);
    const constants = constantsOf(src);
    const tags = fieldsetTags(src);
    assert.ok(tags.length > 0, `${file}: nenhum fieldset encontrado`);

    tags.forEach(({ index, text }, position) => {
      const line = src.slice(0, index).split("\n").length;
      const where = `${file}:${line} (fieldset #${position + 1})`;
      const expressions = classNameExpressions(text);
      assert.ok(expressions.length > 0, `${where}: fieldset sem className`);
      const values = expressions.flatMap((expression) => resolveClasses(expression, constants));
      assert.ok(values.length > 0, `${where}: className não resolveu para classes TW`);

      for (const value of values) {
        const tokens = value.split(/\s+/).filter(Boolean);
        assert.ok(tokens.includes("mt-3"), `${where}: falta mt-3 em "${value}"`);
        const margins = tokens.filter((token) => /^(?:m|mx|my|mt|mr|mb|ml)-/.test(token));
        assert.deepEqual(margins, ["mt-3"], `${where}: margens inconsistentes em "${value}"`);
      }
    });
  });
}
