"use client";
import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { AREAS, api, readSitesCache, writeSitesCache, type Site } from "./sites-shared";
import { Building2, ChevronLeft, ChevronRight, Globe, Loader2, Sparkles } from "lucide-react";

const SiteDetail = dynamic(() => import("./sites-detail").then((m) => m.SiteDetail), {
  loading: () => <div className="sites-loading"><Loader2 size={20} className="vx-spin" aria-hidden="true" /> Carregando…</div>,
});
const SitesWizardDialog = dynamic(() => import("./sites-detail").then((m) => m.SitesWizardDialog), {});

export function SitesWorkspace({ tenantId }: { tenantId?: string } = {}) {
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
  const [sites, setSites] = useState<Site[]>(() => readSitesCache(tenantId) ?? []);
  const [loading, setLoading] = useState(() => !readSitesCache(tenantId)); // sem cache: skeleton; com cache: pinta instantâneo
  const [site, setSite] = useState<Site | null>(null);
  const [tabDataLoading, setTabDataLoading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const loadSites = async (background = false) => {
    if (!background) setLoading(true);
    try { const data = await api<Site[]>("/sites"); writeSitesCache(tenantId, data); setSites(data); setError(""); }
    catch (e) { setError(e instanceof Error ? e.message : "Não foi possível carregar os sites."); }
    finally { if (!background) setLoading(false); }
  };
  useEffect(() => { void loadSites(!!readSitesCache(tenantId)); }, [tenantId]);
  useEffect(() => {
    if (!selectedSiteId) { setSite(null); return; }
    setTabDataLoading(true);
    api<Site>("/sites/" + selectedSiteId).then(setSite).catch(e => setError(e instanceof Error ? e.message : "Não foi possível carregar o site.")).finally(() => setTabDataLoading(false));
  }, [selectedSiteId]);

  const wizardOpen = searchParams.get("new") === "1";
  const openWizard = () => setParams({ new: "1" });
  const [draftHydrated, setDraftHydrated] = useState(false);
  const [savedDraft, setSavedDraft] = useState(false);
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
  const wizardSnapshot = { name: wizName, area: wizArea, kind: wizKind, primaryColor: wizPrimary, accentColor: wizAccent, slug: wizSlug, whatsapps: wizWhatsapp, socials: wizSocials, aiPrompt: wizAiPrompt, referenceUrl: wizReferenceUrl, cloneUrl: wizCloneUrl };
  useEffect(() => {
    if (!draftHydrated) return;
    const anyFilled = Object.values(wizardSnapshot).some((v) => Array.isArray(v) ? v.some(Boolean) : Boolean(v));
    try { if (!anyFilled) window.localStorage.removeItem("vx:sites-wizard-draft"); else window.localStorage.setItem("vx:sites-wizard-draft", JSON.stringify(wizardSnapshot)); } catch { /* ignore */ }
  }, [draftHydrated, wizName, wizArea, wizKind, wizPrimary, wizAccent, wizSlug, wizWhatsapp, wizSocials, wizAiPrompt, wizReferenceUrl, wizCloneUrl]);
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem("vx:sites-wizard-draft");
      if (raw) {
        const draft = JSON.parse(raw);
        if (typeof draft.name === "string") setWizName(draft.name);
        if (typeof draft.area === "string") setWizArea(draft.area);
        if (draft.kind === "STATIC" || draft.kind === "DYNAMIC") setWizKind(draft.kind);
        if (typeof draft.primaryColor === "string") setWizPrimary(draft.primaryColor);
        if (typeof draft.accentColor === "string") setWizAccent(draft.accentColor);
        if (typeof draft.slug === "string") setWizSlug(draft.slug);
        if (Array.isArray(draft.whatsapps)) setWizWhatsapp(draft.whatsapps);
        if (Array.isArray(draft.socials)) setWizSocials(draft.socials);
        if (typeof draft.aiPrompt === "string") setWizAiPrompt(draft.aiPrompt);
        if (typeof draft.referenceUrl === "string") setWizReferenceUrl(draft.referenceUrl);
        if (typeof draft.cloneUrl === "string") setWizCloneUrl(draft.cloneUrl);
      }
    } catch { /* ignore */ }
    setDraftHydrated(true);
  }, []);
  const saveDraft = () => {
    try {
      const snapshot = { name: wizName, area: wizArea, kind: wizKind, primaryColor: wizPrimary, accentColor: wizAccent, slug: wizSlug, whatsapps: wizWhatsapp, socials: wizSocials, aiPrompt: wizAiPrompt, referenceUrl: wizReferenceUrl, cloneUrl: wizCloneUrl };
      window.localStorage.setItem("vx:sites-wizard-draft", JSON.stringify(snapshot));
      setSavedDraft(true);
      setNotice("Rascunho salvo neste navegador. Você pode fechar e continuar depois.");
      window.setTimeout(() => setSavedDraft(false), 4000);
    } catch {
      setNotice("Não foi possível salvar o rascunho agora. Tente de novo.");
    }
  };

  const dictateWizardPrompt = () => {
    const Speech = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!Speech) { setWizAiDictateStatus("Ditado indisponível neste navegador. Use o campo de texto."); return; }
    if (wizRecognition.current) { wizRecognition.current.stop(); wizRecognition.current = null; setWizAiDictating(false); setWizAiDictateStatus(""); return; }
    const recognition = new Speech();
    recognition.lang = "pt-BR";
    recognition.interimResults = true; recognition.continuous = true; recognition.maxAlternatives = 1;
    recognition.onresult = (event: any) => { let finalText = ""; for (let i = event.resultIndex; i < event.results.length; i++) { if (event.results[i].isFinal) finalText += event.results[i][0].transcript; } if (finalText.trim()) setWizAiPrompt(current => current.trim() ? current.trim() + " " + finalText.trim() : finalText.trim()); setWizAiDictateStatus("Ditado recebido. Continue tocando para mais texto, ou toque em Parar."); };
    recognition.onerror = () => setWizAiDictateStatus("Não foi possível receber o ditado. Confira a permissão do microfone.");
    recognition.onend = () => { setWizAiDictating(false); };
    wizRecognition.current = recognition;
    recognition.start();
    setWizAiDictating(true);
    setWizAiDictateStatus("Ouvindo. Toque em Parar para finalizar.");
  };
  const closeWizard = () => setParams({ new: null });
  const [wizCloning, setWizCloning] = useState(false);
  const cloneSiteNow = async () => {
    const url = (wizCloneUrl || "").trim();
    if (!/^https:\/\//i.test(url)) { setWizError("Cole a URL pública do site, começando com https://."); return; }
    setWizError(""); setWizCloning(true);
    try {
      const whatsapps = wizWhatsapp.filter(w => w.handle.trim());
      const socials = wizSocials.filter(s => s.handle.trim());
      const created = await api<any>("/sites/clone", { method: "POST", body: JSON.stringify({ url, name: wizName.trim() || undefined, businessArea: wizArea || undefined, kind: wizKind, primaryColor: wizPrimary, accentColor: wizAccent, slug: wizSlug.trim() || undefined, whatsapps, socials }) });
      const report = created?.report as { source?: string; pagesImported?: number; postsImported?: number; propertiesImported?: number } | undefined;
      const origin = report?.source === "wordpress" ? "WordPress" : "HTML";
      setNotice(`Site clonado (${origin}): ${report?.pagesImported ?? 0} páginas, ${report?.postsImported ?? 0} posts, ${report?.propertiesImported ?? 0} imóveis. Revise no Studio e publique quando quiser.`);
      try { window.localStorage.removeItem("vx:sites-wizard-draft"); } catch { /* ignore */ }
      await loadSites();
      setParams({ new: null, site: created?.id || null, tab: "studio" });
    } catch (e) { setWizError(e instanceof Error ? e.message : "Não foi possível clonar o site."); }
    finally { setWizCloning(false); }
  };
  const submitWizard = async () => {
    setWizError(""); setWizSaving(true);
    try {
      const whatsapps = wizWhatsapp.filter(w => w.handle.trim());
      const socials = wizSocials.filter(s => s.handle.trim());
      const created = await api<Site>("/sites", { method: "POST", body: JSON.stringify({ name: wizName, businessArea: wizArea, kind: wizKind, primaryColor: wizPrimary, accentColor: wizAccent, slug: wizSlug, whatsapps, socials, aiPrompt: wizAiPrompt.trim(), referenceUrl: wizReferenceUrl.trim(), cloneUrl: wizCloneUrl.trim() }) });
      setNotice("Site criado. Agora é só editar os blocos e publicar.");
      try { window.localStorage.removeItem("vx:sites-wizard-draft"); } catch { /* ignore */ }
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
                  <span className="sites-card-thumb" aria-hidden="true" style={{ background: `linear-gradient(135deg, ${s.primaryColor}, ${s.accentColor})` }}><SimpleMonogram name={s.name} /></span>
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
        {wizardOpen ? <SitesWizardDialog wizName={wizName} setWizName={setWizName} wizArea={wizArea} setWizArea={setWizArea} wizKind={wizKind} setWizKind={setWizKind} wizPrimary={wizPrimary} setWizPrimary={setWizPrimary} wizAccent={wizAccent} setWizAccent={setWizAccent} wizSlug={wizSlug} setWizSlug={setWizSlug} wizWhatsapp={wizWhatsapp} setWizWhatsapp={setWizWhatsapp} wizSocials={wizSocials} setWizSocials={setWizSocials} wizSaving={wizSaving} wizError={wizError} wizAiPrompt={wizAiPrompt} setWizAiPrompt={setWizAiPrompt} wizAiDictating={wizAiDictating} wizAiDictateStatus={wizAiDictateStatus} dictateWizardPrompt={dictateWizardPrompt} wizReferenceUrl={wizReferenceUrl} setWizReferenceUrl={setWizReferenceUrl} wizCloneUrl={wizCloneUrl} setWizCloneUrl={setWizCloneUrl} closeWizard={closeWizard} submitWizard={submitWizard} onSaveDraft={saveDraft} savedDraft={savedDraft} onCloneSite={() => void cloneSiteNow()} wizCloning={wizCloning} /> : null}
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

function SimpleMonogram({ name }: { name: string }) {
  const initials = name.trim().split(/\s+/).slice(0, 2).map(w => w[0]?.toUpperCase() || "").join("") || "S";
  return <b>{initials}</b>;
}
