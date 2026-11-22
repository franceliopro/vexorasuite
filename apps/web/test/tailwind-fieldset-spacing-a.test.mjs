import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const FILES = [
  "ai-agents-workspace.tsx",
  "chatbot-workspace.tsx",
  "manual-content-workspace.tsx",
  "team-workspace.tsx",
];

const webRoot = [
  path.resolve(process.cwd(), "apps/web"),
  path.resolve(process.cwd()),
].find((candidate) =>
  FILES.every((file) =>
    fs.existsSync(path.join(candidate, "src/app", file)),
  ),
);

assert.ok(webRoot, "nao localizei apps/web/src/app a partir do diretorio atual");

function lineOf(source, index) {
  return source.slice(0, index).split("\n").length;
}

function fieldsetTags(source) {
  const tags = [];
  const pattern = /<fieldset\b/g;
  let match;
  while ((match = pattern.exec(source)) !== null) {
    let cursor = match.index;
    let quote = null;
    let braces = 0;
    for (; cursor < source.length; cursor += 1) {
      const char = source[cursor];
      if (quote) {
        if (char === "\\") {
          cursor += 1;
          continue;
        }
        if (char === quote) quote = null;
        continue;
      }
      if (char === '"' || char === "'" || char === "`") {
        quote = char;
        continue;
      }
      if (char === "{") {
        braces += 1;
        continue;
      }
      if (char === "}") {
        braces -= 1;
        continue;
      }
      if (char === ">" && braces === 0) break;
    }
    tags.push({
      tag: source.slice(match.index, cursor + 1),
      line: lineOf(source, match.index),
    });
  }
  return tags;
}

function constantLiterals(source) {
  const constants = new Map();
  const pattern =
    /\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|`(?:[^`\\]|\\.)*`)\s*;/g;
  let match;
  while ((match = pattern.exec(source)) !== null) {
    constants.set(match[1], match[2]);
  }
  return constants;
}

function literalTokens(literal) {
  const quote = literal[0];
  const value =
    quote === '"' || quote === "'" || quote === "`"
      ? literal.slice(1, -1)
      : literal;
  return value.split(/\s+/).filter(Boolean);
}

function topLevelIndex(value, char) {
  let quote = null;
  let depth = 0;
  for (let i = 0; i < value.length; i += 1) {
    const current = value[i];
    if (quote) {
      if (current === "\\") {
        i += 1;
        continue;
      }
      if (current === quote) quote = null;
      continue;
    }
    if (current === '"' || current === "'" || current === "`") {
      quote = current;
      continue;
    }
    if (current === "{" || current === "(" || current === "[") depth += 1;
    if (current === "}" || current === ")" || current === "]") depth -= 1;
    if (current === char && depth === 0) return i;
  }
  return -1;
}

function resolve(expr, constants, seen = new Set()) {
  const value = expr.trim();
  if (!value) return null;

  if (/^(?:"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')$/.test(value)) {
    return literalTokens(value);
  }

  if (/^[A-Za-z_$][\w$]*$/.test(value)) {
    if (seen.has(value)) return null;
    const definition = constants.get(value);
    if (!definition) return null;
    return resolve(definition, constants, new Set([...seen, value]));
  }

  if (value.startsWith("`") && value.endsWith("`")) {
    const body = value.slice(1, -1);
    const tokens = [];
    const interpolation = /\$\{([^}]*)\}/g;
    let last = 0;
    let match;
    while ((match = interpolation.exec(body)) !== null) {
      tokens.push(...literalTokens(body.slice(last, match.index)));
      const nested = resolve(match[1], constants, seen);
      if (!nested) return null;
      tokens.push(...nested);
      last = interpolation.lastIndex;
    }
    tokens.push(...literalTokens(body.slice(last)));
    return tokens;
  }

  const question = topLevelIndex(value, "?");
  if (question >= 0) {
    const colon = topLevelIndex(value.slice(question + 1), ":");
    if (colon < 0) return null;
    const consequent = resolve(value.slice(0, question), constants, seen);
    const alternate = resolve(
      value.slice(question + 1 + colon + 1),
      constants,
      seen,
    );
    if (!consequent || !alternate) return null;
    return [...consequent, ...alternate];
  }

  return null;
}

function classNameExpression(tag) {
  const match = tag.match(/\bclassName\s*=\s*/);
  if (!match) return null;
  const rest = tag.slice(match.index + match[0].length);
  if (!rest) return null;

  if (rest[0] === '"' || rest[0] === "'") {
    const quote = rest[0];
    const end = rest.indexOf(quote, 1);
    return end < 0 ? null : rest.slice(0, end + 1);
  }

  if (rest[0] === "{") {
    let quote = null;
    let depth = 0;
    for (let i = 0; i < rest.length; i += 1) {
      const char = rest[i];
      if (quote) {
        if (char === "\\") {
          i += 1;
          continue;
        }
        if (char === quote) quote = null;
        continue;
      }
      if (char === '"' || char === "'" || char === "`") {
        quote = char;
        continue;
      }
      if (char === "{") depth += 1;
      if (char === "}") {
        depth -= 1;
        if (depth === 0) return rest.slice(1, i).trim();
      }
    }
  }

  return null;
}

for (const file of FILES) {
  test(`${file}: todo fieldset possui mt-3 na classe correspondente`, () => {
    const source = fs.readFileSync(path.join(webRoot, "src/app", file), "utf8");
    const constants = constantLiterals(source);
    const tags = fieldsetTags(source);
    assert.ok(tags.length > 0, `${file}: nenhum fieldset encontrado`);

    for (const { tag, line } of tags) {
      const expression = classNameExpression(tag);
      assert.ok(expression, `${file}:${line} fieldset sem className: ${tag.slice(0, 100)}`);
      const tokens = resolve(expression, constants);
      assert.ok(tokens, `${file}:${line} className nao resolvida: ${expression}`);
      assert.ok(
        tokens.includes("mt-3"),
        `${file}:${line} fieldset sem mt-3: ${tokens.join(" ")}`,
      );
      const conflicting = tokens.filter(
        (token) => /^(?:m|mt|my)-/.test(token) && token !== "mt-3",
      );
      assert.deepEqual(
        conflicting,
        [],
        `${file}:${line} margem duplicada/conflitante no fieldset: ${conflicting.join(" ")}`,
      );
    }
  });
}
