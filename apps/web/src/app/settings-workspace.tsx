"use client";

import { useEffect, useState } from "react";

type Channel = { id: string; name: string; status: string };
type GroupSettings = { groupsEnabled: boolean; allowedGroupIds: string[] };
type GroupChoice = { id: string; name: string };
type Department = { id: string; key: string; name: string; keywords: string[]; isActive: boolean };
type Agent = { id: string; name: string; email: string };
type AsaasSettings = { enabled: boolean; sandbox: boolean; configured: boolean; apiKeyMasked: string; webhookTokenConfigured?: boolean; webhookUrl?: string };

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { ...init, cache: "no-store" });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(Array.isArray(data.message) ? data.message.join(" ") : data.message || data.error || "Falha na operação.");
  return data as T;
}

export function SettingsWorkspace() {
  const [channels, setChannels] = useState<Channel[]>([]);
  const [channelId, setChannelId] = useState("");
  const [groupSettings, setGroupSettings] = useState<GroupSettings>({ groupsEnabled: false, allowedGroupIds: [] });
  const [groupIdsDraft, setGroupIdsDraft] = useState("");
  const [availableGroups, setAvailableGroups] = useState<GroupChoice[]>([]);
  const [loadingGroups, setLoadingGroups] = useState(false);
  const [savingGroups, setSavingGroups] = useState(false);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [departmentMembers, setDepartmentMembers] = useState<Record<string, string[]>>({});
  const [newDepartmentName, setNewDepartmentName] = useState("");
  const [agents, setAgents] = useState<Agent[]>([]);
  const [asaasSettings, setAsaasSettings] = useState<AsaasSettings>({ enabled: false, sandbox: true, configured: false, apiKeyMasked: "" });
  const [asaasKeyDraft, setAsaasKeyDraft] = useState("");
  const [asaasWebhookDraft, setAsaasWebhookDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    void api<Channel[]>("/api/backend/channels").then((rows) => { setChannels(rows); setChannelId(rows.find((row) => row.status === "CONNECTED")?.id || rows[0]?.id || ""); }).catch((e) => setError(e instanceof Error ? e.message : "Falha ao carregar canais."));
    void api<Department[]>("/api/backend/departments").then(async (rows) => {
      setDepartments(rows);
      const entries = await Promise.all(rows.map(async (department) => {
        const members = await api<Agent[]>("/api/backend/departments/" + department.id + "/members").catch(() => []);
        return [department.id, members.map((member) => member.id)] as const;
      }));
      setDepartmentMembers(Object.fromEntries(entries));
    }).catch(() => {});
    void api<Agent[]>("/api/backend/conversations/assignees").then(setAgents).catch(() => {});
    void api<AsaasSettings>("/api/backend/integrations/asaas").then(setAsaasSettings).catch(() => {});
  }, []);

  useEffect(() => {
    if (!channelId) { setGroupSettings({ groupsEnabled: false, allowedGroupIds: [] }); setGroupIdsDraft(""); return; }
    let cancelled = false;
    void api<GroupSettings>("/api/backend/channels/" + channelId + "/group-settings")
      .then((settings) => { if (!cancelled) { setGroupSettings(settings); setGroupIdsDraft(settings.allowedGroupIds.join("\n")); } })
      .catch((e) => { if (!cancelled) setError(e instanceof Error ? e.message : "Falha ao carregar regras de grupos."); });
    return () => { cancelled = true; };
  }, [channelId]);

  async function discoverGroups() {
    if (!channelId) return;
    setLoadingGroups(true); setError(""); setNotice("");
    try {
      const result = await api<{ groups: GroupChoice[] }>("/api/backend/channels/" + channelId + "/groups");
      setAvailableGroups(result.groups);
      if (!result.groups.length) setNotice("Nenhum grupo retornado pelo WhatsApp. Você pode informar os IDs manualmente.");
    } catch (e) { setError(e instanceof Error ? e.message : "Não foi possível consultar os grupos do WhatsApp."); }
    finally { setLoadingGroups(false); }
  }

  function toggleAllowedGroup(groupId: string, checked: boolean) {
    const current = groupIdsDraft.split(/\r?\n|,/).map((value) => value.trim()).filter(Boolean);
    setGroupIdsDraft((checked ? [...new Set([...current, groupId])] : current.filter((id) => id !== groupId)).join("\n"));
  }

  async function saveGroupSettings() {
    if (!channelId) return;
    setSavingGroups(true); setError(""); setNotice("");
    const allowedGroupIds = [...new Set(groupIdsDraft.split(/\r?\n|,/).map((value) => value.trim()).filter((value) => value.endsWith("@g.us")))];
    try {
      const saved = await api<GroupSettings>("/api/backend/channels/" + channelId + "/group-settings", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ groupsEnabled: groupSettings.groupsEnabled, allowedGroupIds }) });
      setGroupSettings(saved); setGroupIdsDraft(saved.allowedGroupIds.join("\n")); setNotice("Regras de grupos salvas.");
    } catch (e) { setError(e instanceof Error ? e.message : "Não foi possível salvar as regras de grupos."); }
    finally { setSavingGroups(false); }
  }

  async function toggleDepartment(department: Department, isActive: boolean) {
    setError(""); setNotice("");
    try {
      await api("/api/backend/departments/" + department.id, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ isActive }) });
      setDepartments((rows) => rows.map((row) => row.id === department.id ? { ...row, isActive } : row));
      setNotice("Configuração da equipe atualizada.");
    } catch (e) { setError(e instanceof Error ? e.message : "Não foi possível atualizar o departamento."); }
  }

  async function saveDepartmentMembers(departmentId: string) {
    setError(""); setNotice("");
    try {
      const members = await api<Agent[]>("/api/backend/departments/" + departmentId + "/members", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ userIds: departmentMembers[departmentId] || [] }) });
      setDepartmentMembers((current) => ({ ...current, [departmentId]: members.map((member) => member.id) }));
      setNotice("Membros da equipe salvos.");
    } catch (e) { setError(e instanceof Error ? e.message : "Não foi possível salvar os membros da equipe."); }
  }

  async function createDepartment() {
    const name = newDepartmentName.trim();
    if (!name) return;
    const key = name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().replace(/[^A-Z0-9_-]/g, "_").slice(0, 40);
    setError(""); setNotice("");
    try {
      await api("/api/backend/departments", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name, key, keywords: [] }) });
      setDepartments(await api<Department[]>("/api/backend/departments"));
      setNewDepartmentName(""); setNotice("Equipe criada.");
    } catch (e) { setError(e instanceof Error ? e.message : "Não foi possível criar a equipe."); }
  }

  async function saveAsaasSettings() {
    setBusy(true); setError(""); setNotice("");
    try {
      const saved = await api<AsaasSettings>("/api/backend/integrations/asaas", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ enabled: asaasSettings.enabled, sandbox: asaasSettings.sandbox, apiKey: asaasKeyDraft, webhookToken: asaasWebhookDraft }) });
      setAsaasSettings(saved); setAsaasKeyDraft(""); setAsaasWebhookDraft(""); setNotice("Configuração Asaas salva.");
    } catch (e) { setError(e instanceof Error ? e.message : "Não foi possível salvar a integração Asaas."); }
    finally { setBusy(false); }
  }

  return <section className="settings-workspace">
    <div className="settings-intro"><p className="eyebrow">ADMINISTRAÇÃO</p><h1>Configurações do atendimento</h1><p>Defina o que a operação pode receber e como as conversas são distribuídas. Estas opções não aparecem mais na tela diária de conversas.</p></div>
    {error ? <div className="inbox-error" role="alert"><span>{error}</span><button onClick={() => setError("")} aria-label="Fechar aviso">×</button></div> : null}
    {notice ? <p className="settings-notice" role="status">{notice}</p> : null}
    <section className="content-card settings-card">
      <div className="settings-card-heading"><div><h2>Grupos do WhatsApp</h2><p>Desativados por padrão. Mesmo habilitados, somente os grupos autorizados abaixo serão recebidos.</p></div><span className="settings-tag">CANAL</span></div>
      <label className="settings-field"><span>Conexão WhatsApp</span><select value={channelId} onChange={(event) => setChannelId(event.target.value)}><option value="">Nenhum canal disponível</option>{channels.map((channel) => <option key={channel.id} value={channel.id}>{channel.name} · {channel.status === "CONNECTED" ? "Conectado" : channel.status}</option>)}</select></label>
      <label className="settings-check"><input type="checkbox" checked={groupSettings.groupsEnabled} disabled={!channelId} onChange={(event) => setGroupSettings((current) => ({ ...current, groupsEnabled: event.target.checked }))} /><span><strong>Permitir conversas de grupos</strong><small>Conversas individuais continuam funcionando normalmente.</small></span></label>
      <div className="settings-field-label"><span>Grupos autorizados</span><button type="button" className="text-button" onClick={() => void discoverGroups()} disabled={!channelId || loadingGroups}>{loadingGroups ? "Buscando..." : "Buscar grupos"}</button></div>
      {availableGroups.length ? <div className="settings-group-list">{availableGroups.map((group) => <label key={group.id} className="settings-group-option"><input type="checkbox" checked={groupIdsDraft.split(/\r?\n|,/).map((value) => value.trim()).includes(group.id)} onChange={(event) => toggleAllowedGroup(group.id, event.target.checked)} /><span><strong>{group.name}</strong><small>{group.id}</small></span></label>)}</div> : null}
      <label className="settings-field"><span>IDs dos grupos (um por linha, terminados em @g.us)</span><textarea value={groupIdsDraft} onChange={(event) => setGroupIdsDraft(event.target.value)} rows={3} placeholder="120363000000000000@g.us" /></label>
      <div className="settings-card-footer"><small>Grupos fora desta lista nunca entram no atendimento, mesmo quando a opção estiver ativada.</small><button className="primary-button" type="button" onClick={() => void saveGroupSettings()} disabled={!channelId || savingGroups}>{savingGroups ? "Salvando..." : "Salvar regras"}</button></div>
    </section>
    <section className="content-card settings-card">
      <div className="settings-card-heading"><div><h2>Equipes e distribuição</h2><p>Ative as áreas utilizadas e defina quais atendentes fazem parte de cada equipe.</p></div><span className="settings-tag">EQUIPES</span></div>
      {departments.map((department) => <div className="settings-department" key={department.id}>
        <label className="settings-check"><input type="checkbox" checked={department.isActive} onChange={(event) => void toggleDepartment(department, event.target.checked)} /><span><strong>{department.name}</strong><small>{department.isActive ? "Equipe ativa" : "Equipe desativada"}</small></span></label>
        {department.isActive ? <div className="settings-member-list">{agents.map((agent) => <label key={agent.id}><input type="checkbox" checked={(departmentMembers[department.id] || []).includes(agent.id)} onChange={(event) => setDepartmentMembers((current) => ({ ...current, [department.id]: event.target.checked ? [...new Set([...(current[department.id] || []), agent.id])] : (current[department.id] || []).filter((id) => id !== agent.id) }))} /><span>{agent.name}</span></label>)}<button type="button" className="text-button" onClick={() => void saveDepartmentMembers(department.id)}>Salvar membros</button></div> : null}
      </div>)}
      <form className="settings-create-team" onSubmit={(event) => { event.preventDefault(); void createDepartment(); }}><input value={newDepartmentName} onChange={(event) => setNewDepartmentName(event.target.value)} placeholder="Nome da nova equipe" maxLength={80} /><button className="secondary-button" type="submit" disabled={!newDepartmentName.trim()}>Criar equipe</button></form>
    </section>
    <section className="content-card settings-card">
      <div className="settings-card-heading"><div><h2>Financeiro · Asaas</h2><p>Integração utilizada pelo bot para consultar cobranças.</p></div><span className="settings-tag">{asaasSettings.configured ? (asaasSettings.enabled ? "ATIVO" : "DESATIVADO") : "CONFIGURAR"}</span></div>
      <label className="settings-check"><input type="checkbox" checked={asaasSettings.enabled} onChange={(event) => setAsaasSettings((current) => ({ ...current, enabled: event.target.checked }))} /><span><strong>Ativar consulta de cobranças no bot</strong></span></label>
      <label className="settings-check"><input type="checkbox" checked={asaasSettings.sandbox} onChange={(event) => setAsaasSettings((current) => ({ ...current, sandbox: event.target.checked }))} /><span><strong>Usar Sandbox</strong><small>Testes sem cobrança real; recomendado antes da produção.</small></span></label>
      <label className="settings-field"><span>Chave de API {asaasSettings.configured ? "· já cadastrada; deixe vazio para manter" : ""}</span><input type="password" autoComplete="new-password" value={asaasKeyDraft} onChange={(event) => setAsaasKeyDraft(event.target.value)} placeholder={asaasSettings.configured ? asaasSettings.apiKeyMasked : "$aact_..."} /></label>
      <label className="settings-field"><span>Token do webhook {asaasSettings.webhookTokenConfigured ? "· já cadastrado; deixe vazio para manter" : ""}</span><input type="password" autoComplete="new-password" value={asaasWebhookDraft} onChange={(event) => setAsaasWebhookDraft(event.target.value)} placeholder="Token configurado no painel Asaas" /></label>
      <div className="settings-webhook"><small>URL do webhook</small><code>{asaasSettings.webhookUrl || "Disponível após carregar a configuração"}</code></div>
      <div className="settings-card-footer"><small>Comece pelo Sandbox e valide o fluxo antes de mudar para Produção.</small><button className="primary-button" type="button" onClick={() => void saveAsaasSettings()} disabled={busy}>{busy ? "Salvando..." : "Salvar Asaas"}</button></div>
    </section>
  </section>;
}
