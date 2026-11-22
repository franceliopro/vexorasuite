"use strict";

const byId = (id) => document.getElementById(id);
let lastPlan = null;

async function api(path, options = {}) {
  const response = await fetch(path, {
    ...options,
    headers: { "content-type": "application/json" },
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(body.error || `HTTP ${response.status}`);
  }
  return body;
}

function setResult(text) {
  byId("result-output").textContent = text;
}

function currentRequestId() {
  return byId("requestId").value.trim();
}

function payload() {
  const body = {
    requestId: byId("requestId").value.trim(),
    tenantId: byId("tenantId").value.trim(),
    slug: byId("slug").value.trim(),
    domain: byId("domain").value.trim(),
    type: byId("type").value,
  };
  const source = byId("source").value.trim();
  if (source) body.source = source;
  const quota = byId("quotaGb").value.trim();
  if (quota) body.quotaGb = Number(quota);
  if (body.type === "php-mysql") body.phpVersion = byId("phpVersion").value;
  return body;
}

function appendWarnings(box, warnings) {
  for (const warning of warnings) {
    const line = document.createElement("div");
    line.className = "warn";
    line.textContent = `⚠ ${warning}`;
    box.append(line);
  }
}

function renderPlan(plan, created) {
  const box = byId("plan-output");
  box.replaceChildren();

  const intro = document.createElement("div");
  intro.textContent = `${plan.requestId} · ${plan.slug} · ${created ? "novo plano" : "plano já existente"}`;
  box.append(intro);

  const list = document.createElement("ul");
  for (const action of plan.actions) {
    const item = document.createElement("li");
    item.textContent = `${action.kind}: ${action.target} — ${action.detail}`;
    list.append(item);
  }
  box.append(list);
  appendWarnings(box, plan.warnings);
}

function renderStatus(status) {
  const box = byId("status-output");
  box.replaceChildren();
  const lines = [
    `requestId: ${status.requestId}`,
    `status: ${status.status}`,
    `modo: ${status.mode}`,
    `pasta: ${status.folder}`,
    `banco: ${status.database ?? "—"}`,
    `usuário: ${status.dbUser ?? "—"}`,
    `vhost: ${status.vhost}`,
    `TLS: ${status.tls}`,
    `health: ${status.healthUrl}`,
  ];
  for (const line of lines) {
    const div = document.createElement("div");
    div.textContent = line;
    box.append(div);
  }
  appendWarnings(box, status.warnings);
}

async function refreshStatus() {
  const requestId = currentRequestId();
  if (!requestId) {
    setResult("Informe o requestId para consultar o status.");
    return;
  }
  try {
    const status = await api(
      `/provision/${encodeURIComponent(requestId)}/status`,
    );
    renderStatus(status);
    byId("rollback-button").disabled = !["applied", "failed"].includes(
      status.status,
    );
    setResult(`Status consultado: ${status.status}`);
  } catch (error) {
    setResult(`Falha ao consultar status: ${error.message}`);
  }
}

byId("request-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  lastPlan = null;
  byId("apply-button").disabled = true;
  byId("rollback-button").disabled = true;
  byId("approved").checked = false;
  setResult("Gerando dry-run...");
  try {
    const data = await api("/provision/dry-run", {
      method: "POST",
      body: JSON.stringify(payload()),
    });
    lastPlan = data.plan;
    renderPlan(data.plan, data.created);
    byId("apply-button").disabled = false;
    setResult(
      data.created
        ? "Plano gerado. Nada foi aplicado; marque a aprovação para continuar."
        : "Plano já existente para este requestId. Nada foi aplicado.",
    );
  } catch (error) {
    byId("plan-output").textContent = "Nenhum plano gerado.";
    setResult(`Falha no dry-run: ${error.message}`);
  }
});

byId("apply-button").addEventListener("click", async () => {
  if (!lastPlan) return;
  if (!byId("approved").checked) {
    setResult("Aprovação explícita é obrigatória antes de aplicar.");
    return;
  }
  const requestId = lastPlan.requestId;
  setResult("Aplicando em modo simulação...");
  try {
    const data = await api("/provision/apply", {
      method: "POST",
      body: JSON.stringify({ requestId }),
    });
    const ok = document.createElement("span");
    ok.className = "ok";
    ok.textContent = `Aplicado: ${data.status} · ${data.appliedAt ?? "—"}`;
    byId("result-output").replaceChildren(ok);
    await refreshStatus();
  } catch (error) {
    setResult(`Falha no apply: ${error.message}`);
  }
});

byId("status-button").addEventListener("click", refreshStatus);

byId("rollback-button").addEventListener("click", async () => {
  const requestId = currentRequestId();
  if (!requestId) return;
  if (!window.confirm(`Reverter o pedido ${requestId}?`)) return;
  setResult("Revertendo...");
  try {
    const data = await api(
      `/provision/${encodeURIComponent(requestId)}/rollback`,
      {
        method: "POST",
      },
    );
    byId("result-output").textContent = `Revertido: ${data.status}`;
    await refreshStatus();
  } catch (error) {
    setResult(`Falha no rollback: ${error.message}`);
  }
});

function syncType() {
  const isPhp = byId("type").value === "php-mysql";
  byId("php-version-field").hidden = !isPhp;
  byId("phpVersion").disabled = !isPhp;
}

byId("type").addEventListener("change", syncType);

async function init() {
  syncType();
  try {
    const meta = await api("/meta");
    const select = byId("phpVersion");
    for (const version of meta.phpVersions) {
      const option = document.createElement("option");
      option.value = version;
      option.textContent = meta.legacyVersions.includes(version)
        ? `${version} (fora de suporte)`
        : version;
      select.append(option);
    }
    const recommended = meta.phpVersions.find((version) =>
      version.startsWith("8."),
    );
    if (recommended) select.value = recommended;
    byId("mode-badge").textContent =
      `${meta.mode} · nenhum recurso real é criado`;
  } catch (error) {
    setResult(`Falha ao carregar metadados: ${error.message}`);
  }
}

void init();
