"use client";
import { FreeSiteEditor } from "./free-site-frame";
import { useCallback, useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { createPortal } from "react-dom";
const RichPromptEditor = dynamic(() => import("./rich-prompt-editor").then((m) => m.RichPromptEditor), {});
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { AREAS, BLOCKS_META, api, safeSlug, ApiError, type Site, type Form, type Item, type Page, type Block } from "./sites-shared";
import { FileManager } from "./file-manager";
import { PostBodyEditor } from "./post-body-editor";
import { FileImagePicker } from "./file-image-picker";
import { maskBRLInput, formatBRL } from "../lib/money";
import { SitePreview } from "./site-preview";
import { Building2, Bell, Check, ChevronDown, ChevronLeft, ChevronRight, ChevronUp, Columns3, Copy, Eye, EyeOff, Globe, ImagePlus, LayoutTemplate, LayoutGrid, Loader2, Maximize2, Minimize2, Monitor, Plus, Smartphone, Sparkles, Star, Trash2, Wand2, Mic, X } from "lucide-react";

export function SitesWizardDialog(props: {
  wizName: string; setWizName: (v: string) => void;
  wizArea: string; setWizArea: (v: string) => void;
  wizKind: "STATIC" | "DYNAMIC"; setWizKind: (v: "STATIC" | "DYNAMIC") => void;
  wizPrimary: string; setWizPrimary: (v: string) => void;
  wizAccent: string; setWizAccent: (v: string) => void;
  wizSlug: string; setWizSlug: (v: string) => void;
  wizWhatsapp: { label: string; handle: string }[]; setWizWhatsapp: (v: { label: string; handle: string }[]) => void;
  wizSocials: { platform: string; handle: string }[]; setWizSocials: (v: { platform: string; handle: string }[]) => void;
  wizSaving: boolean; wizError: string;
  wizAiPrompt: string; setWizAiPrompt: (v: string) => void;
  wizAiDictating: boolean; wizAiDictateStatus: string;
  dictateWizardPrompt: () => void;
  wizReferenceUrl: string; setWizReferenceUrl: (v: string) => void;
  wizCloneUrl: string; setWizCloneUrl: (v: string) => void;
  closeWizard: () => void; submitWizard: () => Promise<void>;
  onSaveDraft: () => void; savedDraft: boolean;
  onCloneSite: () => void; wizCloning: boolean;
}) {
  const { wizName, setWizName, wizArea, setWizArea, wizKind, setWizKind, wizPrimary, setWizPrimary, wizAccent, setWizAccent, wizSlug, setWizSlug, wizWhatsapp, setWizWhatsapp, wizSocials, setWizSocials, wizSaving, wizError, wizAiPrompt, setWizAiPrompt, wizAiDictating, wizAiDictateStatus, dictateWizardPrompt, wizReferenceUrl, setWizReferenceUrl, wizCloneUrl, setWizCloneUrl, closeWizard, submitWizard, onSaveDraft, savedDraft, onCloneSite, wizCloning } = props;
  if (typeof document === "undefined") return null;
  return createPortal(
    <div className="vx-dialog-backdrop sites-wizard-backdrop" role="presentation" onMouseDown={e => { if (e.target === e.currentTarget) closeWizard(); }}>
      <section className="vx-dialog sites-wizard" role="dialog" aria-modal="true" aria-labelledby="sites-wizard-title">
        <header className="vx-dialog-heading"><span className="vx-dialog-icon"><Sparkles size={20} aria-hidden="true" /></span><div><h2 id="sites-wizard-title">Criar site com IA</h2><p>A Véxora monta a estrutura completa do site para você.</p></div><div style={{display:"flex",gap:8,marginLeft:"auto"}}><button type="button" className="secondary-button" onClick={onSaveDraft} title="Salvar rascunho deste formulário para continuar depois">{savedDraft ? "Salvo como rascunho" : "Salvar como rascunho"}</button><button type="button" className="vx-dialog-close" aria-label="Fechar" onClick={closeWizard}><X size={18} aria-hidden="true" /></button></div></header>
        <div className="vx-dialog-body sites-wizard-body">
          <label className="sites-field"><span>Nome do site</span><input autoFocus value={wizName} onChange={e => { setWizName(e.target.value); if (!wizSlug) setWizSlug(safeSlug(e.target.value)); }} placeholder="Ex.: Clínica Estética Lume" /></label>
          <p className="sites-field-label">Escolha o template do site</p>
          <div className="sites-areas">
            {AREAS.map(a => (
              <button key={a.key} type="button" aria-pressed={wizArea === a.key} className={"sites-area " + (wizArea === a.key ? "active" : "")} onClick={() => setWizArea(a.key)}>
                <strong>{a.label}</strong><small>{a.hint}</small>
              </button>
            ))}
          </div>
          <div className="sites-inline-fields">
            <label className="sites-field"><span>Tipo</span><select value={wizKind} onChange={e => setWizKind(e.target.value as any)}><option value="STATIC">Site institucional (páginas)</option><option value="DYNAMIC">Site dinâmico (posts/imóveis)</option></select></label>
            <label className="sites-field"><span>Endereço no site (slug)</span><input value={wizSlug} onChange={e => setWizSlug(safeSlug(e.target.value))} placeholder="clinica-lume" /></label>
          </div>
          <div className="sites-inline-fields sites-inline-colors">
            <label className="sites-field"><span>Cor principal</span><input type="color" value={wizPrimary} onChange={e => setWizPrimary(e.target.value)} /></label>
            <label className="sites-field"><span>Cor de destaque</span><input type="color" value={wizAccent} onChange={e => setWizAccent(e.target.value)} /></label>
          </div>
          <details className="sites-ai-card" open>
            <summary><Sparkles size={14} aria-hidden="true" /> Criar com IA (opcional)</summary>
            <p className="sites-field-hint">Descreva o negócio, o público, o tom e o que o site precisa. Se houver IA configurada na empresa, o agente Design Gráfico &amp; Web redige o conteúdo — inclusive lendo o link de referência abaixo (ou um link colado no próprio comando). Sem IA, o template cria o site com os dados acima.</p>
            <div className="sites-ai-prompt">
              <div className="sites-ai-prompt-head"><span>Pedido para a IA</span><button type="button" className={"sites-ai-dictate" + (wizAiDictating ? " is-listening" : "")} onClick={dictateWizardPrompt} aria-pressed={wizAiDictating} title="Ditar o pedido com o microfone"><Mic size={14} aria-hidden="true" />{wizAiDictating ? "Parar" : "Ditar"}</button></div>
              <RichPromptEditor label={"Comando para a IA (opcional)"} documentKey={"wizard:ai-prompt"} rows={4} maxLength={2500} placeholder="Ex.: Clínica estética Lume em Cuiabá, foco em limpeza de pele e Botox para mulheres 30–55. Tom: acolhedor, profissional. Quero agendar pelo WhatsApp. Cole aqui também links e URLs de imagens — o editor entende markdown." value={wizAiPrompt} onChange={setWizAiPrompt} />
              {wizAiDictateStatus ? <small className="sites-ai-dictate-status" role="status">{wizAiDictateStatus}</small> : null}
              <label className="sites-field"><span>Link de referência visual (opcional)</span><input type="url" inputMode="url" value={wizReferenceUrl} onChange={e => setWizReferenceUrl(e.target.value)} placeholder="https://site-que-voce-admira.com.br" /></label>
            </div>
                                  </details>
          <details className="sites-ai-card">
            <summary><Globe size={14} aria-hidden="true" /> Clonar um site existente (WordPress)</summary>
            <p className="sites-field-hint">Cole a URL pública do site do cliente (ex.: https://rastreabem.com.br). O Véxora importa páginas, posts e imóveis via WordPress REST API — o site entra como rascunho para você revisar e publicar. O tema visual não é copiado: o conteúdo vem estruturado e o design é aplicado pelo Véxora Sites, editável depois no editor.</p>
            <div className="sites-ai-prompt">
              <label className="sites-field"><span>URL do site a clonar</span><input type="url" inputMode="url" value={wizCloneUrl} onChange={e => setWizCloneUrl(e.target.value)} placeholder="https://cliente.com.br" /></label>
              <button type="button" className="secondary-button" disabled={wizSaving || wizCloning || !/^https:\/\/.+\..+/i.test((wizCloneUrl || "").trim())} onClick={onCloneSite} title="Importa páginas, posts e imóveis de um site WordPress público">{wizCloning ? <Loader2 size={15} className="vx-spin" aria-hidden="true" /> : <Copy size={15} aria-hidden="true" />} {wizCloning ? "Clonando…" : "Clonar site inteiro"}</button>
            </div>
          </details>
          <fieldset className="sites-block"><legend>WhatsApp por departamento</legend>
            {wizWhatsapp.map((w, i) => (
              <div key={i} className="sites-row"><input aria-label="Departamento" value={w.label} onChange={e => { const next = [...wizWhatsapp]; next[i] = { ...w, label: e.target.value }; setWizWhatsapp(next); }} placeholder="Ex.: Recepção" /><input aria-label="Número (com DDI)" value={w.handle} onChange={e => { const next = [...wizWhatsapp]; next[i] = { ...w, handle: e.target.value }; setWizWhatsapp(next); }} placeholder="55 65 99999-0001" inputMode="numeric" /><button type="button" className="icon-button" aria-label="Remover" onClick={() => setWizWhatsapp(wizWhatsapp.filter((_, j) => j !== i))}><X size={15} aria-hidden="true" /></button></div>
            ))}
            <button type="button" className="text-button" onClick={() => setWizWhatsapp([...wizWhatsapp, { label: "", handle: "" }])}><Plus size={13} aria-hidden="true" /> Adicionar WhatsApp</button>
          </fieldset>
          <fieldset className="sites-block"><legend>Redes sociais (opcional)</legend>
            {wizSocials.map((s, i) => (
              <div key={i} className="sites-row">
                <select aria-label="Rede" value={s.platform} onChange={e => { const next = [...wizSocials]; next[i] = { ...s, platform: e.target.value }; setWizSocials(next); }}>{["instagram","facebook","linkedin","youtube","tiktok","x","telegram"].map(p => <option key={p} value={p}>{p}</option>)}</select>
                <input aria-label="Perfil" value={s.handle} onChange={e => { const next = [...wizSocials]; next[i] = { ...s, handle: e.target.value }; setWizSocials(next); }} placeholder="@perfil" />
                <button type="button" className="icon-button" aria-label="Remover" onClick={() => setWizSocials(wizSocials.filter((_, j) => j !== i))}><X size={15} aria-hidden="true" /></button>
              </div>
            ))}
            <button type="button" className="text-button" onClick={() => setWizSocials([...wizSocials, { platform: "instagram", handle: "" }])}><Plus size={13} aria-hidden="true" /> Adicionar rede</button>
          </fieldset>
          {wizError && <p role="alert" className="sites-error">{wizError}</p>}
        </div>
        <footer className="vx-dialog-footer"><button type="button" className="secondary-button" onClick={closeWizard}>Cancelar</button><button type="button" className="primary-button" disabled={wizSaving || !wizName.trim() || !wizArea} onClick={() => void submitWizard()}>{wizSaving ? <Loader2 size={15} className="vx-spin" aria-hidden="true" /> : <Sparkles size={15} aria-hidden="true" />} Criar site</button></footer>
      </section>
    </div>,
    document.body,
  );
}
const STUDIO_FIELD_DEFS: Record<string, { fields: { key: string; label: string; area?: boolean }[]; array?: { key: string; label: string; itemLabel: string; fields: { key: string; label: string; area?: boolean }[] } }> = {
  hero: { fields: [
    { key: "badge", label: "Selo acima do título" },
    { key: "headline", label: "Título principal", area: true },
    { key: "sub", label: "Texto de apoio", area: true },
    { key: "ctaLabel", label: "Texto do botão" },
    { key: "ctaUrl", label: "Link do botão" },
  ] },
  richText: { fields: [
    { key: "title", label: "Título" },
    { key: "body", label: "Conteúdo", area: true },
  ] },
  services: { fields: [{ key: "title", label: "Título da seção" }], array: { key: "items", label: "Serviços", itemLabel: "Serviço", fields: [{ key: "title", label: "Título" }, { key: "text", label: "Texto", area: true }] } },
  testimonials: { fields: [{ key: "title", label: "Título da seção" }], array: { key: "items", label: "Depoimentos", itemLabel: "Depoimento", fields: [{ key: "text", label: "Texto", area: true }, { key: "name", label: "Nome" }] } },
  faq: { fields: [{ key: "title", label: "Título da seção" }], array: { key: "items", label: "Perguntas", itemLabel: "Pergunta", fields: [{ key: "question", label: "Pergunta" }, { key: "answer", label: "Resposta", area: true }] } },
  cta: { fields: [
    { key: "title", label: "Título" },
    { key: "sub", label: "Texto de apoio", area: true },
    { key: "ctaLabel", label: "Texto do botão" },
    { key: "ctaUrl", label: "Link do botão" },
  ] },
  gallery: { fields: [{ key: "title", label: "Título da seção" }], array: { key: "items", label: "Imagens", itemLabel: "Imagem", fields: [{ key: "url", label: "URL da imagem" }] } },
  posts: { fields: [{ key: "title", label: "Título da seção" }] },
  properties: { fields: [{ key: "title", label: "Título da seção" }] },
  contact: { fields: [{ key: "title", label: "Título da seção" }] },
  spacer: { fields: [{ key: "size", label: "Altura em px" }] },
  divider: { fields: [] },
};

const LAYOUT_TAGS = ["p", "h1", "h2", "h3", "h4"] as const;
const GRADIENTS: [string, string][] = [
  ["Escuro cinematográfico", "linear-gradient(160deg,#050D22 0%,#0A1730 55%,#040A1C 100%)"],
  ["Azul premium", "linear-gradient(150deg,#0B2A4A 0%,#113B5E 100%)"],
  ["Champanhe", "linear-gradient(150deg,#3B2B1A 0%,#6B4F2A 100%)"],
  ["Neutro claro", "linear-gradient(160deg,#F7F7F7 0%,#ECEEF2 100%)"],
  ["Verde esmeralda", "linear-gradient(150deg,#06281F 0%,#0E4B3A 100%)"],
  ["Rosa terracota", "linear-gradient(150deg,#3A1F1F 0%,#6E342E 100%)"],
];
const newLayoutId = () => Math.random().toString(36).slice(2, 10);
const layoutDefaults = (type: string): any => {
  if (type === "text") return { id: newLayoutId(), type, tag: "p", text: "Escreva aqui o seu texto. Use **negrito** e *itálico*.", align: "left" };
  if (type === "image") return { id: newLayoutId(), type, url: "", alt: "Imagem", width: 100, radius: 12, align: "center" };
  if (type === "button") return { id: newLayoutId(), type, label: "Quero conversar", href: "https://wa.me/5500000000000", target: "_blank", background: "#2E7CF6", color: "#FFFFFF", radius: 12, size: "lg", variant: "solid", fullWidth: false };
  return { id: newLayoutId(), type: "spacer", height: 32 };
};
const LAYOUT_ELEMENT_LABEL: Record<string, string> = { text: "Texto", image: "Imagem", button: "Botão", spacer: "Espaço" };

function LayoutBlockEditor({ block, onChange }: { block: any; onChange: (nextContent: any) => void }) {
  const content = block?.content || {};
  const columns: any[] = Array.isArray(content.columns) ? content.columns : [];
  const [uploading, setUploading] = useState<string>("");
  const [aiText, setAiText] = useState<Record<string, string>>({});
  const [aiBusy, setAiBusy] = useState<string>("");
  const [aiError, setAiError] = useState<Record<string, string>>({});
  const [assets, setAssets] = useState<any[] | null>(null);
  const [assetsOpen, setAssetsOpen] = useState(false);

  const setContent = (next: any) => onChange(next);
  const patchColumn = (index: number, patch: any) => setContent({ ...content, columns: columns.map((col, i) => i === index ? { ...col, ...patch } : col) });
  const patchElement = (colIndex: number, elIndex: number, patch: any) => patchColumn(colIndex, { elements: (columns[colIndex]?.elements || []).map((el: any, j: number) => j === elIndex ? { ...el, ...patch } : el) });
  const moveElement = (colIndex: number, elIndex: number, dir: -1 | 1) => {
    const list = [...(columns[colIndex]?.elements || [])]; const target = elIndex + dir;
    if (target < 0 || target >= list.length) return;
    const [item] = list.splice(elIndex, 1); list.splice(target, 0, item);
    patchColumn(colIndex, { elements: list });
  };
  const removeElement = (colIndex: number, elIndex: number) => patchColumn(colIndex, { elements: (columns[colIndex]?.elements || []).filter((_: any, j: number) => j !== elIndex) });
  const addElement = (colIndex: number, type: string) => patchColumn(colIndex, { elements: [...(columns[colIndex]?.elements || []), layoutDefaults(type)] });
  const addColumn = () => { if (columns.length >= 4) return; setContent({ ...content, columns: [...columns, { id: newLayoutId(), span: 6, direction: "column", align: "stretch", justify: "start", gap: 12, elements: [layoutDefaults("text")] }] }); };
  const removeColumn = (index: number) => { if (columns.length <= 1) return; setContent({ ...content, columns: columns.filter((_, i) => i !== index) }); };

  const uploadImage = async (colIndex: number, elIndex: number, file: File) => {
    const key = colIndex + ":" + elIndex; setUploading(key);
    try {
      const data = new FormData(); data.append("file", file);
      const response = await fetch("/api/backend/sites/assets", { method: "POST", body: data });
      const json = await response.json().catch(() => null);
      if (!response.ok) throw new Error(json?.message || "Falha no upload.");
      patchElement(colIndex, elIndex, { url: String(json?.url || ""), alt: file.name.replace(/\.[a-z0-9]+$/i, "") });
    } catch { /* upload failure is surfaced through the disabled button */ } finally { setUploading(""); }
  };
  const loadAssets = async () => {
    if (assets) { setAssetsOpen(v => !v); return; }
    try { const response = await fetch("/api/backend/sites/assets"); const json = await response.json(); setAssets(Array.isArray(json?.assets) ? json.assets : []); setAssetsOpen(true); } catch { setAssets([]); setAssetsOpen(true); }
  };
  const askAiForElement = async (colIndex: number, elIndex: number, instruction: string) => {
    const el = columns[colIndex]?.elements?.[elIndex]; if (!el) return;
    const key = colIndex + ":" + elIndex; setAiBusy(key); setAiError({});
    try {
      const response = await api<{ content: any }>("/sites/pages/" + block.pageId + "/blocks/" + block.id + "/ai", { method: "POST", body: JSON.stringify({ instruction: `Reescreva APENAS o elemento de índice ${elIndex} da coluna ${colIndex} (tipo ${el.type}, conteúdo atual: ${JSON.stringify(el).slice(0, 800)}). Mantenha TODOS os outros elementos exatamente iguais e as mesmas chaves. O que o dono pediu: ${instruction}` }) });
      if (response?.content) onChange(response.content);
      setAiText(v => ({ ...v, [key]: "" }));
    } catch (e) { setAiError(v => ({ ...v, [key]: e instanceof Error ? e.message : "A IA não conseguiu alterar." })); }
    finally { setAiBusy(""); }
  };

  return (
    <div className="sites-block-form layout-editor">
      <p className="sites-field-hint">Seção em colunas — cada coluna é um stack (ou linha) de elementos. Desktop vira 1 coluna no celular automaticamente.</p>
      <div className="layout-section-settings">
        <label className="sites-field"><span>Cor de fundo</span><input type="color" value={(/^#[0-9a-f]{6}$/i.test(content.background || "") ? content.background : "#0A1730") as string} onChange={e => setContent({ ...content, background: e.target.value })} /></label>
        <label className="sites-field"><span>Gradiente pronto</span><select value="" onChange={e => e.target.value && setContent({ ...content, background: e.target.value })}><option value="">Escolher…</option>{GRADIENTS.map(([label, value]) => <option key={label} value={value}>{label}</option>)}</select></label>
        <label className="sites-field"><span>Fundo (CSS livre)</span><input value={typeof content.background === "string" ? content.background : ""} onChange={e => setContent({ ...content, background: e.target.value })} placeholder="#0A1730 ou linear-gradient(…)" /></label>
        <label className="sites-field"><span>Padding (px)</span><input type="number" min={0} max={200} value={content.padding ?? 48} onChange={e => setContent({ ...content, padding: Number(e.target.value) || 0 })} /></label>
        <label className="sites-field"><span>Espaço entre colunas (px)</span><input type="number" min={0} max={96} value={content.gap ?? 24} onChange={e => setContent({ ...content, gap: Number(e.target.value) || 0 })} /></label>
      </div>
      <div className="layout-columns-head"><span className="sites-field-label">Colunas ({columns.length}/4)</span><button type="button" className="text-button" onClick={addColumn} disabled={columns.length >= 4}><Plus size={13} aria-hidden="true" /> Coluna</button></div>
      {columns.map((col: any, colIndex: number) => (
        <fieldset key={col.id || colIndex} className="layout-column">
          <legend>Coluna {colIndex + 1} · {col.span ?? 6}fr</legend>
          <div className="layout-column-controls">
            <label className="sites-field"><span>Largura</span><select value={col.span ?? 6} onChange={e => patchColumn(colIndex, { span: Number(e.target.value) })}>{[1,2,3,4,5,6,7,8,9,10,11,12].map(n => <option key={n} value={n}>{n}fr</option>)}</select></label>
            <label className="sites-field"><span>Direção</span><select value={col.direction === "row" ? "row" : "column"} onChange={e => patchColumn(colIndex, { direction: e.target.value })}><option value="column">Empilhar</option><option value="row">Lado a lado</option></select></label>
            <label className="sites-field"><span>Alinhar</span><select value={col.align || "stretch"} onChange={e => patchColumn(colIndex, { align: e.target.value })}><option value="stretch">Esticar</option><option value="start">Início</option><option value="center">Centro</option><option value="end">Fim</option></select></label>
            <label className="sites-field"><span>Justificar</span><select value={col.justify || "start"} onChange={e => patchColumn(colIndex, { justify: e.target.value })}><option value="start">Início</option><option value="center">Centro</option><option value="end">Fim</option><option value="between">Espaço entre</option></select></label>
            <label className="sites-field"><span>Gap</span><input type="number" min={0} max={64} value={col.gap ?? 12} onChange={e => patchColumn(colIndex, { gap: Number(e.target.value) || 0 })} /></label>
            <button type="button" className="icon-button" title="Remover coluna" aria-label="Remover coluna" onClick={() => removeColumn(colIndex)} disabled={columns.length <= 1}><Trash2 size={14} aria-hidden="true" /></button>
          </div>
          <div className="layout-add"><span>Adicionar elemento:</span>{Object.entries(LAYOUT_ELEMENT_LABEL).map(([type, label]) => <button key={type} type="button" className="sites-add-chip" onClick={() => addElement(colIndex, type)}><Plus size={11} aria-hidden="true" /> {label}</button>)}</div>
          <div className="layout-elements">
            {(col.elements || []).map((el: any, elIndex: number) => {
              const key = colIndex + ":" + elIndex;
              return (
              <div key={el.id || elIndex} className="layout-element">
                <header><b>{LAYOUT_ELEMENT_LABEL[el.type] || el.type}</b>
                  <span className="sites-block-actions"><button type="button" className="icon-button" title="Mover para cima" aria-label="Mover para cima" onClick={() => moveElement(colIndex, elIndex, -1)}><ChevronUp size={13} aria-hidden="true" /></button><button type="button" className="icon-button" title="Mover para baixo" aria-label="Mover para baixo" onClick={() => moveElement(colIndex, elIndex, 1)}><ChevronDown size={13} aria-hidden="true" /></button><button type="button" className="icon-button" title="Remover elemento" aria-label="Remover elemento" onClick={() => removeElement(colIndex, elIndex)}><Trash2 size={13} aria-hidden="true" /></button></span>
                </header>
                {el.type === "text" && (<>
                  <div className="layout-element-row">
                    <label className="sites-field"><span>Tag</span><select value={el.tag || "p"} onChange={e => patchElement(colIndex, elIndex, { tag: e.target.value })}>{LAYOUT_TAGS.map(t => <option key={t} value={t}>{t.toUpperCase()}</option>)}</select></label>
                    <label className="sites-field"><span>Alinhar</span><select value={el.align || "left"} onChange={e => patchElement(colIndex, elIndex, { align: e.target.value })}><option value="left">Esquerda</option><option value="center">Centro</option><option value="right">Direita</option><option value="justify">Justificado</option></select></label>
                    <label className="sites-field"><span>Cor</span><input type="color" value={/^#[0-9a-f]{6}$/i.test(el.style?.color || "") ? el.style.color : "#E7EEFF"} onChange={e => patchElement(colIndex, elIndex, { style: { ...(el.style || {}), color: e.target.value } })} /></label>
                    <label className="sites-field"><span>Tamanho (px)</span><input type="number" min={10} max={96} value={el.style?.fontSize ?? ""} placeholder="auto" onChange={e => { const v = e.target.value; const style = { ...(el.style || {}) }; if (v) style.fontSize = Number(v); else delete style.fontSize; patchElement(colIndex, elIndex, { style }); }} /></label>
                  </div>
                  <label className="sites-field"><span>Texto (**negrito**, *itálico*)</span><textarea rows={3} value={el.text || ""} onChange={e => patchElement(colIndex, elIndex, { text: e.target.value })} /></label>
                </>)}
                {el.type === "image" && (<>
                  {el.url ? <img className="layout-thumb" src={el.url} alt={el.alt || ""} /> : null}
                  <label className="sites-field"><span>URL da imagem</span><input value={el.url || ""} onChange={e => patchElement(colIndex, elIndex, { url: e.target.value })} placeholder="https://…" /></label>
                  <div className="layout-element-row">
                    <label className="layout-upload">{uploading === key ? <Loader2 size={13} className="vx-spin" aria-hidden="true" /> : <Plus size={13} aria-hidden="true" />} Enviar do dispositivo<input type="file" accept="image/*" disabled={uploading === key} hidden onChange={e => { const file = e.target.files?.[0]; if (file) void uploadImage(colIndex, elIndex, file); }} /></label>
                    <button type="button" className="text-button" onClick={() => void loadAssets()}><LayoutGrid size={13} aria-hidden="true" /> File manager</button>
                  </div>
                  {assetsOpen && (<div className="layout-assets">{(assets || []).length ? (assets || []).map(a => <button key={a.id} type="button" title={a.mimeType} onClick={() => { patchElement(colIndex, elIndex, { url: a.url, alt: "" }); setAssetsOpen(false); }}><img src={a.url} alt="" loading="lazy" /></button>) : <p className="sites-field-hint">Nenhuma imagem enviada ainda — envie pelo botão ao lado.</p>}</div>)}
                  <div className="layout-element-row">
                    <label className="sites-field"><span>Largura %</span><select value={el.width ?? 100} onChange={e => patchElement(colIndex, elIndex, { width: Number(e.target.value) })}>{[100, 75, 66, 50, 33, 25].map(n => <option key={n} value={n}>{n}%</option>)}</select></label>
                    <label className="sites-field"><span>Cantos (px)</span><input type="number" min={0} max={64} value={el.radius ?? 12} onChange={e => patchElement(colIndex, elIndex, { radius: Number(e.target.value) || 0 })} /></label>
                    <label className="sites-field"><span>Alinhar</span><select value={el.align || "center"} onChange={e => patchElement(colIndex, elIndex, { align: e.target.value })}><option value="left">Esquerda</option><option value="center">Centro</option><option value="right">Direita</option></select></label>
                  </div>
                  <label className="sites-field"><span>Texto alternativo (alt)</span><input value={el.alt || ""} onChange={e => patchElement(colIndex, elIndex, { alt: e.target.value })} /></label>
                  <label className="sites-field"><span>Legenda</span><input value={el.caption || ""} onChange={e => patchElement(colIndex, elIndex, { caption: e.target.value })} /></label>
                  <div className="layout-element-row">
                    <label className="sites-field"><span>Link da imagem</span><input value={el.linkUrl || ""} onChange={e => patchElement(colIndex, elIndex, { linkUrl: e.target.value })} placeholder="https://… ou #" /></label>
                    <label className="sites-field"><span>Abrir em</span><select value={el.linkTarget === "_blank" ? "_blank" : "_self"} onChange={e => patchElement(colIndex, elIndex, { linkTarget: e.target.value })}><option value="_self">Mesma aba</option><option value="_blank">Nova aba</option></select></label>
                  </div>
                </>)}
                {el.type === "button" && (<>
                  <div className="layout-element-row">
                    <label className="sites-field"><span>Texto do botão</span><input value={el.label || ""} onChange={e => patchElement(colIndex, elIndex, { label: e.target.value })} /></label>
                    <label className="sites-field"><span>Cor do botão</span><input type="color" value={/^#[0-9a-f]{6}$/i.test(el.background || "") ? el.background : "#2E7CF6"} onChange={e => patchElement(colIndex, elIndex, { background: e.target.value })} /></label>
                    <label className="sites-field"><span>Cor do texto</span><input type="color" value={/^#[0-9a-f]{6}$/i.test(el.color || "") ? el.color : "#FFFFFF"} onChange={e => patchElement(colIndex, elIndex, { color: e.target.value })} /></label>
                  </div>
                  <label className="sites-field"><span>Link (WhatsApp, URL ou #)</span><input value={el.href || ""} onChange={e => patchElement(colIndex, elIndex, { href: e.target.value })} placeholder="https://wa.me/55…" /></label>
                  <div className="layout-element-row">
                    <label className="sites-field"><span>Abrir em</span><select value={el.target === "_blank" ? "_blank" : "_self"} onChange={e => patchElement(colIndex, elIndex, { target: e.target.value })}><option value="_blank">Nova aba</option><option value="_self">Mesma aba</option></select></label>
                    <label className="sites-field"><span>Tamanho</span><select value={el.size || "md"} onChange={e => patchElement(colIndex, elIndex, { size: e.target.value })}><option value="sm">Pequeno</option><option value="md">Médio</option><option value="lg">Grande</option></select></label>
                    <label className="sites-field"><span>Estilo</span><select value={el.variant || "solid"} onChange={e => patchElement(colIndex, elIndex, { variant: e.target.value })}><option value="solid">Sólido</option><option value="outline">Contorno</option><option value="ghost">Fantasma</option></select></label>
                    <label className="sites-field"><span>Cantos (px)</span><input type="number" min={0} max={64} value={el.radius ?? 10} onChange={e => patchElement(colIndex, elIndex, { radius: Number(e.target.value) || 0 })} /></label>
                  </div>
                  <label className="sites-toggle"><input type="checkbox" checked={el.fullWidth === true} onChange={e => patchElement(colIndex, elIndex, { fullWidth: e.target.checked })} /> Largura total</label>
                </>)}
                {el.type === "spacer" && (
                  <label className="sites-field"><span>Altura (px)</span><input type="number" min={1} max={240} value={el.height ?? 32} onChange={e => patchElement(colIndex, elIndex, { height: Number(e.target.value) || 32 })} /></label>
                )}
                <div className="layout-element-ai">
                  <input value={aiText[key] || ""} onChange={e => setAiText(v => ({ ...v, [key]: e.target.value }))} placeholder="Pedido para a IA… (ex.: destaque o prazo)" onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); const t = (aiText[key] || "").trim(); if (t) void askAiForElement(colIndex, elIndex, t); } }} />
                  <button type="button" className="icon-button" title="Aplicar na IA" aria-label="Aplicar na IA" disabled={aiBusy === key} onClick={() => { const t = (aiText[key] || "").trim(); if (t) void askAiForElement(colIndex, elIndex, t); }}>{aiBusy === key ? <Loader2 size={13} className="vx-spin" aria-hidden="true" /> : <Sparkles size={13} aria-hidden="true" />}</button>
                </div>
                {aiError[key] ? <p role="alert" className="sites-error">{aiError[key]}</p> : null}
              </div>
              );
            })}
          </div>
        </fieldset>
      ))}
    </div>
  );
}

function StudioEditor({ site, onSaved, onNotice }: { site: Site; onSaved: () => void; onNotice: (v: string) => void }) {
  const [studioPageId, setStudioPageId] = useState("");
  const [device, setDevice] = useState<"pc" | "phone">("pc");
  const [fullscreen, setFullscreen] = useState(false);
  const [relayoutOpen, setRelayoutOpen] = useState(false);
  const [relayoutPrompt, setRelayoutPrompt] = useState("");
  const [relayoutReferenceUrl, setRelayoutReferenceUrl] = useState("");
  const [relayoutImageUrl, setRelayoutImageUrl] = useState("");
  const [relayoutUploading, setRelayoutUploading] = useState(false);
  const [relayoutBusy, setRelayoutBusy] = useState(false);
  const [relayoutError, setRelayoutError] = useState("");
  const [relayoutAssistantDisabled, setRelayoutAssistantDisabled] = useState(false);
  const [relayoutAiFixing, setRelayoutAiFixing] = useState(false);
  const [selected, setSelected] = useState<string>("");
  const [instruction, setInstruction] = useState("");
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState<Record<string, true>>({});
  const [model, setModel] = useState<PreviewSite>(() => JSON.parse(JSON.stringify(site)) as PreviewSite);
  useEffect(() => { setModel(JSON.parse(JSON.stringify(site)) as PreviewSite); }, [site]);
  useEffect(() => {
    if (!fullscreen) return;
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") setFullscreen(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [fullscreen]);
  const studioPage = model.pages.find((page: Page) => page.id === studioPageId) || model.pages[0];
  const allBlocks = model.pages.flatMap((p: any) => p.blocks.map((b: any) => ({ ...b, pageId: p.id, pageTitle: p.title })));
  const selectedBlock = allBlocks.find((b: any) => b.id === selected) || null;
  const dirtyCount = Object.keys(dirty).length;
  const fieldDefs: { fields: { key: string; label: string; area?: boolean }[]; array?: { key: string; label: string; itemLabel: string; fields: { key: string; label: string; area?: boolean }[] } } =
    (selectedBlock ? STUDIO_FIELD_DEFS[selectedBlock.type] : undefined) || { fields: [] };
  const markDirty = (blockId: string) => setDirty((prev) => (prev[blockId] ? prev : { ...prev, [blockId]: true }));
  const replaceBlockContent = (block: any, content: any) => {
    setModel((m: any) => ({ ...m, pages: m.pages.map((p: any) => p.id === block.pageId ? { ...p, blocks: p.blocks.map((b: any) => b.id === block.id ? { ...b, content } : b) } : p) }));
    markDirty(block.id);
  };
  const clearDirty = (blockId?: string) => setDirty((prev) => { if (!blockId) return {}; const next = { ...prev }; delete next[blockId]; return next; });
  const setField = (field: string, value: string) => {
    if (!selectedBlock) return;
    setModel((m: any) => ({ ...m, pages: m.pages.map((p: any) => p.id === selectedBlock.pageId ? { ...p, blocks: p.blocks.map((b: any) => b.id === selectedBlock.id ? { ...b, content: { ...b.content, [field]: value } } : b) } : p) }));
    markDirty(selectedBlock.id);
  };
  const setArrayField = (arrayKey: string, index: number, field: string, value: string) => {
    if (!selectedBlock) return;
    setModel((m: any) => ({ ...m, pages: m.pages.map((p: any) => p.id === selectedBlock.pageId ? { ...p, blocks: p.blocks.map((b: any) => {
      if (b.id !== selectedBlock.id) return b;
      const items = Array.isArray(b.content[arrayKey]) ? b.content[arrayKey].slice() : [];
      if (!items[index]) return b;
      items[index] = { ...items[index], [field]: value };
      return { ...b, content: { ...b.content, [arrayKey]: items } };
    }) } : p) }));
    markDirty(selectedBlock.id);
  };
  const moveArrayItem = (arrayKey: string, index: number, dir: -1 | 1) => {
    if (!selectedBlock) return;
    setModel((m: any) => ({ ...m, pages: m.pages.map((p: any) => p.id === selectedBlock.pageId ? { ...p, blocks: p.blocks.map((b: any) => {
      if (b.id !== selectedBlock.id) return b;
      const items = (b.content[arrayKey] || []).slice();
      const target = index + dir;
      if (target < 0 || target >= items.length) return b;
      const [item] = items.splice(index, 1);
      items.splice(target, 0, item);
      return { ...b, content: { ...b.content, [arrayKey]: items } };
    }) } : p) }));
    markDirty(selectedBlock.id);
  };
  const addArrayItem = (arrayKey: string) => {
    if (!selectedBlock) return;
    setModel((m: any) => ({ ...m, pages: m.pages.map((p: any) => p.id === selectedBlock.pageId ? { ...p, blocks: p.blocks.map((b: any) => {
      if (b.id !== selectedBlock.id) return b;
      const items = (b.content[arrayKey] || []).slice();
      items.push({ title: "Novo item", text: "", name: "", question: "Nova pergunta", answer: "Resposta..." });
      return { ...b, content: { ...b.content, [arrayKey]: items } };
    }) } : p) }));
    markDirty(selectedBlock.id);
  };
  const deleteArrayItem = (arrayKey: string, index: number) => {
    if (!selectedBlock) return;
    setModel((m: any) => ({ ...m, pages: m.pages.map((p: any) => p.id === selectedBlock.pageId ? { ...p, blocks: p.blocks.map((b: any) => {
      if (b.id !== selectedBlock.id) return b;
      const items = (b.content[arrayKey] || []).slice();
      items.splice(index, 1);
      return { ...b, content: { ...b.content, [arrayKey]: items } };
    }) } : p) }));
    markDirty(selectedBlock.id);
  };
  const moveBlock = (block: any, dir: -1 | 1) => {
    const page = model.pages.find((p: any) => p.id === block.pageId);
    if (!page) return;
    const pageBlocks = [...page.blocks].sort((a: any, b: any) => a.sortOrder - b.sortOrder);
    const idx = pageBlocks.findIndex((b: any) => b.id === block.id);
    const target = idx + dir;
    if (idx < 0 || target < 0 || target >= pageBlocks.length) return;
    const a = pageBlocks[idx], b = pageBlocks[target];
    setModel((m: any) => ({ ...m, pages: m.pages.map((p: any) => p.id === page.id ? { ...p, blocks: p.blocks.map((x: any) => x.id === a.id ? { ...x, sortOrder: b.sortOrder } : x.id === b.id ? { ...x, sortOrder: a.sortOrder } : x) } : p) }));
    setDirty((prev) => ({ ...prev, [a.id]: true, [b.id]: true }));
  };
  const toggleHidden = async (block: any) => {
    const next = !block.hidden;
    try {
      await api("/sites/pages/" + block.pageId + "/blocks/" + block.id, { method: "PATCH", body: JSON.stringify({ hidden: next }) });
      setModel((m: any) => ({ ...m, pages: m.pages.map((p: any) => p.id === block.pageId ? { ...p, blocks: p.blocks.map((b: any) => b.id === block.id ? { ...b, hidden: next } : b) } : p) }));
      onNotice(next ? "Bloco oculto na página." : "Bloco visível novamente.");
    } catch (e) { onNotice(e instanceof Error ? e.message : "Não foi possível alterar a visibilidade."); }
  };
  const deleteBlock = async (block: any) => {
    const label = (block.content?.title || block.content?.headline || block.type || "bloco").toString().slice(0, 48);
    if (!window.confirm("Excluir o bloco “" + label + "”?")) return;
    try {
      await api("/sites/pages/" + block.pageId + "/blocks/" + block.id, { method: "DELETE" });
      clearDirty(block.id);
      setModel((m: any) => ({ ...m, pages: m.pages.map((p: any) => p.id === block.pageId ? { ...p, blocks: p.blocks.filter((b: any) => b.id !== block.id) } : p) }));
      if (selected === block.id) setSelected("");
      onNotice("Bloco excluído.");
    } catch (e) { onNotice(e instanceof Error ? e.message : "Não foi possível excluir o bloco."); }
  };
  const duplicateBlock = async (block: any) => {
    try {
      await api("/sites/pages/" + block.pageId + "/blocks", { method: "POST", body: JSON.stringify({ type: block.type, content: block.content }) });
      onSaved();
      onNotice("Bloco duplicado.");
    } catch (e) { onNotice(e instanceof Error ? e.message : "Não foi possível duplicar o bloco."); }
  };
  const addBlock = async (type: string) => {
    const page = studioPage; if (!page) return;
    const meta = BLOCKS_META[type];
    try {
      const baseContent = type === "freeLayout"
        ? { html: "<section><h2>Nova seção</h2></section>", css: "" }
        : type === "hero"
        ? { headline: "Um título claro e direto", sub: "Apoio curto que explica o benefício.", ctaLabel: "Quero conversar" }
        : type === "richText"
          ? { title: "Título da seção", body: "Escreva aqui o texto desta seção." }
          : type === "layout"
            ? { columns: [ { id: "c1", span: 12, direction: "column", align: "stretch", justify: "start", gap: 16, elements: [ { id: "e1", type: "text", tag: "h2", text: "Nova seção", align: "left" } ] } ] }
            : type === "services"
              ? { title: "O que fazemos", items: [{ title: "Serviço um", text: "Descrição curta do serviço." }] }
            : type === "cta"
              ? { title: "Pronto para começar?", sub: "Chama agora — é rápido.", ctaLabel: "Quero conversar" }
              : type === "layout"
                ? { columns: [ { id: "c1", span: 12, direction: "column", align: "stretch", justify: "start", gap: 16, elements: [ { id: "e1", type: "text", tag: "h2", text: "Nova seção", align: "left" } ] } ] }
                : type === "testimonials"
                  ? { title: "Quem confia na Véxora", items: [{ text: "Depoimento real de um cliente.", name: "Nome do cliente" }] }
                : type === "faq"
                  ? { title: "Perguntas frequentes", items: [{ question: "Quanto custa?", answer: "Varia por projeto — fale com a equipe." }] }
                  : {};
      await api("/sites/pages/" + page.id + "/blocks", { method: "POST", body: JSON.stringify({ type, content: baseContent }) });
      onSaved();
      onNotice("Bloco “" + (meta?.label ?? type) + "” adicionado.");
    } catch (e) { onNotice(e instanceof Error ? e.message : "Não foi possível adicionar o bloco."); }
  };
  const applyAi = async (block: any, text: string) => {
    setBusy(true);
    try {
      const res = await api<{ blockId: string; content: any }>("/sites/pages/" + block.pageId + "/blocks/" + block.id + "/ai", { method: "POST", body: JSON.stringify({ instruction: text }) });
      setModel((m: any) => ({ ...m, pages: m.pages.map((p: any) => p.id === block.pageId ? { ...p, blocks: p.blocks.map((b: any) => b.id === block.id ? { ...b, content: res.content } : b) } : p) }));
      clearDirty(block.id);
      onSaved();
      onNotice("Bloco atualizado pela IA.");
    } catch (e) { onNotice(e instanceof Error ? e.message : "Não foi possível aplicar a mudança."); }
    finally { setBusy(false); }
  };
  const saveAll = async () => {
    if (saving || dirtyCount === 0) return;
    setSaving(true);
    try {
      for (const id of Object.keys(dirty)) {
        const block = allBlocks.find((b: any) => b.id === id); if (!block) continue;
        await api("/sites/pages/" + block.pageId + "/blocks/" + block.id, { method: "PATCH", body: JSON.stringify({ content: block.content, sortOrder: block.sortOrder, hidden: block.hidden }) });
      }
      setDirty({});
      onSaved();
      onNotice("Alterações salvas.");
    } catch (e) { onNotice(e instanceof Error ? e.message : "Não foi possível salvar."); }
    finally { setSaving(false); }
  };
  const skills = [
    { label: "Hero premium", instruction: "Reescreva por completo: tom premium e direto, destaque o entregável, não o processo, e mude o CTA com urgência honesta." },
    { label: "FAQ robusto", instruction: "Troque as perguntas e respostas por 5 perguntas reais que clientes costumam fazer antes de contratar, com respostas confiantes mas sem prometer o que a empresa não entrega." },
    { label: "Depoimentos vivos", instruction: "Substitua os depoimentos por 3 depoimentos de clientes reais citando nome, contexto e resultado. Tom humano, sem exageros." },
    { label: "Clareza de valor", instruction: "Reescreva os textos do bloco deixando mais claro o benefício principal para o cliente: resultado, prazo e prova — não processo." },
    { label: "Adaptar ao WhatsApp", instruction: "Reescreva no tom de WhatsApp direto, sem formalidade de site, focando na conversa: resposta em minutos, orçamento sem compromisso." },
  ];
  const relayout = async () => {
    if (relayoutBusy) return;
    const homePage = studioPage;
    if (!homePage) { setRelayoutError("Nenhuma página encontrada."); return; }
    setRelayoutBusy(true); setRelayoutError("");
    try {
      const res = await api<{ blocks: number }>("/sites/" + site.id + "/pages/" + homePage.id + "/relayout", { method: "POST", body: JSON.stringify({ prompt: relayoutPrompt.trim(), referenceUrl: relayoutReferenceUrl.trim(), imageUrl: relayoutImageUrl }) });
      setRelayoutOpen(false);
      setRelayoutPrompt(""); setRelayoutReferenceUrl(""); setRelayoutImageUrl(""); setRelayoutAssistantDisabled(false);
      onNotice("Página transformada em premium (" + (res?.blocks ?? "?") + " blocos). Revise o resultado e salve o que quiser.");
      onSaved();
    } catch (e) {
      const disabled = e instanceof ApiError && e.code === "ASSISTANT_DISABLED";
      setRelayoutAssistantDisabled(disabled);
      setRelayoutError(e instanceof Error ? e.message : "Não foi possível transformar a página.");
    } finally { setRelayoutBusy(false); }
  };
  const enableAiAndRetry = async () => {
    if (relayoutAiFixing) return;
    setRelayoutAiFixing(true); setRelayoutError("");
    try {
      const configResponse = await fetch("/api/backend/assistant/config", { cache: "no-store" });
      const current = await configResponse.json().catch(() => null);
      if (!configResponse.ok) throw new Error(current?.message || "Não foi possível ler a configuração desta empresa.");
      const put = await fetch("/api/backend/assistant/config", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...current, enabled: true }) });
      const saved = await put.json().catch(() => null);
      if (!put.ok) {
        const message = Array.isArray(saved?.message) ? saved.message.join(" ") : saved?.message;
        throw new Error(message || "Não foi possível ativar a IA desta empresa (sem permissão). Peça ao proprietário ou admin para ativar em Agentes de IA → Configuração geral.");
      }
      setRelayoutAssistantDisabled(false);
      setRelayoutError("");
      await relayout();
    } catch (e) {
      setRelayoutError(e instanceof Error ? e.message : "Não foi possível ativar a IA desta empresa.");
    } finally { setRelayoutAiFixing(false); }
  };
  const studio = (
    <div className={"sites-studio" + (fullscreen ? " is-fullscreen" : "")}>
      <div className="sites-studio-toolbar">
        <div className="sites-studio-device-toggle" role="group" aria-label="Visualizar em">
          <button type="button" aria-pressed={device === "pc"} className={device === "pc" ? "active" : ""} onClick={() => setDevice("pc")}><Monitor size={13} aria-hidden="true" /> PC</button>
          <button type="button" aria-pressed={device === "phone"} className={device === "phone" ? "active" : ""} onClick={() => setDevice("phone")}><Smartphone size={13} aria-hidden="true" /> Celular</button>
        </div>
        <div className="sites-studio-toolbar-right">
          <button type="button" className="secondary-button" onClick={() => { const target = allBlocks.find((b: any) => b.pageId === studioPage?.id && b.type === "freeLayout") || allBlocks.find((b: any) => b.pageId === studioPage?.id && b.type === "layout"); if (target) { setSelected(target.id); } else { onNotice("Esta página ainda não tem um layout editável."); } }} title="Selecionar o layout da página"><Columns3 size={14} aria-hidden="true" /> Editar Layout</button>
          <label className="sites-field"><span>Página do Studio</span><select value={studioPage?.id || ""} onChange={event => { setStudioPageId(event.target.value); setSelected(""); }}>
            {model.pages.map((page: Page) => <option key={page.id} value={page.id}>{page.title}</option>)}
          </select></label>
          <button type="button" className="secondary-button" onClick={() => setRelayoutOpen(true)} title="A IA transforma a página em uma versão premium — com prompt, link de referência, imagem ou sem nada"><Wand2 size={14} aria-hidden="true" /> Relayout premium</button>
          <button type="button" className="icon-button" onClick={() => setFullscreen(v => !v)} aria-pressed={fullscreen} title={fullscreen ? "Sair da tela cheia (Esc)" : "Tela cheia — editar isolado de tudo"}>{fullscreen ? <Minimize2 size={16} aria-hidden="true" /> : <Maximize2 size={16} aria-hidden="true" />}</button>
          {dirtyCount > 0 ? <button type="button" className="primary-button sites-studio-save" disabled={saving} onClick={() => void saveAll()}>{saving ? "Salvando…" : "Salvar alterações (" + dirtyCount + ")"}</button> : <span className="sites-field-hint sites-studio-saved">Tudo salvo</span>}
        </div>
      </div>
      <div className="sites-studio-body">
        <aside className="sites-studio-blocks" aria-label="Blocos da página">
          <h3>Blocos</h3>
          {allBlocks.length === 0 ? <p className="sites-field-hint">Este site ainda não tem blocos.</p> : allBlocks.map((b: any) => (
            <div key={b.id} className={"sites-studio-item" + (selected === b.id ? " active" : "") + (b.hidden ? " is-hidden" : "")}>
              <button type="button" className="sites-studio-block-select" onClick={() => { setStudioPageId(b.pageId); setSelected(b.id); }}>
                <b>{(b.content?.title || b.content?.headline || b.type).toString().slice(0, 44)}</b>
                <small>{b.type} · {b.pageTitle}{b.hidden ? " · oculto" : ""}</small>
              </button>
              <div className="sites-studio-block-tools">
                <button type="button" aria-label="Mover acima" title="Mover para cima" onClick={() => moveBlock(b, -1)}><ChevronUp size={13} aria-hidden="true" /></button>
                <button type="button" aria-label="Mover abaixo" title="Mover para baixo" onClick={() => moveBlock(b, 1)}><ChevronDown size={13} aria-hidden="true" /></button>
                <button type="button" aria-label={b.hidden ? "Mostrar bloco" : "Ocultar bloco"} title={b.hidden ? "Mostrar" : "Ocultar"} onClick={() => void toggleHidden(b)}>{b.hidden ? <EyeOff size={13} aria-hidden="true" /> : <Eye size={13} aria-hidden="true" />}</button>
                <button type="button" aria-label="Duplicar bloco" title="Duplicar" onClick={() => void duplicateBlock(b)}><Copy size={13} aria-hidden="true" /></button>
                <button type="button" aria-label="Excluir bloco" title="Excluir" onClick={() => void deleteBlock(b)}><Trash2 size={13} aria-hidden="true" /></button>
              </div>
            </div>
          ))}
          <div className="sites-studio-add">
            <p className="sites-field-label">Adicionar bloco</p>
            <div className="sites-studio-add-grid">{["freeLayout","layout","hero","richText","services","testimonials","faq","cta","gallery","contact","spacer"].map((key) => <button key={key} type="button" className="sites-studio-add-chip" title={BLOCKS_META[key]?.hint} onClick={() => void addBlock(key)}>+ {BLOCKS_META[key]?.label ?? key}</button>)}</div>
          </div>
        </aside>
        <div className="sites-studio-preview">
          <div className={"sites-studio-frame" + (device === "phone" ? " is-phone" : "")}>
            <SitePreview site={studioPage ? { ...model, pages: [studioPage] } : model} highlightBlockId={selected} onBlockClick={(id) => setSelected(id)} />
          </div>
        </div>
        <div className="sites-studio-panel">
          {selectedBlock ? <>
            <div className="sites-studio-panel-head">
              <h3>Editar bloco</h3>
              <span className="sites-studio-panel-type">{BLOCKS_META[selectedBlock.type]?.label ?? selectedBlock.type}</span>
            </div>
            <div className="sites-studio-fields">
              {selectedBlock?.type === "freeLayout" ? (
                <FreeSiteEditor key={selectedBlock.id + JSON.stringify(selectedBlock.content)} content={selectedBlock.content}
                  onSave={content => replaceBlockContent(selectedBlock, content)}
                  onPrompt={instruction => applyAi(selectedBlock, instruction)} />
              ) : selectedBlock?.type === "layout" ? (
                <LayoutBlockEditor block={selectedBlock} onChange={(content) => replaceBlockContent(selectedBlock, content)} />
              ) : (<>
              {fieldDefs.fields.map((f) => <label key={f.key} className="sites-field"><span>{f.label}</span>{f.area ? <textarea rows={2} value={(selectedBlock.content?.[f.key] ?? "").toString()} onChange={(e) => setField(f.key, e.target.value)} /> : <input value={(selectedBlock.content?.[f.key] ?? "").toString()} onChange={(e) => setField(f.key, e.target.value)} />}</label>)}
              {selectedBlock?.type === "hero" && (() => {
                const design = (selectedBlock.content?.design || {}) as Record<string, unknown>;
                const setDesign = (key: string, value: unknown) => replaceBlockContent(selectedBlock, { ...(selectedBlock.content || {}), design: { ...design, [key]: value } });
                const colorValue = (key: string, fallback: string) => /^#[0-9a-f]{6}$/i.test(String(design[key] || "")) ? String(design[key]) : fallback;
                return (
                  <div className="sites-design-block">
                    <p className="sites-field-label">Design do hero — ao vivo</p>
                    <div className="layout-element-row">
                      <label className="sites-field"><span>Fundo (cor)</span><input type="color" value={colorValue("background", "#0A1730")} onChange={e => setDesign("background", e.target.value)} /></label>
                      <label className="sites-field"><span>Gradiente pronto</span><select value="" onChange={e => e.target.value && setDesign("background", e.target.value)}><option value="">Escolher…</option>{GRADIENTS.map(([label, value]) => <option key={label} value={value}>{label}</option>)}</select></label>
                      <label className="sites-field"><span>Fundo livre (CSS)</span><input value={String(design.background || "")} onChange={e => setDesign("background", e.target.value || undefined)} placeholder="linear-gradient(…)" /></label>
                    </div>
                    <div className="layout-element-row">
                      <label className="sites-field"><span>Alinhamento</span><select value={String(design.textAlign || "center")} onChange={e => setDesign("textAlign", e.target.value)}><option value="left">Esquerda</option><option value="center">Centro</option><option value="right">Direita</option></select></label>
                      <label className="sites-field"><span>Altura</span><select value={String(design.minHeight || "md")} onChange={e => setDesign("minHeight", e.target.value)}><option value="sm">Média</option><option value="md">Padrão</option><option value="lg">Tela cheia</option></select></label>
                      <label className="sites-field"><span>Cor do título</span><input type="color" value={colorValue("headlineColor", "#FFFFFF")} onChange={e => setDesign("headlineColor", e.target.value)} /></label>
                      <label className="sites-field"><span>Cor do subtítulo</span><input type="color" value={colorValue("subColor", "#A9BFE3")} onChange={e => setDesign("subColor", e.target.value)} /></label>
                    </div>
                    <div className="layout-element-row">
                      <label className="sites-field"><span>Cor do botão</span><input type="color" value={colorValue("buttonBackground", "#2E7CF6")} onChange={e => setDesign("buttonBackground", e.target.value)} /></label>
                      <label className="sites-field"><span>Texto do botão</span><input type="color" value={colorValue("buttonColor", "#FFFFFF")} onChange={e => setDesign("buttonColor", e.target.value)} /></label>
                      <label className="sites-field"><span>Selo (fundo)</span><input type="color" value={colorValue("badgeBackground", "#2E7CF6")} onChange={e => setDesign("badgeBackground", e.target.value)} /></label>
                      <button type="button" className="text-button" onClick={() => replaceBlockContent(selectedBlock, { ...(selectedBlock.content || {}), design: undefined })}>Limpar design</button>
                    </div>
                  </div>
                );
              })()}
              {fieldDefs.array ? <div className="sites-studio-array">
                <div className="sites-studio-array-head"><span className="sites-field-label">{fieldDefs.array.label}</span><button type="button" className="text-button sites-studio-add-item" onClick={() => addArrayItem(fieldDefs.array!.key)}>+ {fieldDefs.array.itemLabel}</button></div>
                {(Array.isArray(selectedBlock.content?.[fieldDefs.array.key]) ? selectedBlock.content[fieldDefs.array.key] : []).map((item: any, index: number) => <div key={index} className="sites-studio-array-item">
                  <div className="sites-studio-array-item-head"><span className="sites-studio-array-index">{fieldDefs.array!.itemLabel} {index + 1}</span><div className="sites-studio-array-tools"><button type="button" aria-label="Mover item acima" onClick={() => moveArrayItem(fieldDefs.array!.key, index, -1)}><ChevronUp size={13} aria-hidden="true" /></button><button type="button" aria-label="Mover item abaixo" onClick={() => moveArrayItem(fieldDefs.array!.key, index, 1)}><ChevronDown size={13} aria-hidden="true" /></button><button type="button" aria-label="Remover item" onClick={() => deleteArrayItem(fieldDefs.array!.key, index)}><Trash2 size={13} aria-hidden="true" /></button></div></div>
                  {fieldDefs.array!.fields.map((f) => <label key={f.key} className="sites-field"><span>{f.label}</span>{f.area ? <textarea rows={2} value={(item?.[f.key] ?? "").toString()} onChange={(e) => setArrayField(fieldDefs.array!.key, index, f.key, e.target.value)} /> : <input value={(item?.[f.key] ?? "").toString()} onChange={(e) => setArrayField(fieldDefs.array!.key, index, f.key, e.target.value)} />}</label>)}
                </div>)}
              </div> : null}
              </>)}
            </div>
            <div className="sites-studio-ai">
              <h4>Reescrever com IA</h4>
              <label className="sites-field"><span>O que mudar?</span>
                <textarea rows={3} value={instruction} onChange={e => setInstruction(e.target.value)} placeholder="Ex.: destaque o benefício principal e cite 1 prova real (número de clientes, prazo, resultado)." />
              </label>
              <button type="button" className="primary-button" disabled={busy || instruction.trim().length < 3} onClick={() => applyAi(selectedBlock, instruction.trim())}>{busy ? "Aplicando…" : "Aplicar com IA"}</button>
              <p className="sites-field-label">Skills rápidas</p>
              <div className="sites-studio-skills">{skills.map(s => <button key={s.label} type="button" disabled={busy} onClick={() => setInstruction(s.instruction)}>{s.label}</button>)}</div>
            </div>
          </> : <p className="sites-field-hint">Selecione um bloco no preview ou na lista à esquerda para editar.</p>}
        </div>
      </div>
      {relayoutOpen && (
        <div className="vx-dialog-backdrop sites-relayout-backdrop" role="presentation" onMouseDown={e => { if (e.target === e.currentTarget && !relayoutBusy) { setRelayoutOpen(false); } }}>
          <section className="vx-dialog sites-relayout" role="dialog" aria-modal="true" aria-labelledby="sites-relayout-title">
            <header className="vx-dialog-heading"><span className="vx-dialog-icon"><Wand2 size={20} aria-hidden="true" /></span><div><h2 id="sites-relayout-title">Relayout premium</h2><p>A IA transforma esta página em uma versão premium — com ou sem o seu pedido.</p></div><button type="button" className="vx-dialog-close" aria-label="Fechar" onClick={() => !relayoutBusy && setRelayoutOpen(false)}><X size={18} aria-hidden="true" /></button></header>
            <div className="vx-dialog-body">
              <label className="sites-field"><span>O que melhorar? (opcional)</span><textarea rows={3} value={relayoutPrompt} onChange={e => setRelayoutPrompt(e.target.value)} disabled={relayoutBusy} placeholder="Ex.: deixe mais premium e confiante, foco em agendar pelo WhatsApp, tom sério mas acolhedor." /></label>
              <label className="sites-field"><span>Link de referência (opcional)</span><input type="url" value={relayoutReferenceUrl} onChange={e => setRelayoutReferenceUrl(e.target.value)} disabled={relayoutBusy} placeholder="https://awwwards.com/sites/… ou qualquer site que você admira" /></label>
              <label className="sites-field"><span>Imagem de referência (opcional)</span>
                <span className="sites-relayout-image">
                  {relayoutImageUrl ? <img src={relayoutImageUrl} alt="Referência enviada" /> : null}
                  <input type="file" accept="image/*" disabled={relayoutBusy || relayoutUploading} onChange={async e => {
                    const file = e.target.files?.[0]; if (!file) return;
                    setRelayoutUploading(true); setRelayoutError("");
                    try { const data = new FormData(); data.append("file", file); const response = await fetch("/api/backend/sites/assets", { method: "POST", body: data }); const json = await response.json().catch(() => null); if (!response.ok) throw new Error(json?.message || "Falha no upload."); setRelayoutImageUrl(String(json?.url || "")); } catch (err) { setRelayoutError(err instanceof Error ? err.message : "Não foi possível enviar a imagem."); } finally { setRelayoutUploading(false); }
                  }} />
                  {relayoutImageUrl ? <button type="button" className="text-button" onClick={() => setRelayoutImageUrl("")}>Remover imagem</button> : null}
                </span>
              </label>
              {relayoutAssistantDisabled ? (
                <div className="sites-relayout-fix" role="alert">
                  <div className="sites-relayout-fix-text">
                    <strong>A IA da Véxora está desativada nesta empresa.</strong>
                    <span>O Relayout premium usa a IA desta empresa (agente Design Gráfico &amp; Web). Ative agora com 1 clique ou abra Configuração geral.</span>
                  </div>
                  <div className="sites-relayout-fix-actions">
                    <button type="button" className="primary-button" disabled={relayoutAiFixing || relayoutBusy || relayoutUploading} onClick={() => void enableAiAndRetry()}>{relayoutAiFixing ? <Loader2 size={15} className="vx-spin" aria-hidden="true" /> : <Sparkles size={15} aria-hidden="true" />} {relayoutAiFixing ? "Ativando…" : "Ativar a IA e aplicar"}</button>
                    <a className="text-button" href="/?module=Agentes%20de%20IA">Abrir Agentes de IA →</a>
                  </div>
                </div>
              ) : relayoutError ? <p role="alert" className="sites-error">{relayoutError}</p> : null}
              <p className="sites-field-hint">A IA mantém fatos, preços e contatos intactos e devolve blocos novos. A página é substituída atomically — se a IA falhar, nada muda.</p>
            </div>
            <footer className="vx-dialog-footer"><button type="button" className="secondary-button" disabled={relayoutBusy} onClick={() => setRelayoutOpen(false)}>Cancelar</button><button type="button" className="primary-button" disabled={relayoutBusy || relayoutUploading} onClick={() => void relayout()}>{relayoutBusy ? <Loader2 size={15} className="vx-spin" aria-hidden="true" /> : <Wand2 size={15} aria-hidden="true" />} {relayoutBusy ? "Transformando…" : "Transformar em premium"}</button></footer>
          </section>
        </div>
      )}
    </div>
  );
  return fullscreen ? createPortal(studio, document.body) : studio;
}

type PreviewSite = any;
function SiteMonogram({ name }: { name: string }) {
  const initials = name.trim().split(/\s+/).slice(0, 2).map(w => w[0]?.toUpperCase() || "").join("") || "S";
  return <b>{initials}</b>;
}

export function SiteDetail({ site, tab, setParams, onSaved, onNotice }: { site: Site; tab: string; setParams: (p: Record<string, string | null>) => void; onSaved: () => void; onNotice: (v: string) => void }) {
  const tabs = [["studio","Studio"],["pages","Páginas"],["posts","Posts"],["imoveis","Imóveis"],["files","Arquivos"],["forms","Formulários"],["appear","Aparência"],["publish","Publicar"],["settings","Site"]] as const;
  return (
    <>
      <header className="sites-detail-head">
        <SiteMonogram name={site.name} />
        <div><h1>{site.name}</h1><p>{AREAS.find(a => a.key === site.businessArea)?.label || site.businessArea} · {site.slug}</p></div>
        <div className="sites-detail-actions"><a className="secondary-button" href={"/sites/" + site.slug} target="_blank" rel="noopener noreferrer"><Eye size={15} aria-hidden="true" /> Visualizar</a></div>
      </header>
      <nav className="sites-tabs" aria-label="Editor do site">{tabs.map(([key, label]) => <button key={key} type="button" aria-pressed={tab === key} className={tab === key ? "active" : ""} onClick={() => setParams({ tab: key })}>{label}</button>)}</nav>
      {tab === "studio" ? <StudioEditor site={site} onSaved={onSaved} onNotice={onNotice} /> : tab === "pages" ? <PagesEditor site={site} onSaved={onSaved} onNotice={onNotice} /> : tab === "posts" ? <ItemsEditor site={site} kind="post" onSaved={onSaved} onNotice={onNotice} /> : tab === "imoveis" ? <ItemsEditor site={site} kind="property" onSaved={onSaved} onNotice={onNotice} /> : tab === "files" ? <FileManager onNotice={onNotice} /> : tab === "forms" ? <FormsEditor site={site} onSaved={onSaved} onNotice={onNotice} /> : tab === "appear" ? <Appearance site={site} onSaved={onSaved} onNotice={onNotice} /> : tab === "publish" ? <PublishPanel site={site} onSaved={onSaved} onNotice={onNotice} /> : <SettingsPanel site={site} onSaved={onSaved} onNotice={onNotice} />}
    </>
  );
}

function PagesEditor({ site, onSaved, onNotice }: { site: Site; onSaved: () => void; onNotice: (v: string) => void }) {
  const [pages, setPages] = useState<Page[]>(site.pages || []);
  const [selected, setSelected] = useState<string>(pages[0]?.id || "");
  useEffect(() => { setPages(site.pages || []); setSelected((site.pages || [])[0]?.id || ""); /* sync keyed by site id */ // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [site.id]);
  const page = pages.find(p => p.id === selected) || null;
  const [blockBusy, setBlockBusy] = useState(false);
  const saveBlockRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saveBlock = async (block: Block, patch: Partial<Block>) => {
    setBlockBusy(true);
    try { const body = { ...(patch.content !== undefined ? { content: patch.content } : {}), ...(patch.hidden !== undefined ? { hidden: patch.hidden } : {}), ...(patch.sortOrder !== undefined ? { sortOrder: patch.sortOrder } : {}) }; await api(`/sites/pages/${block.pageId}/blocks/${block.id}`, { method: "PATCH", body: JSON.stringify(body) }); }
    catch (e) { onNotice(e instanceof Error ? e.message : "Não foi possível salvar o bloco."); }
    finally { setBlockBusy(false); }
  };
  const saveBlockDebounced = (block: Block, patch: Partial<Block>) => {
    if (saveBlockRef.current) clearTimeout(saveBlockRef.current);
    // Atualização otimista na tela; a gravação ocorre após 600ms de silêncio.
    setPages(prev => prev.map(p => p.id === block.pageId ? { ...p, blocks: (p.blocks || []).map((b: Block) => b.id === block.id ? { ...b, ...(patch as any) } : b) } : p));
    saveBlockRef.current = setTimeout(() => { void saveBlock(block, patch); }, 600);
  };
  const moveBlock = async (block: Block, dir: -1 | 1) => {
    const list = [...(page?.blocks || [])].sort((a, b) => a.sortOrder - b.sortOrder);
    const idx = list.findIndex(b => b.id === block.id); const swap = idx + dir;
    if (swap < 0 || swap >= list.length) return;
    const other = list[swap]!;
    await Promise.all([api(`/sites/pages/${block.pageId}/blocks/${block.id}`, { method: "PATCH", body: JSON.stringify({ sortOrder: other.sortOrder }) }), api(`/sites/pages/${other.pageId}/blocks/${other.id}`, { method: "PATCH", body: JSON.stringify({ sortOrder: block.sortOrder }) })]);
    onSaved();
  };
  const addBlock = async (type: string) => { await api(`/sites/pages/${page!.id}/blocks`, { method: "POST", body: JSON.stringify({ type, content: type === "freeLayout" ? { html: "<section><h2>Nova seção</h2></section>", css: "" } : type === "layout" ? { columns: [ { id: "c1", span: 12, direction: "column", align: "stretch", justify: "start", gap: 16, elements: [ { id: "e1", type: "text", tag: "h2", text: "Nova seção", align: "left" } ] } ] } : {} }) }); onSaved(); onNotice("Bloco adicionado."); };
  const removeBlock = async (block: Block) => { await api(`/sites/pages/${block.pageId}/blocks/${block.id}`, { method: "DELETE" }); onSaved(); onNotice("Bloco removido."); };
  if (!page) return <div className="sites-empty"><LayoutTemplate size={24} aria-hidden="true" /><h2>Nenhuma página</h2></div>;
  return (
    <div className="sites-pages-grid">
      <aside className="sites-page-list" aria-label="Páginas">
        {[...pages].sort((a, b) => a.sortOrder - b.sortOrder).map(p => (
          <button key={p.id} type="button" className={"sites-page-item " + (p.id === selected ? "active" : "")} onClick={() => setSelected(p.id)}><span>{p.title}</span><small>/{p.slug}{p.hidden ? " · oculta" : ""}</small></button>
        ))}
      </aside>
      <div className="sites-canvas">
        <header className="sites-canvas-head">
          <h2>{page.title}</h2>
          <div>
            <label className="sites-visibility"><input type="checkbox" checked={!page.hidden} onChange={async e => { await api(`/sites/pages/${page.id}`, { method: "PATCH", body: JSON.stringify({ hidden: !e.target.checked }) }); onSaved(); }} /> Página visível</label>
            <button type="button" className="secondary-button" onClick={() => setSelected(page.id) /* keep */} onClickCapture={() => onNotice("Arraste ou use as setas para reordenar.")}>{blockBusy ? <Loader2 size={14} className="vx-spin" aria-hidden="true" /> : <ChevronUp size={14} aria-hidden="true" />} Reordenar com as setas</button>
          </div>
        </header>
        <div className="sites-blocks">
          {[...(page.blocks || [])].sort((a, b) => a.sortOrder - b.sortOrder).map(block => (
            <article key={block.id} className={"sites-block-card " + (block.hidden ? "is-hidden" : "")}>
              <header><span><b>{BLOCKS_META[block.type]?.label || block.type}</b><small>{block.type}</small></span><span className="sites-block-actions"><button type="button" className="icon-button" title="Mover para cima" aria-label="Mover para cima" onClick={() => void moveBlock(block, -1)}><ChevronUp size={15} aria-hidden="true" /></button><button type="button" className="icon-button" title="Mover para baixo" aria-label="Mover para baixo" onClick={() => void moveBlock(block, 1)}><ChevronDown size={15} aria-hidden="true" /></button><button type="button" className="icon-button" aria-pressed={block.hidden} title={block.hidden ? "Mostrar" : "Ocultar"} onClick={() => void saveBlock(block, { hidden: !block.hidden })}>{block.hidden ? <EyeOff size={15} aria-hidden="true" /> : <Eye size={15} aria-hidden="true" />}</button><button type="button" className="icon-button" title="Remover bloco" aria-label="Remover bloco" onClick={() => void removeBlock(block)}><Trash2 size={15} aria-hidden="true" /></button></span></header>
              <BlockEditor block={block} onChange={next => saveBlockDebounced(block, { content: next })} />
            </article>
          ))}
        </div>
        <footer className="sites-add-block"><span>Adicionar bloco</span>{Object.entries(BLOCKS_META).map(([type, meta]) => <button key={type} type="button" className="sites-add-chip" title={meta.hint} onClick={() => void addBlock(type)}><Plus size={13} aria-hidden="true" /> {meta.label}</button>)}</footer>
      </div>
    </div>
  );
}

function BlockEditor({ block, onChange }: { block: Block; onChange: (next: any) => void }) {
  const c = block.content || {};
  const set = (patch: Record<string, unknown>) => onChange({ ...c, ...patch });
  const itemList = (key: string, blank: any) => Array.isArray(c[key]) ? c[key] as any[] : (c[key] ? [c[key]] : [blank]);
  const row = <T extends Record<string, any>>(list: T[], onChange: (next: T[]) => void, render: (item: T, update: (patch: Partial<T>) => void) => React.ReactNode, addLabel = "Adicionar", blank: T) => (
    <div className="sites-item-list">
      {list.map((item, i) => <div key={i} className="sites-item-row">{render(item, patch => onChange(list.map((it, j) => j === i ? { ...it, ...patch } : it)))}<button type="button" className="icon-button" aria-label="Remover" onClick={() => onChange(list.filter((_, j) => j !== i))}><X size={13} aria-hidden="true" /></button></div>)}
      <button type="button" className="text-button" onClick={() => onChange([...list, { ...blank }])}><Plus size={12} aria-hidden="true" /> {addLabel}</button>
    </div>
  );
  switch (block.type) {
    case "freeLayout":
      return <FreeSiteEditor key={block.id} content={c} onSave={onChange} />;
    case "layout":
      return <LayoutBlockEditor block={block} onChange={(content) => onChange(content)} />;
    case "hero":
      return (<div className="sites-block-form"><label><span>Título</span><input value={c.headline || ""} onChange={e => set({ headline: e.target.value })} placeholder="Título principal da página" /></label><label><span>Subtítulo</span><input value={c.sub || ""} onChange={e => set({ sub: e.target.value })} placeholder="Texto de apoio" /></label><label><span>Selo (eyebrow)</span><input value={c.badge || ""} onChange={e => set({ badge: e.target.value })} placeholder="City · Segmento" /></label><label><span>Imagem de fundo (URL https)</span><input value={c.imageUrl || ""} onChange={e => set({ imageUrl: e.target.value })} placeholder="https://images.unsplash.com/…" /></label><label><span>Botão (texto)</span><input value={c.ctaLabel || ""} onChange={e => set({ ctaLabel: e.target.value })} placeholder="Quero conversar" /></label><label><span>Botão (link)</span><input value={c.ctaUrl || ""} onChange={e => set({ ctaUrl: e.target.value })} placeholder="https://wa.me/55…" /></label></div>);
    case "richText":
      return <div className="sites-block-form"><label><span>Título</span><input value={c.title || ""} onChange={e => set({ title: e.target.value })} placeholder="Título da seção" /></label><label><span>Texto (uma linha por parágrafo)</span><textarea rows={4} value={c.body || ""} onChange={e => set({ body: e.target.value })} placeholder="Escreva o texto aqui…" /></label></div>;
    case "services":
      return <div className="sites-block-form"><label><span>Título</span><input value={c.title || ""} onChange={e => set({ title: e.target.value })} placeholder="O que fazemos" /></label>{row(itemList("items", { title: "", text: "" }), items => set({ items }), (item, update) => <><input value={item.title} placeholder="Serviço" onChange={e => update({ title: e.target.value })} /><input value={item.text} placeholder="Descrição" onChange={e => update({ text: e.target.value })} /></>, "Adicionar serviço", { title: "", text: "" })}</div>;
    case "testimonials":
      return <div className="sites-block-form"><label><span>Título</span><input value={c.title || ""} onChange={e => set({ title: e.target.value })} placeholder="O que dizem de nós" /></label>{row(itemList("items", { name: "", text: "" }), items => set({ items }), (item, update) => <><input value={item.name} placeholder="Nome" onChange={e => update({ name: e.target.value })} /><input value={item.text} placeholder="Depoimento" onChange={e => update({ text: e.target.value })} /></>, "Adicionar depoimento", { name: "", text: "" })}</div>;
    case "faq":
      return <div className="sites-block-form"><label><span>Título</span><input value={c.title || ""} onChange={e => set({ title: e.target.value })} placeholder="Perguntas frequentes" /></label>{row(itemList("items", { question: "", answer: "" }), items => set({ items }), (item, update) => <><input value={item.question} placeholder="Pergunta" onChange={e => update({ question: e.target.value })} /><input value={item.answer} placeholder="Resposta" onChange={e => update({ answer: e.target.value })} /></>, "Adicionar pergunta", { question: "", answer: "" })}</div>;
    case "cta":
      return <div className="sites-block-form"><label><span>Título</span><input value={c.title || ""} onChange={e => set({ title: e.target.value })} placeholder="Pronto para começar?" /></label><label><span>Texto de apoio</span><input value={c.sub || ""} onChange={e => set({ sub: e.target.value })} placeholder="Texto de apoio do botão" /></label><label><span>Botão (texto)</span><input value={c.ctaLabel || ""} onChange={e => set({ ctaLabel: e.target.value })} /></label><label><span>Botão (link)</span><input value={c.ctaUrl || ""} onChange={e => set({ ctaUrl: e.target.value })} /></label></div>;
    case "gallery":
      return <div className="sites-block-form"><label><span>Título</span><input value={c.title || ""} onChange={e => set({ title: e.target.value })} placeholder="Galeria" /></label>{row(itemList("items", { url: "", caption: "" }), items => set({ items }), (item, update) => <><input value={item.url} placeholder="URL da imagem" onChange={e => update({ url: e.target.value })} /><input value={item.caption} placeholder="Legenda" onChange={e => update({ caption: e.target.value })} /></>, "Adicionar imagem", { url: "", caption: "" })}</div>;
    case "contact":
      return <div className="sites-block-form"><label><span>Título</span><input value={c.title || ""} onChange={e => set({ title: e.target.value })} placeholder="Fale com a gente" /></label><p className="sites-field-hint">Os WhatsApps e as redes aparecem automaticamente a partir dos departamentos cadastrados em Aparência.</p></div>;
    case "posts":
      return <div className="sites-block-form"><label><span>Título</span><input value={c.title || ""} onChange={e => set({ title: e.target.value })} placeholder="Últimas matérias" /></label><p className="sites-field-hint">Posts publicados aparecem aqui automaticamente.</p></div>;
    case "properties":
      return <div className="sites-block-form"><label><span>Título</span><input value={c.title || ""} onChange={e => set({ title: e.target.value })} placeholder="Imóveis disponíveis" /></label><p className="sites-field-hint">Imóveis publicados aparecem aqui automaticamente.</p></div>;
    case "spacer":
      return <div className="sites-block-form"><label><span>Altura (px)</span><input type="number" min={8} max={400} value={c.size || 48} onChange={e => set({ size: Number(e.target.value) || 48 })} /></label></div>;
    case "divider":
      return <div className="sites-block-form"><label><span>Estilo</span><select value={c.style || "solid"} onChange={e => set({ style: e.target.value })}><option value="solid">Linha sólida</option><option value="dashed">Tracejada</option></select></label></div>;
    default:
      return <div className="sites-block-form"><p>Bloco {block.type}</p><pre>{JSON.stringify(c, null, 2)}</pre></div>;
  }
}

function RealEstateTools({ onClose, siteId, onSaved, onNotice }: { onClose: () => void; siteId: string; onSaved: () => void; onNotice: (v: string) => void }) {
  const [options, setOptions] = useState<any>(null);
  const [scopes, setScopes] = useState<any[] | null>(null);
  const [newItems, setNewItems] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    void Promise.all([
      api<any>("/sites/real-estate/options").then(setOptions).catch(e => setError(e instanceof Error ? e.message : "Não foi possível carregar as listas.")),
      api<{ memberships: any[] }>("/sites/real-estate/scopes").then(d => setScopes(d.memberships || [])).catch(() => setScopes([])),
    ]).finally(() => setLoaded(true));
  }, []);
  const lists = options || { pretensions: [], types: { Urbano: [], Rural: [] }, regions: [], neighborhoods: [] };
  const updateList = (path: string, value: any) => setOptions((current: any) => {
    const next = JSON.parse(JSON.stringify(current || lists));
    const keys = path.split(".");
    let target = next;
    if (keys.length >= 1) target = next;
    for (let i = 0; i < keys.length - 1; i += 1) { const key = keys[i]!; target = target[key] ?? (target[key] = {}); }
    target[keys[keys.length - 1]!] = value;
    return next;
  });
  const addItem = (path: string) => {
    const value = (newItems[path] || "").trim();
    if (!value) return;
    const keys = path.split(".");
    const list = getPath(lists, path) || [];
    if (list.some((x: string) => x.toLowerCase() === value.toLowerCase())) { setError(`"${value}" já existe nesta lista.`); return; }
    if (keys.length === 2 && keys[0] === "types") updateList(path, [...list, value]);
    else updateList(path, [...list, value]);
    setNewItems(v => ({ ...v, [path]: "" }));
    setError("");
  };
  const removeItem = (path: string, index: number) => updateList(path, (getPath(lists, path) || []).filter((_: string, i: number) => i !== index));
  const saveOptions = async () => {
    setBusy(true); setError("");
    try { const saved = await api<any>("/sites/real-estate/options", { method: "PUT", body: JSON.stringify(lists) }); setOptions(saved); onNotice("Listas salvas. Tanto o site quanto os filtros públicos usam estas opções."); onSaved(); }
    catch (e) { setError(e instanceof Error ? e.message : "Não foi possível salvar."); } finally { setBusy(false); }
  };
  const toggleScope = async (membershipId: string, category: "Urbano" | "Rural", enable: boolean) => {
    setBusy(true); setError("");
    try { await api("/sites/real-estate/scopes", { method: "POST", body: JSON.stringify({ membershipId, category, enable }) }); const d = await api<{ memberships: any[] }>("/sites/real-estate/scopes"); setScopes(d.memberships || []); }
    catch (e) { setError(e instanceof Error ? e.message : "Não foi possível alterar o gestor."); } finally { setBusy(false); }
  };
  if (!loaded) return <div className="sites-field-hint" style={{ padding: 16 }}><Loader2 size={18} className="vx-spin" aria-hidden="true" /> Carregando listas…</div>;
  const listSection = (title: string, path: string, placeholder: string) => (
    <fieldset key={path} className="real-estate-list-section"><legend>{title}</legend>
      <div className="real-estate-list-chips">{(getPath(lists, path) || []).map((item: string, i: number) => (<span key={i} className="real-estate-chip">{item}<button type="button" aria-label={"Remover " + item} onClick={() => removeItem(path, i)}><X size={12} aria-hidden="true" /></button></span>))}</div>
      <div className="real-estate-list-add"><input value={newItems[path] || ""} onChange={e => setNewItems(v => ({ ...v, [path]: e.target.value }))} placeholder={placeholder} onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addItem(path); } }} /><button type="button" className="secondary-button" onClick={() => addItem(path)}>Adicionar</button></div>
    </fieldset>
  );
  return (
    <div className="vx-dialog-body real-estate-tools" style={{ maxHeight: "78vh", overflowY: "auto" }}>
      {error && <p role="alert" className="sites-error">{error}</p>}
      <p className="sites-field-hint">Crie novas categorias, pretensões e tipos sempre que precisar — eles valem para o cadastro, para os filtros do site público e para a pré-aprovação de anúncios.</p>
      {listSection("Pretensões (o que o anunciante quer)", "pretensions", "Ex.: Alugar")}
      {listSection("Tipos de imóveis — Urbano", "types.Urbano", "Ex.: Casa")}
      {listSection("Tipos de imóveis — Rural", "types.Rural", "Ex.: Chácara")}
      {listSection("Regiões / Bairros (agrupamentos)", "regions", "Ex.: Centro")}
      {listSection("Bairros (lista livre, se quiser)", "neighborhoods", "Ex.: Jardim América")}
      <div className="real-estate-tools-foot"><button type="button" className="primary-button" disabled={busy} onClick={() => void saveOptions()}>{busy ? <Loader2 size={14} className="vx-spin" aria-hidden="true" /> : <Check size={14} aria-hidden="true" />} Salvar listas</button></div>

      <p className="sites-field-label" style={{ marginTop: 14 }}>Gestores por categoria (quem gerencia o quê)</p>
      <p className="sites-field-hint">Sem escopo marcado, o membro enxerga tudo (conforme o papel). Marque <b>Urbano</b> e/ou <b>Rural</b> para restringir um gestor àquelas categorias — ele não verá, editará ou excluirá dados da outra. Admin continua vendo tudo.</p>
      <div className="real-estate-scopes">
        {(scopes || []).map(m => (
          <div key={m.id} className="real-estate-scope-row">
            <span><strong>{m.user?.name || m.userId}</strong><small>{m.role}</small></span>
            <label className="ai-toggle"><input type="checkbox" checked={(m.scopes || []).includes("Urbano")} onChange={e => void toggleScope(m.id, "Urbano", e.target.checked)} /> Urbano</label>
            <label className="ai-toggle"><input type="checkbox" checked={(m.scopes || []).includes("Rural")} onChange={e => void toggleScope(m.id, "Rural", e.target.checked)} /> Rural</label>
          </div>
        ))}
        {scopes && !scopes.length && <p className="sites-field-hint">Nenhum membro ativo na empresa.</p>}
      </div>
    </div>
  );
}
function getPath(obj: any, path: string): any {
  return path.split(".").reduce((acc, key) => (acc && acc[key] !== undefined ? acc[key] : []), obj) as any;
}

