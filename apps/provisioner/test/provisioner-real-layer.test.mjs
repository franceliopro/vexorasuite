import assert from "node:assert/strict";
import { once } from "node:events";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";
import {
  checkHealth,
  JobStore,
  loadConfig,
  phpImageFor,
  SimulationExecutor,
  signWebhook,
  verifyWebhook,
  createProvisionerServer,
} from "../dist/index.js";

const baseRequest = {
  requestId: "vx-3001",
  tenantId: "tenant-a",
  slug: "teste-real",
  domain: "teste-real.example.com",
  type: "php-mysql",
  phpVersion: "8.3",
  quotaGb: 1,
  source: "valuehost",
};

function tempRoot() {
  return mkdtempSync(join(tmpdir(), "vx-provisioner-"));
}

function realEnv(dir) {
  const secretFile = join(dir, "webhook.secret");
  writeFileSync(secretFile, "segredo-de-teste\n", "utf8");
  return {
    PROVISIONER_MODE: "real",
    PROVISIONER_STATE_FILE: join(dir, "state.json"),
    PROVISIONER_SITES_ROOT: join(dir, "sites"),
    PROVISIONER_TRAEFIK_CONFIG_DIR: join(dir, "traefik"),
    PROVISIONER_TLS_RESOLVER: "letsencrypt",
    PROVISIONER_WEBHOOK_SECRET_FILE: secretFile,
    PROVISIONER_PHP_IMAGE_TEMPLATE: "registry.local/php:{version}-fpm",
    PROVISIONER_ALLOW_REAL_APPLY: "1",
  };
}

const healthy = async () => ({
  url: "https://teste-real.example.com/health",
  verified: true,
  statusCode: 200,
  checkedAt: new Date().toISOString(),
  detail: "stub",
});

async function withServer(server, run) {
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  try {
    await run(`http://127.0.0.1:${address.port}`);
  } finally {
    server.close();
    await once(server, "close");
  }
}

