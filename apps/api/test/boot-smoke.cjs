#!/usr/bin/env node
/**
 * Boot smoke test for the API.
 *
 * Starts the compiled application (dist/main.js) against the CI PostgreSQL and verifies the
 * things that a type-check cannot prove and that already broke production twice:
 *
 *   1. the process boots (no UnknownDependenciesException from a module/guard wiring mistake);
 *   2. AppModule still registers the core controllers (a gutted AppModule served 404 for /api/health
 *      and Docker marked the API unhealthy, taking the whole site down);
 *   3. the Sites modules are registered and protected (unauthenticated calls must be 401, not 404);
 *   4. the database connection and migrations are usable (/api/health reports database ok).
 *
 * Requires `pnpm --filter @vexorasuite/api build` and `prisma migrate deploy` to have run first.
 */
const { spawn } = require("node:child_process");
const net = require("node:net");
const path = require("node:path");

const apiRoot = path.resolve(__dirname, "..");
const entry = path.join(apiRoot, "dist", "main.js");
const READY_TIMEOUT_MS = 90_000;
const BOOT_TEST_SECRET = "ci-only-smoke-secret-with-more-than-thirty-two-bytes";
const HEX_KEY = "0".repeat(64);

const logs = [];
function record(chunk) {
  const text = chunk.toString();
  logs.push(text);
  if (logs.length > 400) logs.shift();
}

function tail(lines = 60) {
  return logs.join("").split(/\r?\n/).slice(-lines).join("\n");
}

function freePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const { port } = server.address();
      server.close(() => resolve(port));
    });
  });
}

async function waitForReady(baseUrl, child) {
  const deadline = Date.now() + READY_TIMEOUT_MS;
  let lastError = "no attempt";
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error(`API exited during boot (code ${child.exitCode}).`);
    try {
      const response = await fetch(`${baseUrl}/api/health/live`, { signal: AbortSignal.timeout(3000) });
      if (response.ok) return;
      lastError = `HTTP ${response.status}`;
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`API did not answer /api/health/live within ${READY_TIMEOUT_MS}ms (last: ${lastError}).`);
}