function PropertyApplications({ siteId, onNotice }: { siteId: string; onNotice: (v: string) => void }) {
  const [apps, setApps] = useState<any[] | null>(null);
  const [busyId, setBusyId] = useState("");
  const [reason, setReason] = useState<Record<string, string>>({});
  const load = useCallback(async () => {
    try { const list = await api<any[]>("/sites/" + siteId + "/property-applications?status=PENDING"); setApps(Array.isArray(list) ? list : []); }
    catch { setApps([]); }
  }, [siteId]);
  useEffect(() => { void load(); }, [load]);
  const approve = async (id: string) => { setBusyId(id); try { await api("/sites/" + siteId + "/property-applications/" + id + "/approve", { method: "POST" }); onNotice("Anúncio aprovado — o imóvel foi criado como rascunho (sem publicar) e o anunciante foi notificado por e-mail/WhatsApp."); await load(); } catch (e) { onNotice(e instanceof Error ? e.message : "Não foi possível aprovar."); } finally { setBusyId(""); } };
  const reject = async (id: string) => { const r = (reason[id] || "").trim(); if (r.length < 3) { onNotice("Escreva o motivo da reprovação (ex.: faltam fotos do imóvel) para o anunciante entender."); return; } setBusyId(id); try { await api("/sites/" + siteId + "/property-applications/" + id + "/reject", { method: "POST", body: JSON.stringify({ reason: r }) }); onNotice("Anúncio reprovado. O motivo foi enviado por e-mail e WhatsApp (se conectado)."); await load(); } catch (e) { onNotice(e instanceof Error ? e.message : "Não foi possível reprovar."); } finally { setBusyId(""); } };
  if (apps === null) return <p className="sites-field-hint"><Loader2 size={15} className="vx-spin" aria-hidden="true" /> Carregando solicitações…</p>;
  if (!apps.length) return <p className="sites-field-hint">Nenhuma solicitação de anúncio pendente. Quando alguém pedir para anunciar em “{siteId ? "anunciar" : "anunciar"}”, ela aparece aqui.</p>;
  return (
    <div className="property-applications">
      <p className="sites-field-label">Anúncios pré-aprovados aguardando análise · {apps.length}</p>
      {apps.map(app => (
        <article key={app.id} className="property-application">
          <div className="property-application-head">
            <div><strong>{app.name}</strong><small>{app.phone} · {app.email}</small></div>
            <span className="status-pill">{app.pretension} · {app.propertyType}</span>
          </div>
          <p className="property-application-meta">{app.category}{app.region ? " · " + app.region : ""}{app.neighborhood ? " · " + app.neighborhood : ""}{app.city ? " · " + app.city : ""} · {app.bedrooms ?? app.beds ?? 0} dorm · {app.bathrooms ?? app.baths ?? 0} ban{app.parkingSpaces ? " · " + app.parkingSpaces + " vagas" : ""}{app.areaM2 ? " · " + app.areaM2 + " m²" : ""}{app.price ? " · " + app.price : ""}</p>
          {app.description && <p className="property-application-desc">{app.description}</p>}
          <textarea rows={2} placeholder="Motivo da reprovação (obrigatório para reprovar)…" value={reason[app.id] || ""} onChange={e => setReason(v => ({ ...v, [app.id]: e.target.value }))} />
          <div className="property-application-actions">
            <button type="button" className="secondary-button" disabled={busyId === app.id} onClick={() => void reject(app.id)}>{busyId === app.id ? <Loader2 size={13} className="vx-spin" aria-hidden="true" /> : null} Reprovar</button>
            <button type="button" className="primary-button" disabled={busyId === app.id} onClick={() => void approve(app.id)}>{busyId === app.id ? <Loader2 size={13} className="vx-spin" aria-hidden="true" /> : null} Aprovar anúncio</button>
          </div>
        </article>
      ))}
    </div>
  );
}

