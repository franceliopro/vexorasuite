"use client";
import { use, useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { ArrowLeft, CheckCircle2, Loader2, Megaphone, ShieldCheck } from "lucide-react";
import { maskBRLInput } from "../../../../lib/money";

type Options = { pretensions: string[]; types: { Urbano: string[]; Rural: string[] }; regions: string[]; neighborhoods: string[] };

const safeStr = (v: unknown, max: number) => typeof v === "string" ? v.trim().slice(0, max) : "";

export default function SiteAnunciarPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const [options, setOptions] = useState<Options | null>(null);
  const [siteName, setSiteName] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({ name: "", email: "", phone: "", city: "", pretension: "", category: "Urbano", propertyType: "", region: "", neighborhood: "", bedrooms: "", bathrooms: "", parkingSpaces: "", areaM2: "", price: "", description: "", _gotcha: "" });
  const formLoadedAt = useRef(Date.now());

  useEffect(() => {
    formLoadedAt.current = Date.now();
    fetch("/api/backend/public/sites/" + encodeURIComponent(slug) + "/real-estate-options", { cache: "no-store" })
      .then(async r => { if (!r.ok) throw new Error("Este site não está disponível."); return r.json() as Promise<Options>; })
      .then(value => { setOptions(value); const firstUrban = value?.types?.Urbano?.[0]; setForm(v => ({ ...v, propertyType: firstUrban || "" })); })
      .catch(e => setError(e instanceof Error ? e.message : "Não foi possível carregar as opções."));
    fetch("/api/backend/public/sites/" + encodeURIComponent(slug), { cache: "no-store" })
      .then(async r => { const d = await r.json().catch(() => ({})); setSiteName(String(d?.tenantName || d?.site?.name || d?.name || "")); })
      .catch(() => undefined);
  }, [slug]);

  const typeOptions = options?.types?.[form.category === "Rural" ? "Rural" : "Urbano"] || [];
  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setForm(v => ({ ...v, [key]: e.target.value }));
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (busy) return;
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/backend/public/sites/" + encodeURIComponent(slug) + "/property-applications", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...form, phone: form.phone.replace(/\D/g, ""), areaM2: Number(form.areaM2) || 0, bedrooms: Number(form.bedrooms) || 0, bathrooms: Number(form.bathrooms) || 0, parkingSpaces: Number(form.parkingSpaces) || 0, formLoadedAt: formLoadedAt.current }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data?.message || "Não foi possível enviar o anúncio. Tente de novo em instantes.");
      setDone(true);
    } catch (e) { setError(e instanceof Error ? e.message : "Não foi possível enviar."); } finally { setBusy(false); }
  };

  if (done) {
    return (
      <main className="ps-post-shell">
        <section className="ps-apply-success">
          <CheckCircle2 size={40} aria-hidden="true" />
          <h1>Recebemos o seu anúncio!</h1>
          <p>Nossa equipe vai analisar as informações — se faltar alguma coisa (como as fotos do imóvel), a gente entra em contato pelo seu e-mail ou WhatsApp contando o motivo.</p>
          <Link className="ps-btn" href={"/sites/" + slug}>Voltar ao site</Link>
        </section>
      </main>
    );
  }

  return (
    <main className="ps-post-shell">
      <header className="ps-post-header">
        <Link className="ps-post-back" href={"/sites/" + slug}><ArrowLeft size={17} aria-hidden="true" /> {siteName || "Voltar ao site"}</Link>
      </header>
      <section className="ps-apply-shell">
        <div className="ps-apply-intro">
          <Megaphone size={30} aria-hidden="true" />
          <h1>Anuncie seu imóvel</h1>
          <p>Preencha os dados — a equipe analisa e aprova. Faltou algo (ex.: fotos)? A gente avisa o motivo para você corrigir.</p>
          <p className="ps-apply-privacy"><ShieldCheck size={15} aria-hidden="true" /> Os dados são usados apenas para este anúncio. Sem spam.</p>
        </div>
        <form className="ps-apply-form" onSubmit={submit}>
          <fieldset><legend>Quem está anunciando</legend>
            <div className="ps-apply-grid">
              <label><span>Nome *</span><input required value={form.name} onChange={set("name")} placeholder="Seu nome" autoComplete="name" /></label>
              <label><span>E-mail *</span><input required type="email" value={form.email} onChange={set("email")} placeholder="voce@exemplo.com" autoComplete="email" /></label>
              <label><span>Celular / WhatsApp *</span><input required value={form.phone} onChange={e => setForm(v => ({ ...v, phone: e.target.value.replace(/[^\d()+-\s]/g, "").slice(0, 20) }))} placeholder="(66) 99999-0000" inputMode="tel" autoComplete="tel" /></label>
              <label><span>Cidade *</span><input required list="ps-apply-cities" value={form.city} onChange={set("city")} placeholder="Ex.: Alto Araguaia" /><datalist id="ps-apply-cities">{(options?.regions || []).concat(options?.neighborhoods || []).filter((v, i, a) => a.indexOf(v) === i).map(v => <option key={v} value={v} />)}</datalist></label>
            </div>
          </fieldset>
          <fieldset><legend>O imóvel</legend>
            <div className="ps-apply-grid">
              <label><span>Pretensão *</span><select required value={form.pretension} onChange={set("pretension")}><option value="">Escolha…</option>{(options?.pretensions || []).map(p => <option key={p} value={p}>{p}</option>)}</select></label>
              <label><span>Categoria *</span><select required value={form.category} onChange={e => { const category = e.target.value; const first = category === "Rural" ? options?.types?.Rural?.[0] : options?.types?.Urbano?.[0]; setForm(v => ({ ...v, category, propertyType: first || "" })); }}><option value="Urbano">Urbano</option><option value="Rural">Rural</option></select></label>
              <label><span>Tipo *</span><select required value={form.propertyType} onChange={set("propertyType")}>{typeOptions.map(t => <option key={t} value={t}>{t}</option>)}</select></label>
              <label><span>Região</span><input list="ps-apply-regions" value={form.region} onChange={set("region")} placeholder="Ex.: Centro" /><datalist id="ps-apply-regions">{(options?.regions || []).map(r => <option key={r} value={r} />)}</datalist></label>
              <label><span>Bairro</span><input list="ps-apply-neighborhoods" value={form.neighborhood} onChange={set("neighborhood")} placeholder="Ex.: Jardim América" /><datalist id="ps-apply-neighborhoods">{(options?.neighborhoods || []).map(r => <option key={r} value={r} />)}</datalist></label>
            </div>
            <div className="ps-apply-grid ps-apply-numbers">
              <label><span>Quartos</span><input type="number" min={0} max={40} value={form.bedrooms} onChange={set("bedrooms")} placeholder="3" /></label>
              <label><span>Banheiros</span><input type="number" min={0} max={40} value={form.bathrooms} onChange={set("bathrooms")} placeholder="2" /></label>
              <label><span>Vagas</span><input type="number" min={0} max={40} value={form.parkingSpaces} onChange={set("parkingSpaces")} placeholder="2" /></label>
              <label><span>Área (m²)</span><input type="number" min={0} value={form.areaM2} onChange={set("areaM2")} placeholder="120" /></label>
              <label><span>Preço</span><input inputMode="numeric" value={form.price} onChange={e => setForm(v => ({ ...v, price: maskBRLInput(e.target.value) }))} placeholder="1.220.345,56" /></label>
            </div>
            <label><span>Descrição</span><textarea rows={4} value={form.description} onChange={set("description")} placeholder="Diferenciais, estado de conservação, aceita permuta…" /></label>
            {/* Honeypot: humanos nunca veem nem preenchem */}
            <input type="text" name="_gotcha" value={form._gotcha} onChange={e => setForm(v => ({ ...v, _gotcha: e.target.value }))} style={{ position: "absolute", left: "-9999px" }} tabIndex={-1} autoComplete="off" aria-hidden="true" />
          </fieldset>
          {error && <p role="alert" className="ps-apply-error">{error}</p>}
          <button type="submit" className="primary-button ps-apply-submit" disabled={busy}>{busy ? <Loader2 size={17} className="vx-spin" aria-hidden="true" /> : <Megaphone size={17} aria-hidden="true" />} {busy ? "Enviando…" : "Enviar anúncio para análise"}</button>
        </form>
      </section>
      <footer className="ps-post-footer"><p>{siteName} · Desenvolvido por <a href="https://vexorasuite.com.br" target="_blank" rel="noreferrer">Véxora Suite</a></p></footer>
    </main>
  );
}
