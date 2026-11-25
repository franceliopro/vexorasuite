import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const testDir = path.dirname(fileURLToPath(import.meta.url));
const shellDir = path.resolve(testDir, "..");
const tauriDir = path.join(shellDir, "src-tauri");
const repoRoot = path.resolve(shellDir, "..", "..");

const readText = (filePath) => readFileSync(filePath, "utf8");
const readJson = (filePath) => JSON.parse(readText(filePath));

const config = readJson(path.join(tauriDir, "tauri.conf.json"));
const capability = readJson(
  path.join(tauriDir, "capabilities", "main-local.json")
);
const shellPackage = readJson(path.join(shellDir, "package.json"));
const rootPackage = readJson(path.join(repoRoot, "package.json"));

test("Tauri config is v2 and keeps the web app canonical", () => {
  assert.equal(config.$schema, "https://schema.tauri.app/config/2");
  assert.match(config.identifier, /^[a-z0-9-]+(\.[a-z0-9-]+)+$/);
  assert.equal(config.build.frontendDist, "https://app.vexorasuite.com.br");
  assert.match(config.build.devUrl, /^http:\/\/localhost:\d+$/);
  assert.match(config.build.beforeDevCommand, /@vexorasuite\/web/);
  assert.match(config.build.beforeBuildCommand, /@vexorasuite\/web/);
  assert.equal(config.app.windows[0].label, "main");
  assert.equal(config.app.withGlobalTauri, false);
  assert.equal(config.plugins, undefined);
});

test("capability is local-only and grants no remote IPC", () => {
  assert.equal(capability.identifier, "main-local");
  assert.equal(capability.local, true);
  assert.equal(capability.remote, undefined);
  assert.deepEqual(capability.windows, ["main"]);
  assert.deepEqual(capability.permissions, ["core:default"]);
  assert.ok(config.app.security.capabilities.includes(capability.identifier));
  assert.ok(
    capability.permissions.every(
      (permission) =>
        typeof permission === "string" && permission.startsWith("core:")
    )
  );
});

test("mobile platform overrides are present without signing claims", () => {
  const android = readJson(path.join(tauriDir, "tauri.android.conf.json"));
  const ios = readJson(path.join(tauriDir, "tauri.ios.conf.json"));

  assert.equal(android.$schema, "https://schema.tauri.app/config/2");
  assert.equal(android.bundle.android.minSdkVersion, 24);
  assert.equal(ios.$schema, "https://schema.tauri.app/config/2");
  assert.equal(ios.bundle.iOS.minimumSystemVersion, "15.0");
  assert.equal(ios.bundle.iOS.developmentTeam, undefined);
});

test("Rust shell is Tauri v2 with mobile library targets and no commands", () => {
  const cargo = readText(path.join(tauriDir, "Cargo.toml"));
  const lib = readText(path.join(tauriDir, "src", "lib.rs"));
  const main = readText(path.join(tauriDir, "src", "main.rs"));

  assert.match(cargo, /tauri-build\s*=\s*\{\s*version\s*=\s*"2"/);
  assert.match(cargo, /^tauri\s*=\s*\{\s*version\s*=\s*"2"/m);
  assert.match(cargo, /crate-type\s*=\s*\[[^\]]*"staticlib"[^\]]*"cdylib"/);
  assert.match(lib, /cfg_attr\(mobile, tauri::mobile_entry_point\)/);
  assert.doesNotMatch(lib, /greet|invoke_handler/);
  assert.match(main, /vexorasuite_shell_lib::run\(\)/);
});

test("configured icons exist and are valid PNG files", () => {
  for (const icon of config.bundle.icon) {
    const iconPath = path.join(tauriDir, icon);
    assert.ok(existsSync(iconPath), `Missing icon ${icon}`);

    const png = readFileSync(iconPath);
    assert.equal(
      png.subarray(0, 8).toString("hex"),
      "89504e470d0a1a0a",
      `Invalid PNG signature in ${icon}`
    );

    const width = png.readUInt32BE(16);
    const height = png.readUInt32BE(20);
    const match = path.basename(icon).match(/^(\d+)x(\d+)\.png$/);
    if (match) {
      assert.equal(width, Number(match[1]));
      assert.equal(height, Number(match[2]));
    } else {
      assert.equal(icon, "icons/icon.png");
      assert.equal(width, height);
      assert.ok(width >= 128);
    }
  }
});

test("npm scripts and CI keep validation repeatable", () => {
  for (const script of [
    "shell:check",
    "shell:dev",
    "shell:build:desktop",
    "shell:build:android",
    "shell:build:ios",
  ]) {
    assert.ok(rootPackage.scripts[script], `Missing root script ${script}`);
  }

  for (const script of [
    "check:config",
    "lint",
    "test",
    "dev:desktop",
    "build:desktop",
    "build:android",
    "build:ios",
  ]) {
    assert.ok(shellPackage.scripts[script], `Missing shell script ${script}`);
  }

  assert.match(shellPackage.scripts["build:desktop"], /tauri build/);
  assert.match(shellPackage.scripts["build:android"], /tauri android build/);
  assert.match(shellPackage.scripts["build:ios"], /tauri ios build/);
  assert.doesNotMatch(shellPackage.scripts.build, /tauri build/);

  const workflow = readText(
    path.join(repoRoot, ".github", "workflows", "tauri-shell.yml")
  );
  for (const token of [
    "pnpm --filter @vexorasuite/shell test",
    "tauri info",
    "cargo check",
    "tauri build",
    "libwebkit2gtk-4.1-dev",
    "Android and iOS are configured but not built",
    "ubuntu-latest",
  ]) {
    assert.ok(workflow.includes(token), `Missing CI token ${token}`);
  }
});

test("docs distinguish configured from published", () => {
  const doc = readText(path.join(repoRoot, "docs", "tauri-v2-shell.md"));
  const register = readText(
    path.join(repoRoot, "docs", "implementation-register.md")
  );

  assert.ok(doc.includes("Nenhum binário foi publicado."));
  assert.ok(doc.includes("apps/web"));
  assert.ok(register.includes("shell Tauri v2 (configurado, não publicado)"));
});

test("source and config files contain no secret placeholders", () => {
  const files = [
    path.join(tauriDir, "Cargo.toml"),
    path.join(tauriDir, "build.rs"),
    path.join(tauriDir, "tauri.conf.json"),
    path.join(tauriDir, "tauri.android.conf.json"),
    path.join(tauriDir, "tauri.ios.conf.json"),
    path.join(tauriDir, "capabilities", "main-local.json"),
    path.join(tauriDir, "src", "lib.rs"),
    path.join(tauriDir, "src", "main.rs"),
    path.join(shellDir, "package.json"),
  ];

  for (const file of files) {
    assert.doesNotMatch(
      readText(file),
      /API_KEY|SECRET|PASSWORD|PRIVATE_KEY|TEAM_ID/i,
      `Possible secret placeholder in ${file}`
    );
  }
});