function ItemsEditor({ site, kind, onSaved, onNotice }: { site: Site; kind: "post" | "property"; onSaved: () => void; onNotice: (v: string) => void }) {
  const items = (site.items || []).filter((i: Item) => i.kind === kind);
  const [editing, setEditing] = useState<Item | null>(null);
  const [form, setForm] = useState<Record<string, any>>({});
  const [coverPickerOpen, setCoverPickerOpen] = useState(false);
  const [toolsOpen, setToolsOpen] = useState(false);
  const [appsOpen, setAppsOpen] = useState(false);
  const [options, setOptions] = useState<any>(null);
  useEffect(() => { if (kind === "property") { void api("/sites/real-estate/options").then(setOptions).catch(() => setOptions({})); } }, [kind]);
  const reset = (i: Item | null) => { setEditing(i); const existingImages = Array.isArray(i?.data?.images) ? (i.data.images as any[]).map((img: any) => ({ url: String(img?.url || ""), alt: String(img?.alt || "") })).filter(img => img.url) : (i?.coverUrl ? [{ url: i.coverUrl, alt: "" }] : []); setForm(i ? { title: i.title, excerpt: i.excerpt || "", coverUrl: existingImages[0]?.url || i.coverUrl || "", price: i.data?.price || "", location: i.data?.location || "", body: i.data?.body || "", beds: i.data?.beds || "", baths: i.data?.baths || "", area: i.data?.area || "", parkingSpaces: i.data?.parkingSpaces || "", city: i.data?.city || "", pretension: i.data?.pretension || "", category: i.data?.category || "", propertyType: i.data?.propertyType || "", region: i.data?.region || "", neighborhood: i.data?.neighborhood || "", code: i.data?.code || "", status: i.data?.status || "AVAILABLE", images: existingImages } : { title: "", excerpt: "", coverUrl: "", price: "", location: "", body: "", beds: "", baths: "", area: "", parkingSpaces: "", city: "", pretension: "", category: "", propertyType: "", region: "", neighborhood: "", code: "", status: "AVAILABLE", images: [] }); };
  const propertyPayload = () => ({ price: form.price, location: form.location, beds: form.beds, baths: form.baths, area: form.area, parkingSpaces: form.parkingSpaces, city: form.city, pretension: form.pretension, category: form.category, propertyType: form.propertyType, region: form.region, neighborhood: form.neighborhood, code: form.code, status: form.status || "AVAILABLE", body: form.body, images: Array.isArray(form.images) ? form.images : [] });
  const save = async () => {
    const images = Array.isArray(form.images) ? form.images.filter((img: any) => img?.url) : [];
    const cover = images[0]?.url || form.coverUrl || undefined;
    const payload = { title: form.title, excerpt: form.excerpt, coverUrl: cover, data: kind === "property" ? propertyPayload() : { body: form.body, images } };
    if (editing) await api(`/sites/items/${editing.id}`, { method: "PATCH", body: JSON.stringify(payload) }); else await api(`/sites/${site.id}/items`, { method: "POST", body: JSON.stringify({ ...payload, kind }) });
    onNotice(editing ? "Atualizado." : "Criado."); onSaved();
  };
  const remove = async (i: Item) => { await api(`/sites/items/${i.id}`, { method: "DELETE" }); onSaved(); onNotice("Excluído."); };
  return (
    <div className="sites-items-grid">
      <div className="sites-items-list">
        {kind === "property" && <div className="property-manage-toolbar">
          <button type="button" className="secondary-button" onClick={() => setToolsOpen(true)}><LayoutGrid size={14} aria-hidden="true" /> Listas e gestores</button>
          <button type="button" className="secondary-button" onClick={() => setAppsOpen(v => !v)}><Bell size={14} aria-hidden="true" /> Anúncios {appsOpen ? "▲" : "▼"}</button>
        </div>}
        {kind === "property" && appsOpen && <PropertyApplications siteId={site.id} onNotice={onNotice} />}
        {items.length ? items.map((i: Item) => (<article key={i.id} className="sites-item-card"><div><strong>{i.title}</strong><small>{kind === "post" ? (i.excerpt || "Sem resumo") : [i.data?.price ? formatBRL(i.data.price) : null, i.data?.neighborhood, i.data?.city, i.data?.status && i.data.status !== "AVAILABLE" ? ({ SOLD: "Vendido", RENTED: "Alugado", UNAVAILABLE: "Indisponível" } as Record<string, string>)[i.data.status] || null : null].filter(Boolean).join(" · ") || "Sem detalhes"}</small></div><span><button type="button" className="text-button" onClick={() => reset(i)}>Editar</button><button type="button" className="icon-button" aria-label="Excluir" onClick={() => void remove(i)}><Trash2 size={14} aria-hidden="true" /></button></span></article>)) : <p className="sites-field-hint">{kind === "post" ? "Nenhuma matéria publicada." : "Nenhum imóvel publicado."}</p>}
        <button type="button" className="primary-button" onClick={() => reset(null)}><Plus size={15} aria-hidden="true" /> {kind === "post" ? "Nova matéria" : "Novo imóvel"}</button>
      </div>
      <form className="sites-item-form" onSubmit={e => { e.preventDefault(); void save(); }}>
        <h3>{editing ? "Editar" : "Novo"} {kind === "post" ? "matéria" : "imóvel"}</h3>
        <label><span>Título</span><input value={form.title || ""} onChange={e => setForm(v => ({ ...v, title: e.target.value }))} placeholder={kind === "post" ? "Título da matéria" : "Apartamento 3 quartos · Jardins"} required /></label>
        {kind === "property" && <>
          <div className="sites-inline-fields property-management">
            <label><span>Preço</span><input inputMode="numeric" value={form.price || ""} onChange={e => setForm(v => ({ ...v, price: maskBRLInput(e.target.value) }))} placeholder="1.220.345,56" /></label>
            <label><span>Código</span><input value={form.code || ""} onChange={e => setForm(v => ({ ...v, code: e.target.value.slice(0, 40) }))} placeholder="IMO-0001 (auto se vazio)" /></label>
            <label><span>Status</span><select value={form.status || "AVAILABLE"} onChange={e => setForm(v => ({ ...v, status: e.target.value }))}><option value="AVAILABLE">Disponível</option><option value="SOLD">Vendido</option><option value="RENTED">Alugado</option><option value="UNAVAILABLE">Indisponível</option></select></label>
          </div>
          <div className="sites-inline-fields property-segmentation">
            <label><span>Cidade</span><input value={form.city || ""} onChange={e => setForm(v => ({ ...v, city: e.target.value }))} placeholder="Alto Araguaia" /></label>
            <label><span>Pretensão</span><select value={form.pretension || ""} onChange={e => setForm(v => ({ ...v, pretension: e.target.value }))}><option value="">—</option>{((options?.pretensions) || ["Comprar","Alugar","Vender","Emprestar","Trocar","Doar"]).map((p: string) => <option key={p} value={p}>{p}</option>)}</select></label>
            <label><span>Categoria</span><select value={form.category || ""} onChange={e => { const category = e.target.value; const firstType = category === "Rural" ? (options?.types?.Rural || ["Chácara"])[0] : (options?.types?.Urbano || ["Casa"])[0]; setForm(v => ({ ...v, category, propertyType: category && !v.propertyType ? firstType : v.propertyType })); }}><option value="">—</option><option value="Urbano">Urbano</option><option value="Rural">Rural</option></select></label>
            <label><span>Tipo</span><select value={form.propertyType || ""} onChange={e => setForm(v => ({ ...v, propertyType: e.target.value }))}><option value="">—</option>{((options?.types?.[form.category]) || (form.category === "Rural" ? ["Área","Chácara","Fazenda","Terreno","Gado"] : ["Salão","Sobrado","Casa","Kitnet","Terreno","Galpão","Prédio","Sala","Apartamento","Sala Comercial"])).map((t: string) => <option key={t} value={t}>{t}</option>)}</select></label>
          </div>
          <div className="sites-inline-fields property-segmentation">
            <label><span>Região</span><input list="real-estate-regions" value={form.region || ""} onChange={e => setForm(v => ({ ...v, region: e.target.value }))} placeholder="Centro" /><datalist id="real-estate-regions">{(options?.regions || []).map((r: string) => <option key={r} value={r} />)}</datalist></label>
            <label><span>Bairro</span><input list="real-estate-neighborhoods" value={form.neighborhood || ""} onChange={e => setForm(v => ({ ...v, neighborhood: e.target.value }))} placeholder="Jardim América" /><datalist id="real-estate-neighborhoods">{(options?.neighborhoods || []).map((r: string) => <option key={r} value={r} />)}</datalist></label>
          </div>
          <div className="sites-inline-fields property-details"><label><span>Quartos</span><input type="number" min={0} value={form.beds || ""} onChange={e => setForm(v => ({ ...v, beds: e.target.value }))} /></label><label><span>Banheiros</span><input type="number" min={0} value={form.baths || ""} onChange={e => setForm(v => ({ ...v, baths: e.target.value }))} /></label><label><span>Vagas</span><input type="number" min={0} value={form.parkingSpaces || ""} onChange={e => setForm(v => ({ ...v, parkingSpaces: e.target.value }))} /></label><label><span>Área (m²)</span><input type="number" min={0} value={form.area || ""} onChange={e => setForm(v => ({ ...v, area: e.target.value }))} /></label></div>
        </>}
        <label><span>Resumo</span><input value={form.excerpt || ""} onChange={e => setForm(v => ({ ...v, excerpt: e.target.value }))} placeholder="Uma frase vendendo a matéria/imóvel" /></label>
        {kind === "property" ? (() => {
          const images: { url: string; alt: string }[] = Array.isArray(form.images) ? form.images : [];
          const setImages = (next: { url: string; alt: string }[]) => setForm(v => ({ ...v, images: next, coverUrl: next[0]?.url || "" }));
          const setCover = (index: number) => { if (index <= 0) return; const next = images.slice(); const [picked] = next.splice(index, 1); if (picked) next.unshift(picked); setImages(next); };
          const moveImage = (index: number, dir: -1 | 1) => { const target = index + dir; if (target < 0 || target >= images.length) return; const next = images.slice(); const [item] = next.splice(index, 1); if (!item) return; next.splice(target, 0, item); setImages(next); };
          const removeImage = async (index: number) => {
            const target = images[index];
            setImages(images.filter((_, j) => j !== index));
            const match = typeof target?.url === "string" ? target.url.match(/\/site-assets\/([0-9a-f-]{36})/i) : null;
            if (match && window.confirm("Excluir também do servidor? A imagem sumirá de qualquer lugar onde foi usada.")) {
              try { await api(`/sites/assets/${match[1]}`, { method: "DELETE" }); onNotice("Imagem excluída do servidor."); }
              catch { onNotice("Não foi possível excluir do servidor — exclua em Arquivos."); }
            }
          };
          return (
            <div className="property-images">
              <p className="sites-field-label">Imagens do imóvel {images.length ? `· ${images.length} no total` : ""}</p>
              <p className="sites-field-hint">A <b>primeira</b> imagem vira a capa e o fundo do topo. Use “Definir capa” para escolher outra. Excluir remove do post — com a opção de sumir também do servidor.</p>
              <div className="property-images-grid">
                {images.map((img, index) => (
                  <figure key={index} className="property-image-card">
                    <img src={img.url} alt={img.alt || "Foto do imóvel"} loading="lazy" />
                    {index === 0 && <span className="property-cover-badge">CAPA</span>}
                    <div className="property-image-card-actions">
                      {index > 0 && <button type="button" className="icon-button" title="Definir como capa" aria-label="Definir como capa" onClick={() => setCover(index)}><Star size={13} aria-hidden="true" /></button>}
                      <button type="button" className="icon-button" title="Mover para a esquerda" aria-label="Mover para a esquerda" onClick={() => moveImage(index, -1)}><ChevronUp size={13} aria-hidden="true" /></button>
                      <button type="button" className="icon-button" title="Mover para a direita" aria-label="Mover para a direita" onClick={() => moveImage(index, 1)}><ChevronDown size={13} aria-hidden="true" /></button>
                      <button type="button" className="icon-button" title="Excluir (com opção de remover também do servidor)" aria-label="Excluir imagem" onClick={() => void removeImage(index)}><Trash2 size={13} aria-hidden="true" /></button>
                    </div>
                  </figure>
                ))}
                <button type="button" className="property-image-add" onClick={() => setCoverPickerOpen(true)}><Plus size={18} aria-hidden="true" /><span>Adicionar imagens</span></button>
              </div>
              <FileImagePicker open={coverPickerOpen} onClose={() => setCoverPickerOpen(false)} multiple title="File manager · Imagens do imóvel" onSelect={(urls) => { const added = urls.map(u => ({ url: u, alt: decodeURIComponent(u.split("/").pop() || "Imagem").replace(/\.[a-z0-9]+$/i, "") })); setImages([...images, ...added]); }} />
            </div>
          );
        })()
        : (<>
          <label><span>Capa do post (File manager)</span>
            <div className="cover-picker">
              {form.coverUrl ? <img src={form.coverUrl} alt="Imagem de capa" /> : <div className="cover-picker-empty"><ImagePlus size={22} aria-hidden="true" /><span>Escolha do File manager ou envie do PC/celular — sem links externos.</span></div>}
              <div className="cover-picker-actions">
                <button type="button" className="secondary-button" onClick={() => setCoverPickerOpen(true)}>{form.coverUrl ? "Trocar imagem" : "Escolher imagem"}</button>
                {form.coverUrl && <button type="button" className="text-button" onClick={() => setForm(v => ({ ...v, coverUrl: "" }))}>Remover capa</button>}
              </div>
            </div>
          </label>
          <FileImagePicker open={coverPickerOpen} onClose={() => setCoverPickerOpen(false)} title="File manager · capa do post" onSelect={(urls) => { const url = urls[0]; if (url) setForm(v => ({ ...v, coverUrl: url })); }} />
        </>)}
        <label><span>Corpo do texto</span><PostBodyEditor value={form.body || ""} onChange={html => setForm(v => ({ ...v, body: html }))} aria-label={kind === "post" ? "Corpo do post" : "Descrição do imóvel"} placeholder="Escreva o conteúdo completo…" /></label>
        <button type="submit" className="primary-button">{editing ? "Salvar alterações" : "Publicar"}</button>
      </form>
      {toolsOpen && createPortal(
        <div className="vx-dialog-backdrop" role="presentation" onMouseDown={e => { if (e.target === e.currentTarget) setToolsOpen(false); }}>
          <section className="vx-dialog" role="dialog" aria-modal="true" aria-label="Listas e gestores de categoria">
            <header className="vx-dialog-heading"><span className="vx-dialog-icon"><LayoutGrid size={20} aria-hidden="true" /></span><div><h2>Listas e gestores</h2><p>Categorias, pretensões, tipos, bairros e quem gere cada categoria.</p></div><button type="button" className="vx-dialog-close" aria-label="Fechar" onClick={() => setToolsOpen(false)}><X size={18} aria-hidden="true" /></button></header>
            <RealEstateTools onClose={() => setToolsOpen(false)} siteId={site.id} onSaved={onSaved} onNotice={onNotice} />
            <footer className="vx-dialog-footer"><button type="button" className="secondary-button" onClick={() => setToolsOpen(false)}>Concluir</button></footer>
          </section>
        </div>,
        document.body,
      )}
    </div>
  );
}

