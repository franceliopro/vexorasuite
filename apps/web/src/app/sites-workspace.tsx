"use client";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { SitePreview } from "./site-preview";
import { Building2, Check, ChevronDown, ChevronLeft, ChevronRight, ChevronUp, Copy, Eye, EyeOff, Globe, LayoutTemplate, Loader2, Plus, Sparkles, Mic, Trash2, X } from "lucide-react";

const AREAS = [
  { key: "site_simples", label: "Site Simples", hint: "Site institucional sem segmento — você escolhe o conteúdo depois" },
  { key: "construtora", label: "Construtora", hint: "Obras, portfólio, captação de leads" },
  { key: "prestacao_servicos", label: "Prestação de Serviços", hint: "Serviços gerais, orçamento e contato rápido" },
  { key: "vexora", label: "Véxora Suite", hint: "O site da própria Véxora — catálogo de planos e produtos" },
  { key: "clinica_medica", label: "Clínica Médica", hint: "Consultórios, exames, agendamento online" },
  { key: "clinica_estetica", label: "Clínica de Estética", hint: "Procedimentos, pacotes, antes e depois" },
  { key: "estetica_geral", label: "Estética em Geral", hint: "Unhas, cílios, cabelo, sobrancelhas" },
  { key: "advocacia", label: "Advocacia", hint: "Áreas de atuação, quem somos, contato" },
  { key: "imobiliaria", label: "Imobiliária", hint: "Imóveis com filtros e visitas online" },
  { key: "rastreamento", label: "Rastreamento Veicular", hint: "Planos, instalação 24h, frota" },
  { key: "protecao", label: "Proteção Veicular", hint: "Produto, cobertura, benefícios" },
  { key: "ecommerce", label: "E-commerce", hint: "Loja completa com checkout" },
  { key: "blog", label: "Blog ou Notícias", hint: "Posts automáticos e busca" },
  { key: "escola_musica", label: "Escola de Música", hint: "Música, teoria e prática para todos" },
  { key: "escola_teologia", label: "Escola de Teologia", hint: "Formação e cursos com certificado" },
  { key: "escola_cursos", label: "Escola de Cursos", hint: "Idiomas, profissionalizantes, EAD" },
] as const;

const BLOCKS_META: Record<string, { label: string; hint: string }> = {
  hero: { label: "Capa (Hero)", hint: "Título, subtítulo e botão principal" },
  richText: { label: "Texto rico", hint: "Seção com título e texto" },
  services: { label: "Serviços", hint: "Grade de serviços com ícones" },
  gallery: { label: "Galeria", hint: "Galeria de imagens" },
  testimonials: { label: "Depoimentos", hint: "Depoimentos de clientes" },
  faq: { label: "Perguntas frequentes", hint: "Perguntas e respostas" },
  cta: { label: "Chamada para ação", hint: "Botão final chamando para a próxima ação" },
  posts: { label: "Notícias / Posts", hint: "Grade de posts publicados" },
  properties: { label: "Imóveis", hint: "Grade de imóveis publicados" },
  contact: { label: "Contato", hint: "WhatsApps e redes por departamento" },
  spacer: { label: "Espaçador", hint: "Espaço vertical" },
  divider: { label: "Divisor", hint: "Linha separadora" },
};

type Site = any; type Form = any; type Item = any; type Page = any; type Block = any;
let sitesCache: Site[] | null = null;
async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const r = await fetch("/api/backend" + path, { cache: "no-store", headers: { "content-type": "application/json" }, ...init });
  const data = r.status === 204 ? null : await r.json().catch(() => ({}));
  if (!r.ok) throw new Error((data as any)?.message || "Não foi possível completar a ação.");
  return data as T;
}
const safeSlug = (v: string) => v.toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60);

