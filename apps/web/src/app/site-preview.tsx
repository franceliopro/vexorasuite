"use client";
import { MapPin, Phone, Mail, ArrowRight, Star, ChevronDown } from "lucide-react";
import type { CSSProperties } from "react";

export type PreviewSite = {
  id: string;
  name: string;
  slug: string;
  primaryColor: string;
  accentColor: string;
  departments?: { platform: string; label: string; handle: string; url?: string }[];
  kind: string;
  businessArea: string;
  logoUrl?: string | null;
  pages: { id?: string; slug: string; kind: string; title: string; sortOrder: number; blocks: { id: string; type: string; content: any; sortOrder: number }[] }[];
  forms?: { id: string; name: string; fields: { id: string; label: string; type: string; required: boolean; options?: string[] }[] }[];
  items?: { id: string; kind: string; slug: string; title: string; excerpt?: string | null; coverUrl?: string | null; data: any; publishedAt?: string | null }[];
};

const initials = (n: string) => n.trim().split(/\s+/).slice(0, 2).map(w => w[0]?.toUpperCase() || "").join("") || "S";
const waHref = (h: string) => "https://wa.me/" + h.replace(/\D/g, "");
const deptHref = (d: { platform: string; handle: string; url?: string }) => d.url || (d.platform === "whatsapp" ? waHref(d.handle) : d.platform === "instagram" ? "https://instagram.com/" + d.handle.replace(/^@/, "") : d.platform === "facebook" ? "https://facebook.com/" + d.handle.replace(/^@/, "") : d.handle);
const safeImg = (url?: string | null) => url && (/^https?:\/\//i.test(url) || /^\/(?!\/)/.test(url)) ? url : null;

/** In-memory preview of the site — same look as the public renderer, no server round trip. */
export function SitePreview({ site, highlightBlockId, onBlockClick }: { site: PreviewSite; highlightBlockId?: string | null; onBlockClick?: (blockId: string) => void }) {
  if (!site) return null;
  const primary = site.primaryColor;
  const accent = site.accentColor;
  const page = (site.pages || []).slice().sort((a, b) => a.sortOrder - b.sortOrder)[0];
  const blockGlow = (id?: string) => highlightBlockId && id === highlightBlockId ? { outline: "2px solid #7DD3FC", outlineOffset: "2px" } : {};

  const renderBlock = (block: any) => {
    const c = block.content || {};
    const common: CSSProperties = blockGlow(block.id);
    switch (block.type) {
      case "hero":
        { const heroStyle: CSSProperties | undefined = (c.imageUrl as string | undefined)?.match(/^https?:\/\//) ? { backgroundImage: `linear-gradient(135deg, rgba(5,13,34,0.78), rgba(10,23,48,0.55)), url("${String(c.imageUrl)}")`, backgroundSize: "cover", backgroundPosition: "center", color: "#E7EEFF" } : undefined; return <section className="ps-hero" style={{...common, ...heroStyle}}><span className="ps-badge" style={heroStyle?{color:"#FFFFFF",background:"rgba(255,255,255,.14)"}:undefined}>{c.badge || site.businessArea || "Site"}</span><h1>{c.headline || site.name}</h1><p>{c.sub}</p><a className="ps-btn" href={c.ctaUrl || "#"} target="_self">{c.ctaLabel || "Quero conversar"}<ArrowRight size={16} aria-hidden="true" /></a></section>; }
      case "richText":
        return <section className="ps-section" style={common}><h2>{c.title || ""}</h2>{String(c.body || "").split("\n").filter(Boolean).map((line: string, i: number) => <p key={i}>{line}</p>)}</section>;
      case "services":
        return <section className="ps-section" style={common}><h2>{c.title || "O que fazemos"}</h2><div className="ps-services">{(c.items || []).map((item: any, i: number) => <article key={i} className="ps-service"><span className="ps-service-check" aria-hidden="true"><Star size={15} /></span><div><h3>{item.title}</h3><p>{item.text}</p></div></article>)}</div></section>;
      case "testimonials":
        return <section className="ps-section" style={common}><h2>{c.title || "Depoimentos"}</h2><div className="ps-testimonials">{(c.items || []).map((item: any, i: number) => <figure key={i} className="ps-testimonial"><Star size={16} aria-hidden="true" fill={primary} /><blockquote>“{item.text}”</blockquote><figcaption>{item.name}</figcaption></figure>)}</div></section>;
      case "faq":
        return <section className="ps-section" style={common}><h2>{c.title || "Perguntas frequentes"}</h2>{(c.items || []).map((item: any, i: number) => <details key={i} className="ps-faq"><summary>{item.question}<ChevronDown size={15} aria-hidden="true" /></summary><p>{item.answer}</p></details>)}</section>;
      case "cta":
        return <section className="ps-cta" style={{ background: `linear-gradient(135deg, ${primary}, ${accent})`, ...common }}><div><h2>{c.title || "Pronto para começar?"}</h2>{c.sub && <p>{c.sub}</p>}</div><a className="ps-btn ps-btn-ghost" href={c.ctaUrl || "#"}>{c.ctaLabel || "Quero conversar"}</a></section>;
      case "gallery":
        return <section className="ps-section" style={common}><h2>{c.title || "Galeria"}</h2><div className="ps-gallery">{(c.items || []).map((item: any, i: number) => safeImg(item.url) && <figure key={i} className="ps-gallery-item"><img src={item.url} alt={item.caption || "Foto"} loading="lazy" />{item.caption ? <figcaption>{item.caption}</figcaption> : null}</figure>)}</div></section>;
      case "contact":
        return <section className="ps-section" style={common}><h2>{c.title || "Fale com a gente"}</h2><div className="ps-contact-grid">{(site.departments || []).map((d: any, i: number) => { const Icon = d.platform === "whatsapp" || d.platform === "phone" ? Phone : d.platform === "email" ? Mail : MapPin; return <a key={i} href={deptHref(d)} className="ps-contact-item" target="_blank" rel="noreferrer"><Icon size={17} aria-hidden="true" /><span><b>{d.label || d.platform}</b><small>{d.handle}</small></span></a>; })}</div></section>;
      case "posts": {
        const items = (site.items || []).filter(i => i.kind === "post").slice(0, 6);
        return <section className="ps-section" style={common}><h2>{c.title || "Últimas matérias"}</h2>{items.length ? <div className="ps-items">{items.map(i => <article key={i.id} className="ps-item-card">{safeImg(i.coverUrl) && <img src={i.coverUrl!} alt={i.title} />}<div><h3>{i.title}</h3>{i.excerpt && <p>{i.excerpt}</p>}</div></article>)}</div> : <p className="ps-field-hint">Nenhuma matéria publicada ainda.</p>}</section>;
      }
      case "properties": {
        const items = (site.items || []).filter(i => i.kind === "property").slice(0, 9);
        return <section className="ps-section" style={common}><h2>{c.title || "Imóveis disponíveis"}</h2>{items.length ? <div className="ps-items">{items.map(i => <article key={i.id} className="ps-item-card">{safeImg(i.coverUrl) && <img src={i.coverUrl!} alt={i.title} />}<div><h3>{i.title}</h3>{i.excerpt && <p>{i.excerpt}</p>}{i.data?.price && <b className="ps-price">{i.data.price}</b>}</div></article>)}</div> : <p className="ps-field-hint">Nenhum imóvel publicado ainda.</p>}</section>;
      }
      case "spacer":
        return <div style={{ height: Number(c.size || 48) }} aria-hidden="true" />;
      case "divider":
        return <hr className="ps-divider" style={{ borderStyle: c.style === "dashed" ? "dashed" : "solid" }} />;
      default:
        return null;
    }
  };

  return (
    <main className="public-site-shell" style={{ ["--site-primary" as any]: primary, ["--site-accent" as any]: accent } as CSSProperties}>
      <header className="ps-header">
        <span className="ps-brand">{safeImg(site.logoUrl) ? <img src={site.logoUrl!} alt={"Logo " + site.name} /> : <span className="ps-monogram">{initials(site.name)}</span>}<strong>{site.name}</strong></span>
        <nav className="ps-nav">{(site.pages || []).filter(p => p.slug !== "inicio").map(p => <a key={p.slug} href="#" onClick={e => e.preventDefault()}>{p.title}</a>)}</nav>
      </header>
      {(page?.blocks || []).sort((a, b) => a.sortOrder - b.sortOrder).map(block => {
        const element = renderBlock(block);
        if (onBlockClick) {
          return <div key={block.id} className="ps-block-select" role="button" tabIndex={0} title="Clique para selecionar o bloco" onClick={() => onBlockClick(block.id)} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onBlockClick(block.id); } }}>{element}</div>;
        }
        return <div key={block.id}>{element}</div>;
      })}
      <footer className="ps-footer"><p>{site.name} · Desenvolvido por <a href="https://vexorasuite.com.br" target="_blank" rel="noreferrer">Véxora Suite</a></p></footer>
    </main>
  );
}