function FormsEditor({ site, onSaved, onNotice }: { site: Site; onSaved: () => void; onNotice: (v: string) => void }) {
  const [submissions, setSubmissions] = useState<any[]>([]);
  useEffect(() => { api<any[]>(`/sites/${site.id}/submissions`).then(setSubmissions).catch(() => setSubmissions([])); }, [site.id]);
  const [editing, setEditing] = useState<any | null>(null);
  const [name, setName] = useState("");
  const [fields, setFields] = useState<{ id: string; label: string; type: string; required: boolean; options?: string[] }[]>([]);
  const [targets, setTargets] = useState<{ kind: string; to?: string }[]>([{ kind: "precadastro" }]);
  const reset = (f: any | null) => { setEditing(f); setName(f?.name || ""); setFields(f?.fields || [{ id: "nome", label: "Seu nome", type: "text", required: true }]); setTargets(f?.targets || [{ kind: "precadastro" }]); };
  const save = async () => { const payload = { name, fields, targets }; if (editing) await api(`/sites/forms/${editing.id}`, { method: "PATCH", body: JSON.stringify(payload) }); else await api(`/sites/${site.id}/forms`, { method: "POST", body: JSON.stringify(payload) }); onNotice("Formulário salvo."); onSaved(); };
  const remove = async (f: any) => { await api(`/sites/forms/${f.id}`, { method: "DELETE" }); onSaved(); onNotice("Excluído."); };
  return (
    <div className="sites-forms-grid">
      <div className="sites-forms-list"><h3>Formulários</h3>{(site.forms || []).map((f: Form) => <article key={f.id} className="sites-item-card"><div><strong>{f.name}</strong><small>{(f.fields || []).length} campos · destino: {(f.targets || []).map((t: any) => t.kind).join(", ") || "nenhum"}</small></div><span><button type="button" className="text-button" onClick={() => reset(f)}>Editar</button><button type="button" className="icon-button" aria-label="Excluir" onClick={() => void remove(f)}><Trash2 size={14} aria-hidden="true" /></button></span></article>)}<button type="button" className="primary-button" onClick={() => reset(null)}><Plus size={15} aria-hidden="true" /> Novo formulário</button>
        <h3 className="sites-submissions-title">Pré-cadastros recebidos <span className="sites-pill">{submissions.length}</span></h3>
        {submissions.length ? submissions.slice(0, 30).map((s: any) => <article key={s.id} className="sites-submission"><header><strong>{s.form?.name || "Formulário"}</strong><time>{new Date(s.createdAt).toLocaleString("pt-BR")}</time></header><pre>{JSON.stringify(s.values, null, 2)}</pre></article>) : <p className="sites-field-hint">Quando alguém preencher o formulário no site, o pré-cadastro aparece aqui.</p>}
      </div>
      <form className="sites-item-form" onSubmit={e => { e.preventDefault(); void save(); }}>
        <h3>{editing ? "Editar formulário" : "Novo formulário"}</h3>
        <label><span>Nome</span><input value={name} onChange={e => setName(e.target.value)} placeholder="Fale conosco" required /></label>
        <fieldset className="sites-block"><legend>Campos</legend>
          {fields.map((field, i) => (<div key={i} className="sites-row sites-row--compact"><input value={field.label} placeholder="Rótulo" onChange={e => setFields(v => v.map((f, j) => j === i ? { ...f, label: e.target.value } : f))} /><select value={field.type} onChange={e => setFields(v => v.map((f, j) => j === i ? { ...f, type: e.target.value } : f))}>{["text","email","phone","textarea","select","checkbox"].map(t => <option key={t} value={t}>{t}</option>)}</select><label className="sites-required"><input type="checkbox" checked={field.required} onChange={e => setFields(v => v.map((f, j) => j === i ? { ...f, required: e.target.checked } : f))} /> obrigatório</label><button type="button" className="icon-button" aria-label="Remover campo" onClick={() => setFields(fields.filter((_, j) => j !== i))}><X size={13} aria-hidden="true" /></button></div>))}
          <button type="button" className="text-button" onClick={() => setFields([...fields, { id: "campo_" + Date.now(), label: "Novo campo", type: "text", required: false }])}><Plus size={12} aria-hidden="true" /> Adicionar campo</button>
        </fieldset>
        <fieldset className="sites-block"><legend>Enviar para</legend>
          {["precadastro","email","whatsapp"].map(kind => { const checked = targets.some(t => t.kind === kind); const target = targets.find(t => t.kind === kind); return (<div key={kind} className="sites-target"><label><input type="checkbox" checked={checked} onChange={e => setTargets(v => e.target.checked ? [...v, { kind, to: "" }] : v.filter(t => t.kind !== kind))} /> {kind === "precadastro" ? "Pré-cadastro no site (fica salvo aqui)" : kind === "email" ? "E-mail" : "WhatsApp"}</label>{kind !== "precadastro" && checked && <input value={target?.to || ""} onChange={e => setTargets(v => v.map(t => t.kind === kind ? { ...t, to: e.target.value } : t))} placeholder={kind === "email" ? "vendas@empresa.com.br" : "5562999990001"} />}</div>); })}
        </fieldset>
        <button type="submit" className="primary-button">Salvar formulário</button>
      </form>
    </div>
  );
}

