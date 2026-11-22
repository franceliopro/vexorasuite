import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { once } from "node:events";
import { after, describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import {
  PHP_VERSIONS,
  JobStore,
  createProvisionerServer,
  databaseNameFor,
  isLegacyPhpVersion,
} from "../dist/index.js";

const baseRequest = {
  requestId: "vx-1001",
  tenantId: "tenant-a",
  slug: "alto-araguaia-imoveis",
  domain: "exemplo.com.br",
  type: "php-mysql",
  phpVersion: "8.3",
  quotaGb: 2,
  source: "valuehost",
};

describe("provisionador em modo simulação", () => {
  it("oferece todas as versões PHP solicitadas e marca as antigas como legadas", () => {
    assert.equal(PHP_VERSIONS.length, 17);
    assert.equal(PHP_VERSIONS[0], "5.2");
    assert.equal(PHP_VERSIONS.at(-1), "8.6");
    assert.equal(isLegacyPhpVersion("5.2"), true);
    assert.equal(isLegacyPhpVersion("7.4"), true);
    assert.equal(isLegacyPhpVersion("8.0"), false);
  });

  it("dry-run não aplica nada e devolve um plano determinístico", () => {
    const store = new JobStore();
    const first = store.plan(baseRequest);
    const second = store.plan(baseRequest);

    assert.equal(first.created, true);
    assert.equal(second.created, false);
    assert.deepEqual(first.plan, second.plan);
    assert.deepEqual(
      first.plan.actions.map((action) => action.kind),
      ["database", "user", "folder", "vhost", "tls", "healthcheck"],
    );
    assert.equal(store.status(baseRequest.requestId).status, "planned");
    assert.equal(store.status(baseRequest.requestId).mode, "simulation");
    assert.ok(
      first.plan.warnings.some((warning) => warning.includes("SIMULAÇÃO")),
    );
  });

  it("avisa explicitamente quando PHP legado é selecionado", () => {
    const store = new JobStore();
    const { plan } = store.plan({
      ...baseRequest,
      requestId: "vx-legacy",
      phpVersion: "5.2",
    });
    assert.ok(plan.warnings.some((warning) => warning.includes("PHP 5.2")));
  });

  it("apply é idempotente e rollback só desfaz o mesmo requestId", () => {
    const store = new JobStore();
    store.plan(baseRequest);
    const first = store.apply(baseRequest.requestId);
    const second = store.apply(baseRequest.requestId);

    assert.equal(first.status, "applied");
    assert.equal(second.status, "applied");
    assert.equal(second.appliedAt, first.appliedAt);
    assert.equal(store.count(), 1);

    const rolledBack = store.rollback(baseRequest.requestId);
    assert.equal(rolledBack.status, "rolled-back");
    assert.equal(store.status(baseRequest.requestId).vhost, false);
  });

  it("isola bancos por slug e rejeita requestId reutilizado com dados diferentes", () => {
    const store = new JobStore();
    store.plan(baseRequest);
    store.plan({
      ...baseRequest,
      requestId: "vx-1002",
      slug: "morbeck-carvalhinho",
      tenantId: "tenant-b",
    });

    assert.equal(
      databaseNameFor("alto-araguaia-imoveis"),
      "site_alto_araguaia_imoveis",
    );
    assert.equal(
      databaseNameFor("morbeck-carvalhinho"),
      "site_morbeck_carvalhinho",
    );
    assert.throws(
      () => store.plan({ ...baseRequest, domain: "outro.com.br" }),
      (error) => error.code === "conflict",
    );
  });

  it("não devolve segredos enviados no corpo da requisição", () => {
    const store = new JobStore();
    const { plan } = store.plan({
      ...baseRequest,
      password: "hunter2",
      token: "segredo",
    });
    const serialized = JSON.stringify(plan);
    assert.equal(serialized.includes("hunter2"), false);
    assert.equal(serialized.includes("segredo"), false);
  });

  it("expõe as rotas HTTP sem criar recursos reais", async () => {
    const server = createProvisionerServer();
    server.listen(0, "127.0.0.1");
    await once(server, "listening");
    const address = server.address();
    assert.ok(address && typeof address !== "string");
    const base = `http://127.0.0.1:${address.port}`;

    try {
      const dryRun = await fetch(`${base}/provision/dry-run`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(baseRequest),
      });
      assert.equal(dryRun.status, 201);
      const planResponse = await dryRun.json();
      assert.equal(planResponse.plan.requestId, baseRequest.requestId);

      const status = await fetch(
        `${base}/provision/${baseRequest.requestId}/status`,
      );
      assert.equal(status.status, 200);
      const statusBody = await status.json();
      assert.equal(statusBody.status, "planned");
      assert.equal(statusBody.mode, "simulation");
      assert.equal(statusBody.tls, "pending");
    } finally {
      server.close();
      await once(server, "close");
    }
  });
});

describe("GUI web do provisionador", () => {
  async function withServer(run) {
    const server = createProvisionerServer();
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

  it("serve a página na raiz com o selo de simulação e o formulário", async () => {
    await withServer(async (base) => {
      const response = await fetch(`${base}/`);
      assert.equal(response.status, 200);
      assert.match(response.headers.get("content-type") ?? "", /text\/html/);
      const html = await response.text();
      assert.ok(html.includes("<title>Provisionador de sites"));
      assert.ok(html.includes("Modo simulação"));
      for (const id of [
        "requestId",
        "tenantId",
        "slug",
        "domain",
        "type",
        "phpVersion",
        "quotaGb",
        "source",
        "dry-run-button",
        "apply-button",
        "rollback-button",
        "approved",
      ]) {
        assert.ok(html.includes(`id="${id}"`), `a GUI perdeu o campo ${id}`);
      }
    });
  });

  it("serve apenas os arquivos estáticos declarados", async () => {
    await withServer(async (base) => {
      for (const [path, type] of [
        ["/styles.css", /text\/css/],
        ["/app.js", /javascript/],
      ]) {
        const response = await fetch(`${base}${path}`);
        assert.equal(response.status, 200);
        assert.match(response.headers.get("content-type") ?? "", type);
        assert.ok((await response.text()).length > 0);
      }

      const missing = await fetch(`${base}/../package.json`);
      assert.equal(missing.status, 404);
    });
  });

  it("publica metadados com as 17 versões PHP e as legadas", async () => {
    await withServer(async (base) => {
      const response = await fetch(`${base}/meta`);
      assert.equal(response.status, 200);
      const meta = await response.json();
      assert.equal(meta.mode, "simulation");
      assert.deepEqual(meta.phpVersions, PHP_VERSIONS);
      assert.deepEqual(
        meta.legacyVersions,
        PHP_VERSIONS.filter(isLegacyPhpVersion),
      );
    });
  });

  it("exige aprovação explícita antes de habilitar o apply", async () => {
    const js = readFileSync(
      fileURLToPath(new URL("../public/app.js", import.meta.url)),
      "utf8",
    );
    assert.ok(js.includes('byId("approved").checked'));
    assert.ok(
      js.includes("Aprovação explícita é obrigatória antes de aplicar."),
    );
    assert.ok(
      js.includes("disabled = false") && js.includes("disabled = true"),
    );
    assert.ok(js.includes("/provision/dry-run"));
    assert.ok(js.includes("/provision/apply"));
    assert.ok(js.includes("window.confirm"));
  });
});

after(() => {
  // Nenhum recurso externo é mantido entre testes.
});