async function post(base, path, body, headers = {}) {
  return fetch(`${base}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
}

describe("configuração por ambiente", () => {
  it("mantém simulação e memória quando nada é configurado", () => {
    const config = loadConfig({});
    assert.equal(config.mode, "simulation");
    assert.equal(config.stateFile, null);
    assert.equal(config.webhookSecretFile, null);
    assert.equal(config.allowRealApply, false);
  });

  it("exige configuração completa e rejeita a tag latest no modo real", () => {
    assert.throws(
      () => loadConfig({ PROVISIONER_MODE: "real" }),
      (error) => error.code === "configuration",
    );
    const dir = tempRoot();
    try {
      assert.throws(
        () =>
          loadConfig({
            ...realEnv(dir),
            PROVISIONER_PHP_IMAGE_TEMPLATE: "php:latest",
          }),
        (error) => error.code === "configuration",
      );
      const config = loadConfig(realEnv(dir));
      assert.equal(config.mode, "real");
      assert.equal(phpImageFor(config, "5.2"), "registry.local/php:5.2-fpm");
      assert.equal(phpImageFor(config, "8.6"), "registry.local/php:8.6-fpm");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe("persistência e aprovação", () => {
  it("sobrevive a uma nova instância e nunca persiste segredos do corpo", () => {
    const dir = tempRoot();
    try {
      const stateFile = join(dir, "state.json");
      const first = new JobStore({ stateFile });
      first.plan({ ...baseRequest, password: "hunter2", token: "segredo" });
      first.approve(baseRequest.requestId, "operador");
      first.apply(baseRequest.requestId, { requireApproval: true });

      const saved = readFileSync(stateFile, "utf8");
      assert.equal(saved.includes("hunter2"), false);
      assert.equal(saved.includes("segredo"), false);

      const second = new JobStore({ stateFile });
      const status = second.status(baseRequest.requestId);
      assert.equal(status.status, "applied");
      assert.equal(status.approval.approver, "operador");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("bloqueia apply sem aprovação e sem health-check verificado", () => {
    const store = new JobStore();
    store.plan(baseRequest);
    assert.throws(
      () => store.apply(baseRequest.requestId, { requireApproval: true }),
      (error) => error.code === "invalid_state",
    );
    const evidence = {
      executedAt: new Date().toISOString(),
      steps: [],
      health: {
        url: "https://teste-real.example.com/health",
        verified: false,
        statusCode: 500,
        checkedAt: new Date().toISOString(),
        detail: "stub",
      },
    };
    store.approve(baseRequest.requestId, "operador");
    assert.throws(
      () =>
        store.apply(baseRequest.requestId, {
          requireApproval: true,
          requireHealth: true,
          evidence,
        }),
      (error) => error.code === "health_check",
    );
    evidence.health.verified = true;
    const job = store.apply(baseRequest.requestId, {
      requireApproval: true,
      requireHealth: true,
      evidence,
    });
    assert.equal(job.status, "applied");
    assert.equal(store.status(baseRequest.requestId).published, false);
    const realStore = new JobStore({ mode: "real" });
    realStore.plan(baseRequest);
    realStore.approve(baseRequest.requestId, "operador");
    realStore.apply(baseRequest.requestId, {
      requireApproval: true,
      requireHealth: true,
      evidence,
    });
    assert.equal(realStore.status(baseRequest.requestId).published, true);
    assert.equal(realStore.status(baseRequest.requestId).tls, "configured");
  });
});

describe("webhook assinado e health-check", () => {
  it("valida assinatura, correlação e janela de tempo", () => {
    const secret = "segredo-de-teste";
    const now = 1_800_000_000_000;
    const body = Buffer.from(
      JSON.stringify({
        event: "provision.dry-run",
        payload: { requestId: "vx-3001" },
      }),
    );
    const timestamp = String(Math.floor(now / 1000));
    const headers = {
      "x-vexora-timestamp": timestamp,
      "x-vexora-signature": signWebhook(body, secret, timestamp),
      "x-vexora-correlation-id": "corr-1",
    };
    const verified = verifyWebhook(body, headers, secret, 300, now);
    assert.equal(verified.event, "provision.dry-run");
    assert.equal(verified.correlationId, "corr-1");

    assert.throws(
      () => verifyWebhook(body, headers, "outro-segredo", 300, now),
      (error) => error.code === "invalid_request",
    );
    assert.throws(
      () => verifyWebhook(body, headers, secret, 300, now + 600_000),
      (error) => error.code === "invalid_request",
    );
  });

  it("só confirma health em resposta 2xx", async () => {
    const ok = await checkHealth("https://exemplo.com.br/health", {
      timeoutMs: 1000,
      retries: 0,
      fetchImpl: async () => ({ status: 204 }),
    });
    assert.equal(ok.verified, true);
    assert.equal(ok.statusCode, 204);

    const bad = await checkHealth("https://exemplo.com.br/health", {
      timeoutMs: 1000,
      retries: 0,
      fetchImpl: async () => ({ status: 503 }),
    });
    assert.equal(bad.verified, false);
    assert.equal(bad.statusCode, 503);
  });

  it("executor de simulação não registra nenhuma ação executada", () => {
    const store = new JobStore();
    const { plan } = store.plan(baseRequest);
    const executor = new SimulationExecutor();
    const steps = executor.execute(
      store.get(baseRequest.requestId),
      loadConfig({}),
    );
    assert.equal(steps.length, plan.actions.length);
    assert.ok(steps.every((step) => step.status === "skipped"));
  });
});

describe("orquestração no modo real com executores injetados", () => {
  it("exige aprovação e confirmação legada, e só publica após health", async () => {
    const dir = tempRoot();
    try {
      const env = realEnv(dir);
      const config = loadConfig(env);
      const store = new JobStore({
        mode: config.mode,
        stateFile: config.stateFile,
      });
      const server = createProvisionerServer({
        config,
        store,
        executor: new SimulationExecutor(),
        healthCheck: healthy,
      });
      const legacy = {
        ...baseRequest,
        requestId: "vx-3002",
        phpVersion: "5.2",
      };

      await withServer(server, async (base) => {
        const dryRun = await post(base, "/provision/dry-run", legacy);
        assert.equal(dryRun.status, 201);

        const blocked = await post(base, "/provision/apply", {
          requestId: legacy.requestId,
        });
        assert.equal(blocked.status, 409);

        const meta = await (await fetch(`${base}/meta`)).json();
        assert.equal(meta.mode, "real");
        assert.equal(meta.persistence, "file");
        assert.equal(meta.capabilities.folder, true);
        assert.equal(meta.capabilities.webhook, true);

        const approval = await post(base, "/provision/vx-3002/approve", {
          approver: "operador",
        });
        assert.equal(approval.status, 200);

        const noConfirm = await post(base, "/provision/apply", {
          requestId: legacy.requestId,
        });
        assert.equal(noConfirm.status, 409);
        const noConfirmBody = await noConfirm.json();
        assert.match(noConfirmBody.error, /confirmação explícita/);

        const applied = await post(base, "/provision/apply", {
          requestId: legacy.requestId,
          confirmLegacy: true,
        });
        assert.equal(applied.status, 200);
        const appliedBody = await applied.json();
        assert.equal(appliedBody.health.verified, true);

        const status = await (
          await fetch(`${base}/provision/vx-3002/status`)
        ).json();
        assert.equal(status.approval.approver, "operador");
        assert.equal(status.published, true);
        assert.equal(status.tls, "configured");

        const rollback = await post(base, "/provision/vx-3002/rollback", {});
        assert.equal(rollback.status, 200);
        const rolledBack = await (
          await fetch(`${base}/provision/vx-3002/status`)
        ).json();
        assert.equal(rolledBack.published, false);
      });
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("aceita apenas webhooks assinados", async () => {
    const dir = tempRoot();
    try {
      const env = realEnv(dir);
      const config = loadConfig(env);
      const server = createProvisionerServer({
        config,
        executor: new SimulationExecutor(),
        healthCheck: healthy,
      });
      const raw = Buffer.from(
        JSON.stringify({
          event: "provision.dry-run",
          payload: baseRequest,
        }),
      );
      const timestamp = String(Math.floor(Date.now() / 1000));

      await withServer(server, async (base) => {
        const unsigned = await fetch(`${base}/webhooks/provision`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: raw,
        });
        assert.equal(unsigned.status, 401);

        const signed = await fetch(`${base}/webhooks/provision`, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "x-vexora-timestamp": timestamp,
            "x-vexora-signature": signWebhook(
              raw,
              "segredo-de-teste",
              timestamp,
            ),
            "x-vexora-correlation-id": "corr-2",
          },
          body: raw,
        });
        assert.equal(signed.status, 201);
        const body = await signed.json();
        assert.equal(body.correlationId, "corr-2");
        assert.equal(body.plan.requestId, baseRequest.requestId);
      });
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