function Appearance({ site, onSaved, onNotice }: { site: Site; onSaved: () => void; onNotice: (v: string) => void }) {
  const [departments, setDepartments] = useState<{ platform: string; label: string; handle: string; url: string }[]>(Array.isArray(site.departments) ? site.departments : []);
  const [name, setName] = useState(site.name);
  const [primaryColor, setPrimaryColor] = useState(site.primaryColor);
  const [accentColor, setAccentColor] = useState(site.accentColor);
  const [logoUrl, setLogoUrl] = useState(site.logoUrl || "");
  const [saving, setSaving] = useState(false);
  const save = async () => { setSaving(true); try { await api(`/sites/${site.id}`, { method: "PATCH", body: JSON.stringify({ name, primaryColor, accentColor, logoUrl, departments }) }); onNotice("Aparência salva."); onSaved(); } catch (e) { onNotice(e instanceof Error ? e.message : "Não foi possível salvar."); } finally { setSaving(false); } };
  return (<form className="sites-appearance" onSubmit={e => { e.preventDefault(); void save(); }}>
    <div className="sites-preview" style={{ background: `linear-gradient(135deg, ${primaryColor}, ${accentColor})` }} aria-hidden="true"><span>{name || "Site"}</span></div>
    <div className="sites-appearance-grid">
      <label><span>Nome exibido</span><input value={name} onChange={e => setName(e.target.value)} /></label>
      <label><span>URL do logo (opcional)</span><input value={logoUrl} onChange={e => setLogoUrl(e.target.value)} placeholder="https://…" /></label>
      <label><span>Cor principal</span><input type="color" value={primaryColor} onChange={e => setPrimaryColor(e.target.value)} /></label>
      <label><span>Cor de destaque</span><input type="color" value={accentColor} onChange={e => setAccentColor(e.target.value)} /></label>
    </div>
    <fieldset className="sites-block"><legend><Building2 size={13} aria-hidden="true" /> Departamentos e redes</legend>
      <p className="sites-field-hint">Aparecem no bloco de contato do site. Você pode ter um WhatsApp por departamento, além de Instagram e Facebook.</p>
      {departments.map((d, i) => (<div key={i} className="sites-row sites-row--compact"><select value={d.platform} onChange={e => setDepartments(v => v.map((x, j) => j === i ? { ...x, platform: e.target.value } : x))}>{["whatsapp","instagram","facebook","linkedin","youtube","telegram","email","phone"].map(p => <option key={p} value={p}>{p}</option>)}</select><input value={d.label} placeholder="Departamento (ex.: Comercial)" onChange={e => setDepartments(v => v.map((x, j) => j === i ? { ...x, label: e.target.value } : x))} /><input value={d.handle} placeholder="@ ou link" onChange={e => setDepartments(v => v.map((x, j) => j === i ? { ...x, handle: e.target.value } : x))} /><button type="button" className="icon-button" aria-label="Remover" onClick={() => setDepartments(departments.filter((_, j) => j !== i))}><X size={13} aria-hidden="true" /></button></div>))}
      <button type="button" className="text-button" onClick={() => setDepartments([...departments, { platform: "whatsapp", label: "", handle: "", url: "" }])}><Plus size={12} aria-hidden="true" /> Adicionar departamento</button>
    </fieldset>
    <button type="submit" className="primary-button" disabled={saving}>{saving ? <Loader2 size={14} className="vx-spin" aria-hidden="true" /> : <Check size={14} aria-hidden="true" />} Salvar aparência</button>
  </form>);
}

