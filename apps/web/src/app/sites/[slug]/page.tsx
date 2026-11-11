"use client";
import { use, useEffect, useState } from "react";
import { MapPin, MessageCircle, Phone, Mail, ArrowRight, Star, Globe, ChevronDown } from "lucide-react";

type Block = { id: string; type: string; content: any; sortOrder: number };
type Page = { id: string; slug: string; kind: string; title: string; sortOrder: number; blocks: Block[] };
type Item = { id: string; kind: string; slug: string; title: string; excerpt?: string | null; coverUrl?: string | null; data: any; publishedAt?: string | null };
type FormField = { id: string; label: string; type: string; required: boolean; options?: string[] };
type Form = { id: string; name: string; fields: FormField[]; targets: { kind: string; to?: string }[] };
type Site = { id: string; name: string; slug: string; primaryColor: string; accentColor: string; departments: { platform: string; label: string; handle: string; url?: string }[]; kind: string; businessArea: string; logoUrl?: string | null; pages: Page[]; forms: Form[]; items: Item[] };

const initials = (n: string) => n.trim().split(/\s+/).slice(0, 2).map(w => w[0]?.toUpperCase() || "").join("") || "S";
const waHref = (h: string) => "https://wa.me/" + h.replace(/\D/g, "");
const deptHref = (d: { platform: string; handle: string; url?: string }) => d.url || (d.platform === "whatsapp" ? waHref(d.handle) : d.platform === "instagram" ? "https://instagram.com/" + d.handle.replace(/^@/, "") : d.platform === "facebook" ? "https://facebook.com/" + d.handle.replace(/^@/, "") : d.handle);
const safeImg = (url?: string | null) => url && (/^https?:\/\//i.test(url) || /^\/(?!\/)/.test(url)) ? url : null;

export default function SitePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const [site, setSite] = useState<Site | null>(null);
  const [error, setError] = useState("");
  const [busyForm, setBusyForm] = useState<string | null>(null);
  const [sent, setSent] = useState<string | null>(null);
  const [navOpen, setNavOpen] = useState(false);

  useEffect(() => {
    fetch("/api/backend/public/sites/" + encodeURIComponent(slug), { cache: "no-store" })
      .then(async r => { const data = await r.json().catch(() => ({})); if (!r.ok) throw new Error(data.message || "Este site não está disponível no momento."); return data as Site; })
      .then(setSite)
      .catch(e => setError(e instanceof Error ? e.message : "Este site não está disponível no momento."));
  }, [slug]);

  const submit = async (form: Form, values: Record<string, string>) => {
    setBusyForm(form.id);
    try {
      const r = await fetch("/api/backend/public/sites/" + encodeURIComponent(slug) + "/forms/" + form.id, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...values, page: typeof window !== "undefined" ? window.location.pathname : "home" }) });
      if (!r.ok) throw new Error("Não foi possível enviar. Tente novamente.");
      setSent(form.id);
    } catch (e) { setError(e instanceof Error ? e.message : "Não foi possível enviar."); }
    finally { setBusyForm(null); }
  };

  if (error) return <main className="public-site-shell"><div className="public-site-unavailable"><Globe size={26} aria-hidden="true" /><h1>Site indisponível</h1><p>{error}</p></div></main>;
  if (!site) return <main className="public-site-shell"><div className="public-site-unavailable" role="status"><div className="public-site-spinner" aria-hidden="true" /><p>Carregando…</p></div></main>;

  const primary = site.primaryColor;
  const accent = site.accentColor;
  const nav = site.pages.filter(p => p.slug !== "inicio");

  const renderBlock = (block: Block) => {
    const c = block.content || {};
    switch (block.type) {
      case "hero":
        return (
          <section className="ps-hero">
            {c.badge && <span className="ps-badge">{c.badge}</span>}
            <h1>{c.headline || site.name}</h1>
            {c.sub && <p>{c.sub}</p>}
            {c.ctaLabel && c.ctaUrl && <a className="ps-btn" href={c.ctaUrl} target="_blank" rel="noopener noreferrer">{c.ctaLabel}<ArrowRight size={16} aria-hidden="true" /></a>}
          </section>
        );
      case "richText":
        return <section className="ps-section"><h2>{c.title || ""}</h2>{String(c.body || "").split("\n").filter(Boolean).map((line, i) => <p key={i}>{line}</p>)}</section>;
      case "services":
        return (
          <section className="ps-section"><h2>{c.title || "O que fazemos"}</h2>
            <div className="ps-services">{(c.items || []).map((item: any, i: number) => (
              <article key={i} className="ps-service"><span className="ps-service-check" aria-hidden="true"><Star size={15} /></span><div><h3>{item.title}</h3><p>{item.text}</p></div></article>
            ))}</div>
          </section>
        );
      case "testimonials":
        return (
          <section className="ps-section"><h2>{c.title || "Depoimentos"}</h2>
            <div className="ps-testimonials">{(c.items || []).map((item: any, i: number) => (
              <figure key={i} className="ps-testimonial"><Star size={16} aria-hidden="true" fill={primary} /><blockquote>“{item.text}”</blockquote><figcaption>{item.name}</figcaption></figure>
            ))}</div>
          </section>
        );
      case "faq":
        return (
          <section className="ps-section"><h2>{c.title || "Perguntas frequentes"}</h2>
            {(c.items || []).map((item: any, i: number) => (
              <details key={i} className="ps-faq"><summary>{item.question}<ChevronDown size={15} aria-hidden="true" /></summary><p>{item.answer}</p></details>
            ))}
          </section>
        );
      case "cta":
        return (
          <section className="ps-cta" style={{ background: `linear-gradient(135deg, ${primary}, ${accent})` }}>
            <div><h2>{c.title || "Pronto para começar?"}</h2>{c.sub && <p>{c.sub}</p>}</div>
            {c.ctaLabel && c.ctaUrl && <a className="ps-btn ps-btn-ghost" href={c.ctaUrl} target="_blank" rel="noopener noreferrer">{c.ctaLabel}<ArrowRight size={16} aria-hidden="true" /></a>}
          </section>
        );
      case "gallery":
        return (
          <section className="ps-section"><h2>{c.title || "Galeria"}</h2>
            <div className="ps-gallery">{(c.items || []).map((item: any, i: number) => safeImg(item.url) && <figure key={i} className="ps-gallery-item"><img src={item.url} alt={item.caption || "Foto"} loading="lazy" />{item.caption && <figcaption>{item.caption}</figcaption>}</figure>)}</div>
          </section>
        );
      case "contact":
        return (
          <section className="ps-section"><h2>{c.title || "Fale com a gente"}</h2>
            <div className="ps-contact-grid">
              {(site.departments || []).map((d: any, i: number) => {
                const Icon = d.platform === "whatsapp" || d.platform === "phone" ? Phone : d.platform === "instagram" || d.platform === "x" ? Globe : d.platform === "email" ? Mail : MapPin;
                return <a key={i} href={deptHref(d)} className="ps-contact-item" target="_blank" rel="noopener noreferrer"><Icon size={17} aria-hidden="true" /><span><b>{d.label || d.platform}</b><small>{d.handle}</small></span></a>;
              })}
            </div>
          </section>
        );
      case "spacer":
        return <div style={{ height: Number(c.size || 48) }} aria-hidden="true" />;
      case "divider":
        return <hr className="ps-divider" style={{ borderStyle: c.style === "dashed" ? "dashed" : "solid" }} />;
      case "posts": {
        const published = site.items.filter(i => i.kind === "post");
        return (
          <section className="ps-section"><h2>{c.title || "Últimas matérias"}</h2>
            {published.length ? <div className="ps-items">{published.slice(0, 6).map(item => (<article key={item.id} className="ps-item-card">{safeImg(item.coverUrl) && <img src={item.coverUrl!} alt={item.title} loading="lazy" />}<div><h3>{item.title}</h3>{item.excerpt && <p>{item.excerpt}</p>}</div></article>))}</div> : <p className="ps-field-hint">Nenhuma matéria publicada ainda.</p>}
          </section>
        );
      }
      case "properties": {
        const published = site.items.filter(i => i.kind === "property");
        return (
          <section className="ps-section"><h2>{c.title || "Imóveis disponíveis"}</h2>
            {published.length ? <div className="ps-items">{published.slice(0, 9).map(item => (<article key={item.id} className="ps-item-card">{safeImg(item.coverUrl) && <img src={item.coverUrl!} alt={item.title} loading="lazy" />}<div><h3>{item.title}</h3>{item.excerpt && <p>{item.excerpt}</p>}{item.data?.price && <b className="ps-price">{item.data.price}</b>}</div></article>))}</div> : <p className="ps-field-hint">Nenhum imóvel publicado ainda.</p>}
          </section>
        );
      }
      default:
        return null;
    }
  };

  return (
    <main className="public-site-shell" style={{ ["--site-primary" as any]: primary, ["--site-accent" as any]: accent } as React.CSSProperties}>
      <header className="ps-header">
        <a className="ps-brand" href="#home">
          {safeImg(site.logoUrl) ? <img src={site.logoUrl!} alt={"Logo " + site.name} /> : <span className="ps-monogram" aria-hidden="true">{initials(site.name)}</span>}
          <strong>{site.name}</strong>
        </a>
        <nav className={"ps-nav " + (navOpen ? "is-open" : "")} aria-label="Navegação do site">
          {nav.map(p => <a key={p.slug} href={"#" + p.slug}>{p.title}</a>)}
          {site.forms.length ? <a className="ps-nav-cta" href="#formulario">Fale conosco</a> : null}
        </nav>
        <button type="button" className="ps-nav-toggle" aria-label="Menu" aria-expanded={navOpen} onClick={() => setNavOpen(v => !v)}><ChevronDown size={18} aria-hidden={!navOpen} /></button>
      </header>

      {navOpen && <div className="ps-nav-mobile" role="presentation" onClick={() => setNavOpen(false)}>{nav.map(p => <a key={p.slug} href={"#" + p.slug} onClick={() => setNavOpen(false)}>{p.title}</a>)}{site.forms.length ? <a href="#formulario" onClick={() => setNavOpen(false)}>Fale conosco</a> : null}</div>}

      {site.pages.map(page => (
        <article key={page.slug} id={page.slug} className="ps-page">
          {page.blocks.map(block => <div key={block.id}>{renderBlock(block)}</div>)}
        </article>
      ))}

      {site.forms.length ? (
        <section className="ps-section" id="formulario">
          <h2>Envie uma mensagem</h2>
          {site.forms.slice(0, 1).map((form: Form) => (
            sent === form.id ? <div key={form.id} className="ps-form-sent" role="status"><MessageCircle size={22} aria-hidden="true" /><p>Recebemos sua mensagem. Em breve entraremos em contato.</p><button type="button" className="ps-btn" onClick={() => setSent(null)}>Enviar outra mensagem</button></div> : (
              <form key={form.id} className="ps-form" onSubmit={e => { e.preventDefault(); const fd = new FormData(e.currentTarget); const values: Record<string, string> = {}; for (const [k, v] of fd.entries()) values[k] = String(v); void submit(form, values); }}>
                {form.fields.map((field: FormField) => (
                  <label key={field.id} className={"ps-field " + (field.type === "textarea" ? "ps-field-wide" : "")}>
                    <span>{field.label}{field.required ? " *" : ""}</span>
                    {field.type === "textarea" ? <textarea name={field.id} required={field.required} rows={3} /> : field.type === "select" && field.options?.length ? <select name={field.id} required={field.required}>{field.options.map(o => <option key={o}>{o}</option>)}</select> : <input type={field.type === "email" ? "email" : field.type === "phone" ? "tel" : "text"} name={field.id} required={field.required} />}
                  </label>
                ))}
                <button type="submit" className="ps-btn" disabled={busyForm === form.id}>{busyForm === form.id ? "Enviando…" : "Enviar mensagem"}</button>
              </form>
            )
          ))}
        </section>
      ) : null}

      <footer className="ps-footer">
        <p>{site.name} · Desenvolvido por <a href="https://vexorasuite.com.br" target="_blank" rel="noopener noreferrer">Véxora Suite</a></p>
      </footer>
    </main>
  );
}
