#!/usr/bin/env node
/**
 * Boots the compiled API and waits for Nest to report that it started.
 *
 * Every other check in this repository exercises classes or scripts; none of them asks the
 * application to actually start. A missing provider, an unresolved module graph or a lifecycle hook
 * that throws only appear here, when the container tries to come up.
 *
 * Requires DATABASE_URL pointing to a migrated database (the CI job applies migrations before this).
 *
 *   node scripts/boot-check.cjs
 *
 * Exit codes: 0 started · 1 did not start.
 */
const { spawn } = require("node:child_process");
const path = require("node:path");

const MAIN = path.resolve(__dirname, "..", "dist", "main.js");
const TIMEOUT_MS = Number(process.env.BOOT_CHECK_TIMEOUT_MS || 40000);
const STARTED = /Nest application successfully started/i;

if (!process.env.DATABASE_URL) {
  console.error("boot-check: DATABASE_URL não definida; a API não consegue iniciar.");
  process.exit(1);
}

const child = spawn(process.execPath, [MAIN], {
  cwd: path.resolve(__dirname, ".."),
  // main.ts reads API_PORT; PORT is set too so a future switch cannot silently use 3001 and clash.
  env: {
    ...process.env,
    PORT: process.env.BOOT_CHECK_PORT || "3997",
    API_PORT: process.env.BOOT_CHECK_PORT || "3997",
    NODE_ENV: "production",
  },
  stdio: ["ignore", "pipe", "pipe"],
});

let output = "";
let finished = false;

const finish = (code, message) => {
  if (finished) return;
  finished = true;
  clearTimeout(timer);
  if (code === 0) {
    console.log(`boot-check: ${message}`);
    // The lines that prove the integrations are wired, not just that the process is alive.
    for (const line of output.split("\n").filter((item) => /MailService|RateLimitService/.test(item))) {
      console.log(`  ${line.trim()}`);
    }
  } else {
    console.error(`boot-check: ${message}`);
    console.error("--- saída da API ---");
    console.error(output.trim().split("\n").slice(-40).join("\n"));
  }
  child.kill("SIGKILL");
  process.exit(code);
};

const timer = setTimeout(() => finish(1, `a API não iniciou em ${TIMEOUT_MS}ms.`), TIMEOUT_MS);

const collect = (chunk) => {
  output += String(chunk);
  if (STARTED.test(output)) finish(0, "API iniciou (Nest application successfully started).");
};
child.stdout.on("data", collect);
child.stderr.on("data", collect);

child.on("error", (error) => finish(1, `falha ao executar ${MAIN}: ${error.message}`));
child.on("exit", (code, signal) => {
  if (finished) return;
  finish(1, `a API encerrou antes de iniciar (código ${code ?? signal}).`);
});