function PublishPanel({ site, onSaved, onNotice }: { site: Site; onSaved: () => void; onNotice: (v: string) => void }) {
  const [domain, setDomain] = useState(site.domain || "");
  const [busy, setBusy] = useState(false);
  const [verifyBusy, setVerifyBusy] = useState(false);
  const [info, setInfo] = useState<any>(null);
  const setPublish = async (published: boolean) => { setBusy(true); try { await api(`/sites/${site.id}`, { method: "PATCH", body: JSON.stringify({ published }) }); onSaved(); onNotice(published ? "Site publicado." : "Site despropublicado — ninguém vê fora do painel."); } catch (e) { onNotice(e instanceof Error ? e.message : "Não foi possível publicar."); } finally { setBusy(false); } };
  const saveDomain = async () => { setBusy(true); setInfo(null); try { const res = await api<any>(`/sites/${site.id}/domain`, { method: "POST", body: JSON.stringify({ domain }) }); setInfo(res); } catch (e) { onNotice(e instanceof Error ? e.message : "Domínio inválido."); } finally { setBusy(false); } };
  const verify = async () => { setVerifyBusy(true); try { const res = await api<any>(`/sites/${site.id}/domain/verify`, { method: "POST", body: "{}" }); setInfo(res); } catch (e) { onNotice(e instanceof Error ? e.message : "Não foi possível verificar agora."); } finally { setVerifyBusy(false); } };
  const slugUrl = (typeof window !== "undefined" ? window.location.origin : "") + "/sites/" + site.slug;
  const published = site.published;
  return (<div className="sites-publish">
    <article className="sites-publish-card">
      <h3>Publicação</h3>
      <p>Enquanto o site está despublícamem, ninguém o vê. Só o painel da empresa acessa o rascunho.</p>
      <div className="sites-publish-toggle">
        <span className={"sites-pill " + (published ? "is-live" : "is-draft")}>{published ? "No ar" : "Rascunho"}</span>
        <button type="button" className="primary-button" disabled={busy} onClick={() => void setPublish(!published)}>{busy ? <Loader2 size={15} className="vx-spin" aria-hidden="true" /> : published ? <EyeOff size={15} aria-hidden="true" /> : <Check size={15} aria-hidden="true" />} {published ? "Despublicar" : "Publicar agora"}</button>
      </div>
      {published ? <p className="sites-field-hint">Link público: <a href={slugUrl} target="_blank" rel="noopener noreferrer"><code>{slugUrl}</code></a></p> : <p className="sites-field-hint">Após publicar, o link fica disponível em <code>{slugUrl}</code>.</p>}
    </article>
    <article className="sites-publish-card">
      <h3>Domínio próprio</h3>
      <p>Aponte <code>site.seudominio.com.br</code> para o site. Crie um TXT em <code>_vexora-verify.seudominio.com.br</code> com o valor gerado pelo painel e clique em Verificar DNS.</p>
      <label><span>Domínio</span><input value={domain} onChange={e => setDomain(e.target.value)} placeholder="site.suaclinica.com.br" autoCapitalize="none" /></label>
      <div className="sites-publish-toggle"><button type="button" className="primary-button" disabled={busy || !domain.trim()} onClick={() => void saveDomain()}>{busy ? <Loader2 size={14} className="vx-spin" aria-hidden="true" /> : <Globe size={14} aria-hidden="true" />} Gerar verificação</button><button type="button" className="secondary-button" disabled={verifyBusy || !domain.trim()} onClick={() => void verify()}>{verifyBusy ? <Loader2 size={14} className="vx-spin" aria-hidden="true" /> : <Check size={14} aria-hidden="true" />} Verificar DNS</button></div>
      {info && <div className="sites-domain-info"><code>{info.token || info.instructions || ""}</code>{info.instructions && <p>Crie um TXT em <code>_vexora-verify.{info.domain}</code> com o valor acima. DNS pode levar até 24h para propagar.</p>}{info.message && <p>{info.message}</p>}</div>}
      <p className="sites-field-hint">A publicação no domínio da empresa exige o wildcard <code>*.vexorasuite.com.br</code> ou uma rota personalizada no Dokploy com Host <code>seudominio.com.br</code> — fale com a Véxora. O site responde publicamente no link acima a partir de agora.</p>
    </article>
    <article className="sites-publish-card">
      <h3>Embed do chatbot</h3>
      <p>Coloque o chat do robô no site. Ative a conexão <strong>Chatbot</strong> nas suas inboxes para o widget funcionar no seu site.</p>
      <pre className="sites-embed-code">{`<script src="https://chat.vexorasuite.com.br/embed.js" data-token="SEU-TOKEN-AQUI" async></script>`}</pre>
      <p className="sites-field-hint">Pegue o token em Automação → Chatbots → Página pública.</p>
    </article>
  </div>);
}

function SettingsPanel({ site, onSaved, onNotice }: { site: Site; onSaved: () => void; onNotice: (v: string) => void }) {
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const remove = async () => {
    if (!confirm) return;
    setBusy(true);
    try {
      await api(`/sites/${site.id}`, { method: "DELETE" });
      window.location.assign("/?module=Sites");
    } catch (e) {
      onNotice(e instanceof Error ? e.message : "Não foi possível excluir o site.");
      setBusy(false);
    }
  };
  return (<div className="sites-danger"><h3>Zona de risco</h3><p>Exclui o site, todas as páginas, formulários, cadastros e pré-submissões. Esta ação não pode ser desfeita.</p><label className="sites-confirm"><input type="checkbox" checked={confirm} onChange={e => setConfirm(e.target.checked)} /> Entendo e quero excluir o site “{site.name}”</label><button type="button" className="danger-button" disabled={!confirm||busy} onClick={() => void remove()}><Trash2 size={15} aria-hidden="true" /> Excluir site permanentemente</button><p className="sites-field-hint">Dica: despublicar não apaga nada e pode ser desfeito a qualquer momento em Publicar.</p></div>);
}