async function call(baseUrl, method, route, body) {
  const response = await fetch(`${baseUrl}${route}`, {
    method,
    headers: body === undefined ? undefined : { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(15_000),
  });
  const text = await response.text();
  let json;
  try {
    json = text ? JSON.parse(text) : undefined;
  } catch {
    json = undefined;
  }
  return { status: response.status, text, json };
}

const checks = [];
function expect(label, actual, expected) {
  checks.push({ label, actual, expected });
  if (actual !== expected) {
    throw new Error(`FAIL ${label}: expected ${expected}, received ${actual}`);
  }
  console.log(`ok  ${label} (${actual})`);
}

async function main() {
  if (!process.env.DATABASE_URL) {
    if (process.env.CI) throw new Error("DATABASE_URL is required for the boot smoke test in CI.");
    console.log("skip boot smoke test: DATABASE_URL is not set");
    return;
  }

  const port = Number(process.env.BOOT_SMOKE_PORT || (await freePort()));
  const baseUrl = `http://127.0.0.1:${port}`;
  const env = {
    ...process.env,
    NODE_ENV: "test",
    API_PORT: String(port),
    // Keep the boot isolated: no timers, no Redis, no CORS surprises.
    SCHEDULER_MODE: "off",
    RATE_LIMIT_ENABLED: "false",
    CORS_ORIGINS: "http://localhost:3000",
    JWT_ACCESS_SECRET: process.env.JWT_ACCESS_SECRET || BOOT_TEST_SECRET,
    INTEGRATION_ENCRYPTION_KEY: process.env.INTEGRATION_ENCRYPTION_KEY || HEX_KEY,
    GOOGLE_TOKEN_ENCRYPTION_KEY: process.env.GOOGLE_TOKEN_ENCRYPTION_KEY || HEX_KEY,
    WEBHOOK_ENCRYPTION_KEY: process.env.WEBHOOK_ENCRYPTION_KEY || BOOT_TEST_SECRET,
  };

  console.log(`boot smoke: starting ${entry} on port ${port}`);
  const child = spawn(process.execPath, [entry], { cwd: apiRoot, env, stdio: ["ignore", "pipe", "pipe"] });
  child.stdout.on("data", record);
  child.stderr.on("data", record);

  const cleanup = () => {
    if (child.exitCode === null) child.kill("SIGTERM");
  };
  process.on("exit", cleanup);

  try {
    await waitForReady(baseUrl, child);

    const combined = logs.join("");
    for (const signature of ["UnknownDependenciesException", "Nest can't resolve dependencies"]) {
      if (combined.includes(signature)) throw new Error(`Dependency injection failure in boot logs: ${signature}`);
    }

    const routeId = "00000000-0000-4000-8000-000000000000";

    const live = await call(baseUrl, "GET", "/api/health/live");
    expect("GET /api/health/live", live.status, 200);
    if (live.json?.status !== "ok") throw new Error("health/live did not report status ok");

    const health = await call(baseUrl, "GET", "/api/health");
    expect("GET /api/health (database)", health.status, 200);
    if (health.json?.database !== "ok") throw new Error("health did not report database ok (are migrations applied?)");

    const ready = await call(baseUrl, "GET", "/api/health/ready");
    expect("GET /api/health/ready", ready.status, 200);

    // Core controller: proves AuthModule is mounted. 404 would mean the controller is missing;
    // a 4xx from validation/credentials proves the route is alive.
    const login = await call(baseUrl, "POST", "/api/auth/login", {});
    if (login.status === 404) throw new Error("FAIL POST /api/auth/login is not registered (AuthModule missing?)");
    if (login.status < 400 || login.status >= 500) throw new Error(`FAIL POST /api/auth/login without credentials returned ${login.status}`);
    console.log(`ok  POST /api/auth/login without credentials (${login.status})`);

    // Sites: proves both remodeled modules are registered and behind AuthGuard.
    // 404 here would mean the module disappeared from AppModule; 200/500 would mean no guard.
    expect("GET /api/sites without token", (await call(baseUrl, "GET", "/api/sites")).status, 401);
    expect("POST /api/sites without token", (await call(baseUrl, "POST", "/api/sites", { name: "Site de teste" })).status, 401);
    expect("POST /api/sites/:id/deploy without token", (await call(baseUrl, "POST", `/api/sites/${routeId}/deploy`, { files: [] })).status, 401);
    expect("GET /api/sites/:id/domain/verify without token", (await call(baseUrl, "GET", `/api/sites/${routeId}/domain/verify`)).status, 401);
    expect("POST /api/sites/:id/domain without token", (await call(baseUrl, "POST", `/api/sites/${routeId}/domain`, { domain: "example.com" })).status, 401);
    expect("POST /api/sites/:id/document without token", (await call(baseUrl, "POST", `/api/sites/${routeId}/document`, {})).status, 401);
    expect("POST /api/sites/import/url without token", (await call(baseUrl, "POST", "/api/sites/import/url", { url: "https://example.com" })).status, 401);
    expect("POST /api/sites/import/html without token", (await call(baseUrl, "POST", "/api/sites/import/html", { html: "<p>teste</p>" })).status, 401);
    expect("POST /api/sites/import/zip without token", (await call(baseUrl, "POST", "/api/sites/import/zip", { contentBase64: "" })).status, 401);

    // Sanity: unknown routes still answer 404, so the 401s above are meaningful.
    expect("GET /api/rota-inexistente", (await call(baseUrl, "GET", "/api/rota-inexistente")).status, 404);

    if (child.exitCode !== null) throw new Error(`API exited after serving requests (code ${child.exitCode}).`);

    console.log(`boot smoke: ${checks.length} checks passed`);
  } catch (error) {
    console.error(`\n${error instanceof Error ? error.message : String(error)}`);
    console.error("\n--- API logs (tail) ---\n" + tail());
    process.exitCode = 1;
  } finally {
    cleanup();
    await new Promise((resolve) => {
      if (child.exitCode !== null) return resolve();
      child.once("exit", resolve);
      setTimeout(() => {
        child.kill("SIGKILL");
        resolve();
      }, 5000).unref();
    });
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack : String(error));
  process.exitCode = 1;
});
