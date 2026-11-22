import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const appDir = new URL("../src/app/", import.meta.url);
const read = (name) => fs.readFileSync(new URL(name, appDir), "utf8");

// Grupo C: um fieldset por arquivo, sempre com margem superior mt-5.
const expected = {
  "personal-alarms.tsx": { fieldsets: 1, legends: 1 },
  "documents-workspace.tsx": { fieldsets: 1, legends: 1 },
  "channels-integrations.tsx": { fieldsets: 1, legends: 1 },
  "module-choices.tsx": { fieldsets: 1, legends: 1 },
};

function twConstants(source) {
  const found = new Map();
  for (const match of source.matchAll(/const\s+([A-Za-z_$][\w$]*)\s*=\s*"([^"]*)"/g)) {
    found.set(match[1], match[2]);
  }
  return found;
}

// Retorna o conteudo da tag <fieldset ...> sem confundir '=>' com o '>' final.
function fieldsetAttributes(source, start) {
  const tag = "<fieldset";
  let depth = 0;
  let quote = null;
  for (let i = start + tag.length; i < source.length; i += 1) {
    const ch = source[i];
    if (quote) {
      if (ch === quote && source[i - 1] !== "\\") quote = null;
      continue;
    }
    if (ch === '"' || ch === "'" || ch === "`") {
      quote = ch;
      continue;
    }
    if (ch === "{") depth += 1;
    else if (ch === "}") depth -= 1;
    else if (ch === ">" && depth === 0 && source[i - 1] !== "=") {
      return source.slice(start + tag.length, i);
    }
  }
  return null;
}

function fieldsetClasses(attributes, constants, file) {
  const className = attributes.match(/\bclassName\s*=\s*(?:"([^"]*)"|\{([\s\S]*?)\})/);
  assert.ok(className, `${file}: fieldset sem className`);
  if (className[1] !== undefined) return className[1];

  const expression = className[2].trim();
  const reference = expression.match(/^([A-Za-z_$][\w$]*)$/);
  if (reference) {
    assert.ok(constants.has(reference[1]), `${file}: constante TW ${reference[1]} nao encontrada`);
    return constants.get(reference[1]);
  }
  const template = expression.match(/^`([\s\S]*)`$/);
  if (template) {
    return template[1].replace(/\$\{([A-Za-z_$][\w$]*)\}/g, (_, name) => {
      assert.ok(constants.has(name), `${file}: constante TW ${name} nao encontrada`);
      return constants.get(name);
    });
  }
  assert.fail(`${file}: className do fieldset nao resolvida (${expression})`);
}

test("todo fieldset do grupo C possui mt-5 na classe TW correspondente", () => {
  for (const [file, counts] of Object.entries(expected)) {
    const source = read(file);
    const constants = twConstants(source);
    const starts = [...source.matchAll(/<fieldset\b/g)].map((match) => match.index);

    assert.equal(starts.length, counts.fieldsets, `${file}: quantidade de fieldsets mudou`);
    assert.equal(
      (source.match(/<legend\b/g) || []).length,
      counts.legends,
      `${file}: quantidade de legends mudou`,
    );

    for (const start of starts) {
      const attributes = fieldsetAttributes(source, start);
      assert.ok(attributes, `${file}: tag fieldset nao fechada`);
      const classes = fieldsetClasses(attributes, constants, file);
      const tokens = classes.trim().split(/\s+/).filter(Boolean);

      assert.ok(
        tokens.includes("mt-5"),
        `${file}: fieldset sem mt-5 (${classes})`,
      );
      assert.deepEqual(
        tokens.filter((token) => /^mt-/.test(token) && token !== "mt-5"),
        [],
        `${file}: fieldset com margem superior duplicada (${classes})`,
      );
      assert.ok(path.basename(file).endsWith(".tsx"), `${file}: arquivo inesperado`);
    }
  }
});
