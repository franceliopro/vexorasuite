"use client";
import { useEffect, useState } from "react";

type Skill = { id: string; name: string; description: string; instructions: string; status?: string };
type Capability = { id: string; name: string; category?: string; cost?: string; implemented?: boolean; permission?: string };

function slug(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, ".").replace(/^\.|\.$/g, "").slice(0, 70);
}

export function ProductSkillsEditor() {
  const [skills, setSkills] = useState<Skill[]>([]);
  const [capabilities, setCapabilities] = useState<Capability[]>([]);
  const [builtInIds, setBuiltInIds] = useState<string[]>([]);
  const [canEdit, setCanEdit] = useState(false);
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [creating, setCreating] = useState(false);
  const [draft, setDraft] = useState<Skill>({ id: "", name: "", description: "", instructions: "" });

  async function load() {
    const [skillsResponse, capabilityResponse] = await Promise.all([
      fetch("/api/backend/assistant/custom-skills", { cache: "no-store" }),
      fetch("/api/backend/assistant/skills", { cache: "no-store" }),
    ]);
    if (!skillsResponse.ok || !capabilityResponse.ok) throw Error("Não foi possível carregar as Skills.");
    const data = await skillsResponse.json();
    const registry = await capabilityResponse.json();
    setSkills(data.skills || []);
    setBuiltInIds(data.builtInIds || []);
    setCanEdit(data.canEdit === true);
    setCapabilities(registry.skills || []);
  }
  useEffect(() => { void load().catch(e => setNotice(e.message)); }, []);

  async function save(nextSkills = skills) {
    setBusy(true);
    try {
      const response = await fetch("/api/backend/assistant/custom-skills", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ skills: nextSkills }),
      });
      const data = await response.json();
      if (!response.ok) throw Error(data.message || "Falha ao salvar.");
      await load();
      setNotice("Skills salvas para esta empresa.");
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "Falha ao salvar.");
    } finally {
      setBusy(false);
    }
  }

  function addSkill() {
    const id = slug(draft.name);
    if (!id || !draft.name.trim()) { setNotice("Informe o nome da Skill."); return; }
    if (skills.some(skill => skill.id === id)) { setNotice("Já existe uma Skill com este identificador."); return; }
    const next = [...skills, { ...draft, id, name: draft.name.trim(), description: draft.description.trim(), status: "draft" }];
    setSkills(next);
    setDraft({ id: "", name: "", description: "", instructions: "" });
    setCreating(false);
    void save(next);
  }

  function removeSkill(skill: Skill) {
    if (builtInIds.includes(skill.id)) { setNotice("Skills nativas não podem ser excluídas; você pode restaurar suas instruções."); return; }
    const next = skills.filter(item => item.id !== skill.id);
    setSkills(next);
    void save(next);
  }

  return <section className="workspace-surface product-skills-editor">
    <div className="workspace-section-heading">
      <div><h2>Skills e capacidades</h2><p>Consulte o que cada Skill faz e ajuste as orientações usadas pela IA e pelas criações.</p></div>
      {canEdit && <button type="button" className="secondary-button" disabled={busy} onClick={() => setCreating(value => !value)}>+ Criar Skill</button>}
    </div>
    {creating && <div className="workspace-surface">
      <label>Nome da Skill<input value={draft.name} onChange={e => setDraft(value => ({ ...value, name: e.target.value }))} placeholder="Ex.: Qualificação de leads" /></label>
      <label>Descrição<textarea rows={2} value={draft.description} onChange={e => setDraft(value => ({ ...value, description: e.target.value }))} /></label>
      <label>Capacidades e instruções<textarea rows={6} maxLength={12000} value={draft.instructions} onChange={e => setDraft(value => ({ ...value, instructions: e.target.value }))} /></label>
      <button type="button" className="primary-button" disabled={busy} onClick={addSkill}>Criar e salvar</button>
    </div>}
    {skills.map(skill => {
      const capability = capabilities.find(item => item.id === skill.id);
      const native = builtInIds.includes(skill.id);
      return <details key={skill.id} className="workspace-disclosure">
        <summary>{skill.name} · {native ? "Nativa" : "Personalizada"} · {skill.status === "implemented" ? "Ativa" : "Rascunho"}</summary>
        <small>ID interno: {skill.id}{capability?.category ? " · " + capability.category : ""}{capability?.cost ? " · custo " + capability.cost : ""}</small>
        <p>{skill.description}</p>
        {capability && <p><strong>Capacidade do sistema:</strong> {capability.implemented ? "disponível" : "ainda não implementada"}{capability.permission ? " · permissão " + capability.permission : ""}</p>}
        <label>Orientações da Skill<textarea rows={8} maxLength={12000} disabled={!canEdit || busy} value={skill.instructions} onChange={e => setSkills(rows => rows.map(item => item.id === skill.id ? { ...item, instructions: e.target.value } : item))} /></label>
        {canEdit && <div className="workspace-actions"><button type="button" className="primary-button" disabled={busy} onClick={() => void save()}>Salvar</button>{!native && <button type="button" className="danger-button" disabled={busy} onClick={() => removeSkill(skill)}>Excluir</button>}</div>}
      </details>;
    })}
    {notice && <p role="status">{notice}</p>}
  </section>;
}