export function SitesWorkspace() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const tab = (searchParams.get("tab") || "sites") as "sites" | "pages" | "posts" | "imoveis" | "forms" | "appear" | "publish" | "settings" | "studio";
  const selectedSiteId = searchParams.get("site") || "";
  const setParams = (patch: Record<string, string | null>) => {
    const next = new URLSearchParams(searchParams.toString());
    for (const [k, v] of Object.entries(patch)) { if (v === null || v === "") next.delete(k); else next.set(k, v); }
    router.replace(pathname + (next.toString() ? "?" + next.toString() : ""), { scroll: false });
  };
  const [sites, setSites] = useState<Site[]>(() => sitesCache ?? []);
  const [loading, setLoading] = useState(!sitesCache);
  const [site, setSite] = useState<Site | null>(null);
  const [tabDataLoading, setTabDataLoading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const loadSites = async () => {
    setLoading(true);
    try { const data = await api<Site[]>("/sites"); sitesCache = data; setSites(data); setError(""); }
    catch (e) { setError(e instanceof Error ? e.message : "Não foi possível carregar os sites."); }
    finally { setLoading(false); }
  };
  useEffect(() => { void loadSites(); }, []);
  useEffect(() => {
    if (!selectedSiteId) { setSite(null); return; }
    setTabDataLoading(true);
    api<Site>("/sites/" + selectedSiteId).then(setSite).catch(e => setError(e instanceof Error ? e.message : "Não foi possível carregar o site.")).finally(() => setTabDataLoading(false));
  }, [selectedSiteId]);

  const wizardOpen = searchParams.get("new") === "1";
  const openWizard = () => setParams({ new: "1" });
  const [wizName, setWizName] = useState("");
  const [wizArea, setWizArea] = useState<string>("");
  const [wizKind, setWizKind] = useState<"STATIC" | "DYNAMIC">("STATIC");
  const [wizPrimary, setWizPrimary] = useState("#2E7CF6");
  const [wizAccent, setWizAccent] = useState("#22D3EE");
  const [wizSlug, setWizSlug] = useState("");
  const [wizWhatsapp, setWizWhatsapp] = useState<{ label: string; handle: string }[]>([{ label: "Principal", handle: "" }]);
  const [wizSocials, setWizSocials] = useState([{ platform: "instagram", handle: "" }] as { platform: string; handle: string }[]);
  const [wizSaving, setWizSaving] = useState(false);
  const [wizError, setWizError] = useState("");
  const [wizAiPrompt, setWizAiPrompt] = useState("");
  const [wizReferenceUrl, setWizReferenceUrl] = useState("");
  const [wizCloneUrl, setWizCloneUrl] = useState("");
  const [wizAiDictating, setWizAiDictating] = useState(false);
  const [wizAiDictateStatus, setWizAiDictateStatus] = useState("");
  const wizRecognition = useRef<any>(null);
  const dictateWizardPrompt = () => {
    const Speech = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!Speech) { setWizAiDictateStatus("Ditado indisponível neste navegador. Use o campo de texto."); return; }
    if (wizRecognition.current) { wizRecognition.current.stop(); wizRecognition.current = null; setWizAiDictating(false); setWizAiDictateStatus(""); return; }
    const recognition = new Speech();
    recognition.lang = "pt-BR";
    recognition.interimResults = false;
    recognition.onresult = (event: any) => { const transcript = event.results[0][0].transcript; setWizAiPrompt(current => current.trim() ? current.trim() + " " + transcript : transcript); setWizAiDictateStatus("Ditado recebido. Revise antes de criar."); };
    recognition.onerror = () => setWizAiDictateStatus("Não foi possível receber o ditado. Confira a permissão do microfone.");
    recognition.onend = () => { setWizAiDictating(false); };
    wizRecognition.current = recognition;
    recognition.start();
    setWizAiDictating(true);
    setWizAiDictateStatus("Ouvindo. Toque em Parar para finalizar.");
  };
  const closeWizard = () => setParams({ new: null });
  const submitWizard = async () => {
    setWizError(""); setWizSaving(true);
    try {
      const whatsapps = wizWhatsapp.filter(w => w.handle.trim());
      const socials = wizSocials.filter(s => s.handle.trim());
      const created = await api<Site>("/sites", { method: "POST", body: JSON.stringify({ name: wizName, businessArea: wizArea, kind: wizKind, primaryColor: wizPrimary, accentColor: wizAccent, slug: wizSlug, whatsapps, socials, aiPrompt: wizAiPrompt.trim(), referenceUrl: wizReferenceUrl.trim(), cloneUrl: wizCloneUrl.trim() }) });
      setNotice("Site criado. Agora é só editar os blocos e publicar.");
      await loadSites();
      closeWizard();
      setParams({ site: created.id, tab: "pages" });
    } catch (e) { setWizError(e instanceof Error ? e.message : "Não foi possível criar o site."); }
    finally { setWizSaving(false); }
  };

  if (tab === "sites" && !selectedSiteId) {
    return (
      <section className="sites-workspace">
        {notice && <p className="sites-notice" role="status">{notice}</p>}
        {error && <p className="sites-error" role="alert">{error} <button type="button" className="text-button" onClick={() => void loadSites()}>Tentar de novo</button></p>}
        <header className="sites-hero">
          <div>
            <span className="sites-eyebrow"><Globe size={13} aria-hidden="true" /> Véxora Sites</span>
            <h1>Sites que vendem, feitos por IA</h1>
            <p>Escolha sua área, diga seu nome, e a Véxora monta um site responsivo completo — páginas, textos, cores, logo e formulário de contato. Você edita tudo.</p>
          </div>
          <button type="button" className="primary-button" onClick={openWizard}><Sparkles size={16} aria-hidden="true" /> Criar site com IA</button>
        </header>
        {loading ? <div className="sites-loading"><Loader2 size={22} className="vx-spin" aria-hidden="true" /> Montando sua central…</div> : (
          <div className="sites-grid">
            {sites.length ? sites.map(s => (
              <article key={s.id} className="sites-card" style={{ ["--site-primary" as any]: s.primaryColor }}>
                <header>
                  <span className="sites-card-thumb" aria-hidden="true" style={{ background: `linear-gradient(135deg, ${s.primaryColor}, ${s.accentColor})` }}><SiteMonogram name={s.name} /></span>
                  <div><h2>{s.name}</h2><p>{AREAS.find(a => a.key === s.businessArea)?.label || s.businessArea || "Site"} · {s.kind === "DYNAMIC" ? "Site dinâmico" : "Site institucional"}</p></div>
                  <span className={"sites-pill " + (s.published ? "is-live" : "is-draft")}>{s.published ? "Publicado" : "Rascunho"}</span>
                </header>
                <footer>
                  <span>{s._count?.pages || 0} páginas · {s._count?.forms || 0} formulário{s._count?.forms === 1 ? "" : "s"} · {s._count?.submissions || 0} pré-cadastrado(s)</span>
                  <button type="button" className="primary-button" onClick={() => setParams({ site: s.id, tab: "pages" })}>Abrir <ChevronRight size={15} aria-hidden="true" /></button>
                </footer>
              </article>
            )) : <div className="sites-empty"><Building2 size={26} aria-hidden="true" /><h2>Nenhum site ainda</h2><p>Crie seu primeiro site clicando em “Criar site com IA”.</p></div>}
          </div>
        )}
        {wizardOpen ? <SitesWizardDialog wizName={wizName} setWizName={setWizName} wizArea={wizArea} setWizArea={setWizArea} wizKind={wizKind} setWizKind={setWizKind} wizPrimary={wizPrimary} setWizPrimary={setWizPrimary} wizAccent={wizAccent} setWizAccent={setWizAccent} wizSlug={wizSlug} setWizSlug={setWizSlug} wizWhatsapp={wizWhatsapp} setWizWhatsapp={setWizWhatsapp} wizSocials={wizSocials} setWizSocials={setWizSocials} wizSaving={wizSaving} wizError={wizError} wizAiPrompt={wizAiPrompt} setWizAiPrompt={setWizAiPrompt} wizAiDictating={wizAiDictating} wizAiDictateStatus={wizAiDictateStatus} dictateWizardPrompt={dictateWizardPrompt} wizReferenceUrl={wizReferenceUrl} setWizReferenceUrl={setWizReferenceUrl} wizCloneUrl={wizCloneUrl} setWizCloneUrl={setWizCloneUrl} closeWizard={closeWizard} submitWizard={submitWizard} /> : null}
      </section>
    );
  }

  return (
    <section className="sites-workspace sites-workspace--detail">
      <button type="button" className="text-button sites-back" onClick={() => setParams({ site: null, tab: null })}><ChevronLeft size={14} aria-hidden="true" /> Sites</button>
      {notice && <p className="sites-notice" role="status">{notice}</p>}
      {error && <p className="sites-error" role="alert">{error}</p>}
      {tabDataLoading ? <div className="sites-loading"><Loader2 size={20} className="vx-spin" aria-hidden="true" /> Carregando.</div> : !site ? (error ? <div className="content-card sites-detail-missing" role="alert"><h2>Site não encontrado nesta empresa.</h2><p>{error}</p><button type="button" className="primary-button" onClick={() => setParams({ site: null, tab: null })}>Voltar para Sites</button></div> : <div className="sites-loading"><Loader2 size={20} className="vx-spin" aria-hidden="true" /> Carregando.</div>) : <SiteDetail site={site} tab={tab} setParams={setParams} onSaved={() => { void api<Site>("/sites/" + site.id).then(setSite); }} onNotice={setNotice} />}
    </section>
  );
}
function SitesWizardDialog(props: {
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
}) {
  const { wizName, setWizName, wizArea, setWizArea, wizKind, setWizKind, wizPrimary, setWizPrimary, wizAccent, setWizAccent, wizSlug, setWizSlug, wizWhatsapp, setWizWhatsapp, wizSocials, setWizSocials, wizSaving, wizError, wizAiPrompt, setWizAiPrompt, wizAiDictating, wizAiDictateStatus, dictateWizardPrompt, wizReferenceUrl, setWizReferenceUrl, wizCloneUrl, setWizCloneUrl, closeWizard, submitWizard } = props;
  if (typeof document === "undefined") return null;
  return createPortal(
    <div className="vx-dialog-backdrop sites-wizard-backdrop" role="presentation" onMouseDown={e => { if (e.target === e.currentTarget) closeWizard(); }}>
      <section className="vx-dialog sites-wizard" role="dialog" aria-modal="true" aria-labelledby="sites-wizard-title">
        <header className="vx-dialog-heading"><span className="vx-dialog-icon"><Sparkles size={20} aria-hidden="true" /></span><div><h2 id="sites-wizard-title">Criar site com IA</h2><p>A Véxora monta a estrutura completa do site para você.</p></div><button type="button" className="vx-dialog-close" aria-label="Fechar" onClick={closeWizard}><X size={18} aria-hidden="true" /></button></header>
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
            <p className="sites-field-hint">Descreva o negócio, o público, o tom e o que o site precisa. Se houver IA configurada na empresa, ela redige o conteúdo; sem IA, o template cria o site com os dados acima.</p>
            <div className="sites-ai-prompt">
              <div className="sites-ai-prompt-head"><span>Pedido para a IA</span><button type="button" className={"sites-ai-dictate" + (wizAiDictating ? " is-listening" : "")} onClick={dictateWizardPrompt} aria-pressed={wizAiDictating} title="Ditar o pedido com o microfone"><Mic size={14} aria-hidden="true" />{wizAiDictating ? "Parar" : "Ditar"}</button></div>
              <textarea rows={3} maxLength={2500} value={wizAiPrompt} onChange={e => setWizAiPrompt(e.target.value)} placeholder="Ex.: Clínica estética Lume em Cuiabá, foco em limpeza de pele e Botox para mulheres 30–55. Tom: acolhedor, profissional. Quero agendar pelo WhatsApp." />
              {wizAiDictateStatus ? <small className="sites-ai-dictate-status" role="status">{wizAiDictateStatus}</small> : null}
            </div>
            <label className="sites-field"><span>Imagem de referência (link opcional)</span><input value={wizReferenceUrl} onChange={e => setWizReferenceUrl(e.target.value)} placeholder="https://site-ou-imagem.com.br/referencia" autoCapitalize="none" autoCorrect="off" spellCheck={false} /><small>Cole o link de uma imagem, de um site inspirador ou de um arquivo do Google Drive — a IA usa como referência visual.</small></label>
            <label className="sites-field"><span>Clonar um site (URL opcional)</span><input value={wizCloneUrl} onChange={e => setWizCloneUrl(e.target.value)} placeholder="https://www.empresaexemplo.com.br" autoCapitalize="none" autoCorrect="off" spellCheck={false} /><small>A IA lê o conteúdo (título, seções e textos) e adapta o tipo de conteúdo para a sua empresa — nunca copia marcas ou logos. Revise antes de publicar.</small></label>
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

function StudioEditor({ site, onSaved, onNotice }: { site: Site; onSaved: () => void; onNotice: (v: string) => void }) {
  const [device, setDevice] = useState<"pc" | "phone">("pc");
  const [selected, setSelected] = useState<string>("");
  const [instruction, setInstruction] = useState("");
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState<Record<string, true>>({});
  const [model, setModel] = useState<PreviewSite>(() => JSON.parse(JSON.stringify(site)) as PreviewSite);
  useEffect(() => { setModel(JSON.parse(JSON.stringify(site)) as PreviewSite); }, [site]);
  const allBlocks = model.pages.flatMap((p: any) => p.blocks.map((b: any) => ({ ...b, pageId: p.id, pageTitle: p.title })));
  const selectedBlock = allBlocks.find((b: any) => b.id === selected) || null;
  const dirtyCount = Object.keys(dirty).length;
  const fieldDefs: { fields: { key: string; label: string; area?: boolean }[]; array?: { key: string; label: string; itemLabel: string; fields: { key: string; label: string; area?: boolean }[] } } =
    (selectedBlock ? STUDIO_FIELD_DEFS[selectedBlock.type] : undefined) || { fields: [] };
  const markDirty = (blockId: string) => setDirty((prev) => (prev[blockId] ? prev : { ...prev, [blockId]: true }));
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
    const page = model.pages[0]; if (!page) return;
    const meta = BLOCKS_META[type];
    try {
      const baseContent = type === "hero"
        ? { headline: "Um título claro e direto", sub: "Apoio curto que explica o benefício.", ctaLabel: "Quero conversar" }
        : type === "richText"
          ? { title: "Título da seção", body: "Escreva aqui o texto desta seção." }
          : type === "services"
            ? { title: "O que fazemos", items: [{ title: "Serviço um", text: "Descrição curta do serviço." }] }
            : type === "cta"
              ? { title: "Pronto para começar?", sub: "Chama agora — é rápido.", ctaLabel: "Quero conversar" }
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
  return (
    <div className="sites-studio">
      <div className="sites-studio-toolbar">
        <div className="sites-studio-device-toggle" role="group" aria-label="Visualizar em">
          <button type="button" aria-pressed={device === "pc"} className={device === "pc" ? "active" : ""} onClick={() => setDevice("pc")}>PC</button>
          <button type="button" aria-pressed={device === "phone"} className={device === "phone" ? "active" : ""} onClick={() => setDevice("phone")}>Celular</button>
        </div>
        <div className="sites-studio-toolbar-right">
          {dirtyCount > 0 ? <button type="button" className="primary-button sites-studio-save" disabled={saving} onClick={() => void saveAll()}>{saving ? "Salvando…" : "Salvar alterações (" + dirtyCount + ")"}</button> : <span className="sites-field-hint sites-studio-saved">Tudo salvo</span>}
        </div>
      </div>
      <div className="sites-studio-body">
        <aside className="sites-studio-blocks" aria-label="Blocos da página">
          <h3>Blocos</h3>
          {allBlocks.length === 0 ? <p className="sites-field-hint">Este site ainda não tem blocos.</p> : allBlocks.map((b: any) => (
            <div key={b.id} className={"sites-studio-item" + (selected === b.id ? " active" : "") + (b.hidden ? " is-hidden" : "")}>
              <button type="button" className="sites-studio-block-select" onClick={() => setSelected(b.id)}>
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
            <div className="sites-studio-add-grid">{["hero","richText","services","testimonials","faq","cta","gallery","contact","spacer"].map((key) => <button key={key} type="button" className="sites-studio-add-chip" title={BLOCKS_META[key]?.hint} onClick={() => void addBlock(key)}>+ {BLOCKS_META[key]?.label ?? key}</button>)}</div>
          </div>
        </aside>
        <div className="sites-studio-preview">
          <div className={"sites-studio-frame" + (device === "phone" ? " is-phone" : "")}>
            <SitePreview site={model} highlightBlockId={selected} onBlockClick={(id) => setSelected(id)} />
          </div>
        </div>
        <div className="sites-studio-panel">
          {selectedBlock ? <>
            <div className="sites-studio-panel-head">
              <h3>Editar bloco</h3>
              <span className="sites-studio-panel-type">{BLOCKS_META[selectedBlock.type]?.label ?? selectedBlock.type}</span>
            </div>
            <div className="sites-studio-fields">
              {fieldDefs.fields.map((f) => <label key={f.key} className="sites-field"><span>{f.label}</span>{f.area ? <textarea rows={2} value={(selectedBlock.content?.[f.key] ?? "").toString()} onChange={(e) => setField(f.key, e.target.value)} /> : <input value={(selectedBlock.content?.[f.key] ?? "").toString()} onChange={(e) => setField(f.key, e.target.value)} />}</label>)}
              {fieldDefs.array ? <div className="sites-studio-array">
                <div className="sites-studio-array-head"><span className="sites-field-label">{fieldDefs.array.label}</span><button type="button" className="text-button sites-studio-add-item" onClick={() => addArrayItem(fieldDefs.array!.key)}>+ {fieldDefs.array.itemLabel}</button></div>
                {(Array.isArray(selectedBlock.content?.[fieldDefs.array.key]) ? selectedBlock.content[fieldDefs.array.key] : []).map((item: any, index: number) => <div key={index} className="sites-studio-array-item">
                  <div className="sites-studio-array-item-head"><span className="sites-studio-array-index">{fieldDefs.array!.itemLabel} {index + 1}</span><div className="sites-studio-array-tools"><button type="button" aria-label="Mover item acima" onClick={() => moveArrayItem(fieldDefs.array!.key, index, -1)}><ChevronUp size={13} aria-hidden="true" /></button><button type="button" aria-label="Mover item abaixo" onClick={() => moveArrayItem(fieldDefs.array!.key, index, 1)}><ChevronDown size={13} aria-hidden="true" /></button><button type="button" aria-label="Remover item" onClick={() => deleteArrayItem(fieldDefs.array!.key, index)}><Trash2 size={13} aria-hidden="true" /></button></div></div>
                  {fieldDefs.array!.fields.map((f) => <label key={f.key} className="sites-field"><span>{f.label}</span>{f.area ? <textarea rows={2} value={(item?.[f.key] ?? "").toString()} onChange={(e) => setArrayField(fieldDefs.array!.key, index, f.key, e.target.value)} /> : <input value={(item?.[f.key] ?? "").toString()} onChange={(e) => setArrayField(fieldDefs.array!.key, index, f.key, e.target.value)} />}</label>)}
                </div>)}
              </div> : null}
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
    </div>
  );
}

type PreviewSite = any;
function SiteMonogram({ name }: { name: string }) {
  const initials = name.trim().split(/\s+/).slice(0, 2).map(w => w[0]?.toUpperCase() || "").join("") || "S";
  return <b>{initials}</b>;
}

function SiteDetail({ site, tab, setParams, onSaved, onNotice }: { site: Site; tab: string; setParams: (p: Record<string, string | null>) => void; onSaved: () => void; onNotice: (v: string) => void }) {
  const tabs = [["studio","Studio"],["pages","Páginas"],["posts","Posts"],["imoveis","Imóveis"],["forms","Formulários"],["appear","Aparência"],["publish","Publicar"],["settings","Site"]] as const;
  return (
    <>
      <header className="sites-detail-head">
        <SiteMonogram name={site.name} />
        <div><h1>{site.name}</h1><p>{AREAS.find(a => a.key === site.businessArea)?.label || site.businessArea} · {site.slug}</p></div>
        <div className="sites-detail-actions"><a className="secondary-button" href={"/sites/" + site.slug} target="_blank" rel="noopener noreferrer"><Eye size={15} aria-hidden="true" /> Visualizar</a></div>
      </header>
      <nav className="sites-tabs" aria-label="Editor do site">{tabs.map(([key, label]) => <button key={key} type="button" aria-pressed={tab === key} className={tab === key ? "active" : ""} onClick={() => setParams({ tab: key })}>{label}</button>)}</nav>
      {tab === "studio" ? <StudioEditor site={site} onSaved={onSaved} onNotice={onNotice} /> : tab === "pages" ? <PagesEditor site={site} onSaved={onSaved} onNotice={onNotice} /> : tab === "posts" ? <ItemsEditor site={site} kind="post" onSaved={onSaved} onNotice={onNotice} /> : tab === "imoveis" ? <ItemsEditor site={site} kind="property" onSaved={onSaved} onNotice={onNotice} /> : tab === "forms" ? <FormsEditor site={site} onSaved={onSaved} onNotice={onNotice} /> : tab === "appear" ? <Appearance site={site} onSaved={onSaved} onNotice={onNotice} /> : tab === "publish" ? <PublishPanel site={site} onSaved={onSaved} onNotice={onNotice} /> : <SettingsPanel site={site} onSaved={onSaved} onNotice={onNotice} />}
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
  const addBlock = async (type: string) => { await api(`/sites/pages/${page!.id}/blocks`, { method: "POST", body: JSON.stringify({ type, content: {} }) }); onSaved(); onNotice("Bloco adicionado."); };
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
    case "hero":
      return (<div className="sites-block-form"><label><span>Título</span><input value={c.headline || ""} onChange={e => set({ headline: e.target.value })} placeholder="Título principal da página" /></label><label><span>Subtítulo</span><input value={c.sub || ""} onChange={e => set({ sub: e.target.value })} placeholder="Texto de apoio" /></label><label><span>Botão (texto)</span><input value={c.ctaLabel || ""} onChange={e => set({ ctaLabel: e.target.value })} placeholder="Quero conversar" /></label><label><span>Botão (link)</span><input value={c.ctaUrl || ""} onChange={e => set({ ctaUrl: e.target.value })} placeholder="https://wa.me/55…" /></label></div>);
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

function ItemsEditor({ site, kind, onSaved, onNotice }: { site: Site; kind: "post" | "property"; onSaved: () => void; onNotice: (v: string) => void }) {
  const items = (site.items || []).filter((i: Item) => i.kind === kind);
  const [editing, setEditing] = useState<Item | null>(null);
  const [form, setForm] = useState<Record<string, any>>({});
  const reset = (i: Item | null) => { setEditing(i); setForm(i ? { title: i.title, excerpt: i.excerpt || "", coverUrl: i.coverUrl || "", price: i.data?.price || "", location: i.data?.location || "", body: i.data?.body || "", beds: i.data?.beds || "", baths: i.data?.baths || "", area: i.data?.area || "" } : { title: "", excerpt: "", coverUrl: "", price: "", location: "", body: "", beds: "", baths: "", area: "" }); };
  const save = async () => {
    const payload = { title: form.title, excerpt: form.excerpt, coverUrl: form.coverUrl, data: kind === "property" ? { price: form.price, location: form.location, beds: form.beds, baths: form.baths, area: form.area, body: form.body } : { body: form.body } };
    if (editing) await api(`/sites/items/${editing.id}`, { method: "PATCH", body: JSON.stringify(payload) }); else await api(`/sites/${site.id}/items`, { method: "POST", body: JSON.stringify({ ...payload, kind }) });
    onNotice(editing ? "Atualizado." : "Criado."); onSaved();
  };
  const remove = async (i: Item) => { await api(`/sites/items/${i.id}`, { method: "DELETE" }); onSaved(); onNotice("Excluído."); };
  return (
    <div className="sites-items-grid">
      <div className="sites-items-list">
        {items.length ? items.map((i: Item) => (<article key={i.id} className="sites-item-card"><div><strong>{i.title}</strong><small>{kind === "post" ? (i.excerpt || "Sem resumo") : [i.data?.price, i.data?.location].filter(Boolean).join(" · ") || "Sem detalhes"}</small></div><span><button type="button" className="text-button" onClick={() => reset(i)}>Editar</button><button type="button" className="icon-button" aria-label="Excluir" onClick={() => void remove(i)}><Trash2 size={14} aria-hidden="true" /></button></span></article>)) : <p className="sites-field-hint">{kind === "post" ? "Nenhuma matéria publicada." : "Nenhum imóvel publicado."}</p>}
        <button type="button" className="primary-button" onClick={() => reset(null)}><Plus size={15} aria-hidden="true" /> {kind === "post" ? "Nova matéria" : "Novo imóvel"}</button>
      </div>
      <form className="sites-item-form" onSubmit={e => { e.preventDefault(); void save(); }}>
        <h3>{editing ? "Editar" : "Novo"} {kind === "post" ? "matéria" : "imóvel"}</h3>
        <label><span>Título</span><input value={form.title || ""} onChange={e => setForm(v => ({ ...v, title: e.target.value }))} placeholder={kind === "post" ? "Título da matéria" : "Apartamento 3 quartos · Jardins"} required /></label>
        {kind === "property" && <>
          <label><span>Preço</span><input value={form.price || ""} onChange={e => setForm(v => ({ ...v, price: e.target.value }))} placeholder="R$ 650.000" /></label>
          <label><span>Localização</span><input value={form.location || ""} onChange={e => setForm(v => ({ ...v, location: e.target.value }))} placeholder="Jardins, São Paulo" /></label>
          <div className="sites-inline-fields"><label><span>Quartos</span><input type="number" min={0} value={form.beds || ""} onChange={e => setForm(v => ({ ...v, beds: e.target.value }))} /></label><label><span>Banheiros</span><input type="number" min={0} value={form.baths || ""} onChange={e => setForm(v => ({ ...v, baths: e.target.value }))} /></label><label><span>Área (m²)</span><input type="number" min={0} value={form.area || ""} onChange={e => setForm(v => ({ ...v, area: e.target.value }))} /></label></div>
        </>}
        <label><span>Resumo</span><input value={form.excerpt || ""} onChange={e => setForm(v => ({ ...v, excerpt: e.target.value }))} placeholder="Uma frase vendendo a matéria/imóvel" /></label>
        <label><span>Imagem (URL)</span><input value={form.coverUrl || ""} onChange={e => setForm(v => ({ ...v, coverUrl: e.target.value }))} placeholder="https://…" /></label>
        <label><span>Corpo do texto</span><textarea rows={6} value={form.body || ""} onChange={e => setForm(v => ({ ...v, body: e.target.value }))} placeholder="Escreva o conteúdo completo…" /></label>
        <button type="submit" className="primary-button">{editing ? "Salvar alterações" : "Publicar"}</button>
      </form>
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
