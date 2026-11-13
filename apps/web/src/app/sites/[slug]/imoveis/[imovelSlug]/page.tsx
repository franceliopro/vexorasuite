"use client";
import { use, useEffect, useState } from "react";
import Link from "next/link";
import sanitizeHtml from "sanitize-html";
import { ArrowLeft, BedDouble, Bath, Ruler, MapPin, X, ChevronLeft, ChevronRight, MessageCircle, CalendarDays } from "lucide-react";
import { formatBRL } from "../../../../../lib/money";

type ItemImage = { url: string; alt?: string };
type Item = { id: string; kind: string; slug: string; title: string; excerpt?: string | null; coverUrl?: string | null; data: any; publishedAt?: string | null; createdAt?: string };
type Site = { slug: string; name: string; logoUrl?: string | null; departments: { platform: string; label: string; handle: string; url?: string }[]; primaryColor: string; accentColor: string };

const SANITIZE_OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: ["h2", "h3", "h4", "p", "br", "strong", "b", "em", "i", "u", "s", "code", "pre", "blockquote", "ul", "ol", "li", "figure", "figcaption", "img", "a", "iframe", "hr"],
  allowedAttributes: { a: ["href", "target", "rel"], img: ["src", "alt", "width", "height"], iframe: ["src", "width", "height", "title", "allow", "allowfullscreen", "frameborder"], figure: ["class", "data-vx-gallery"], blockquote: [], pre: [], code: [] },
  allowedSchemes: ["https", "http", "mailto", "tel"],
  allowedIframeHostnames: ["www.youtube-nocookie.com", "www.youtube.com", "youtube.com", "player.vimeo.com"],
  transformTags: { a: (tagName, attribs) => ({ tagName: "a", attribs: { ...attribs, rel: "noopener noreferrer", target: attribs.target === "_blank" ? "_blank" : "_self" } }) },
};
const safeImg = (url?: string | null) => url && (/^https?:\/\//i.test(url) || /^\/(?!\/)/.test(url)) ? url : null;
const initials = (n: string) => n.trim().split(/\s+/).slice(0, 2).map(w => w[0]?.toUpperCase() || "").join("") || "I";
const waHref = (h: string) => "https://wa.me/" + h.replace(/\D/g, "");
const formatDate = (iso: string) => { const d = new Date(iso); return Number.isNaN(d.getTime()) ? "" : d.toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" }); };

export default function SitePropertyPage({ params }: { params: Promise<{ slug: string; imovelSlug: string }> }) {
  const { slug, imovelSlug } = use(params);
  const [site, setSite] = useState<Site | null>(null);
  const [imovel, setImovel] = useState<Item | null>(null);
  const [error, setError] = useState("");
  const [active, setActive] = useState(0);
  const [lightbox, setLightbox] = useState(false);

  useEffect(() => {
    fetch("/api/backend/public/sites/" + encodeURIComponent(slug), { cache: "no-store" })
      .then(async r => { const data = await r.json().catch(() => ({})); if (!r.ok) throw new Error("Este site não está disponível no momento."); const normalized = data?.site && typeof data.site === "object" ? data.site : data; return normalized; })
      .then((normalized: any) => {
        const items: Item[] = Array.isArray(normalized?.items) ? normalized.items : [];
        const match = items.find(i => i.kind === "property" && i.slug === imovelSlug);
        if (!match) throw new Error("Este imóvel não existe ou não está publicado.");
        setSite(normalized as Site);
        setImovel(match);
      })
      .catch(e => setError(e instanceof Error ? e.message : "Não foi possível carregar o imóvel."));
  }, [slug, imovelSlug]);

  useEffect(() => {
    if (!lightbox) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setLightbox(false);
      else if (event.key === "ArrowRight") setActive(v => Math.min(v + 1, ((site && imovel?.data?.images?.length) || 1) - 1));
      else if (event.key === "ArrowLeft") setActive(v => Math.max(v - 1, 0));
    };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", onKey); document.body.style.overflow = ""; };
  }, [lightbox, site, imovel]);

  if (!site || !imovel) return error ? (
    <main className="ps-post-shell"><section className="ps-post-error"><h1>Ops…</h1><p>{error}</p><Link className="ps-btn" href={"/sites/" + slug}>Voltar ao site</Link></section></main>
  ) : (
    <main className="ps-post-shell"><section className="ps-post-error" role="status"><p>Carregando imóvel…</p></section></main>
  );

  const data = imovel.data || {};
  const images: ItemImage[] = (Array.isArray(data.images) && data.images.length ? data.images : (imovel.coverUrl ? [{ url: imovel.coverUrl }] : [])).map((img: any) => ({ url: safeImg(String(img?.url || "")) || "", alt: String(img?.alt || imovel.title) })).filter((img: ItemImage) => img.url);
  const current = images[Math.min(active, Math.max(0, images.length - 1))];
  const bodyHtml = sanitizeHtml(String(data?.body || ""), SANITIZE_OPTIONS);
  const whatsapp = (site.departments || []).find(d => d.platform === "whatsapp" || d.platform === "phone");
  const ctaHref = whatsapp ? waHref(whatsapp.handle) : "/sites/" + slug + "#contato";

  return (
    <main className="ps-post-shell" style={{ ["--site-primary" as any]: site.primaryColor, ["--site-accent" as any]: site.accentColor } as React.CSSProperties}>
      <header className="ps-post-header">
        <Link className="ps-post-back" href={"/sites/" + slug}><ArrowLeft size={17} aria-hidden="true" /> {site.name}</Link>
        <span className="ps-post-brand">{safeImg(site.logoUrl) ? <img src={site.logoUrl!} alt={"Logo " + site.name} /> : <span className="ps-post-monogram">{initials(site.name)}</span>}<strong>{site.name}</strong></span>
      </header>
      <article className="ps-property-article">
        {imovel.createdAt || imovel.publishedAt ? <p className="ps-post-date"><CalendarDays size={15} aria-hidden="true" /> {formatDate(imovel.publishedAt || imovel.createdAt || "")}</p> : null}
        <h1>{imovel.title}</h1>
        {imovel.excerpt ? <p className="ps-post-excerpt">{imovel.excerpt}</p> : null}

        <div className="ps-property-grid">
          <div className="ps-property-gallery" data-images-count={images.length}>
            {current && (
              <button type="button" className="ps-property-main" onClick={() => setLightbox(true)} aria-label="Ampliar foto">
                <img src={current.url} alt={current.alt} />
                {images.length > 1 && <span className="ps-property-counter">{Math.min(active, images.length - 1) + 1} / {images.length}</span>}
              </button>
            )}
            {images.length > 1 && (
              <div className="ps-property-thumbs" role="tablist" aria-label="Fotos do imóvel">
                {images.map((img, index) => (
                  <button key={index} type="button" role="tab" aria-selected={index === Math.min(active, images.length - 1)} className={"ps-property-thumb" + (index === Math.min(active, images.length - 1) ? " active" : "")} onClick={() => setActive(index)}><img src={img.url} alt={img.alt} loading="lazy" /></button>
                ))}
              </div>
            )}
          </div>

          <aside className="ps-property-details">
            {data?.price && <p className="ps-property-price">{formatBRL(String(data.price))}</p>}
            {data?.location && <p className="ps-property-location"><MapPin size={16} aria-hidden="true" /> {String(data.location)}</p>}
            <ul className="ps-property-facts">
              {data?.beds !== undefined && data?.beds !== "" && <li><BedDouble size={18} aria-hidden="true" /><span><b>{data.beds}</b> quartos</span></li>}
              {data?.baths !== undefined && data?.baths !== "" && <li><Bath size={18} aria-hidden="true" /><span><b>{data.baths}</b> banheiros</span></li>}
              {data?.area !== undefined && data?.area !== "" && <li><Ruler size={18} aria-hidden="true" /><span><b>{data.area}</b> m²</span></li>}
            </ul>
            <a className="ps-btn ps-property-cta" href={ctaHref} target={ctaHref.startsWith("http") ? "_blank" : "_self"} rel={ctaHref.startsWith("http") ? "noopener noreferrer" : undefined}><MessageCircle size={18} aria-hidden="true" /> Quero visitar</a>
            <p className="ps-property-disclaimer">Valores e disponibilidade sujeitos a confirmação com a imobiliária.</p>
          </aside>
        </div>

        {bodyHtml && <div className="ps-post-body" dangerouslySetInnerHTML={{ __html: bodyHtml }} />}
      </article>

      {lightbox && current && (
        <div className="ps-lightbox" role="dialog" aria-modal="true" aria-label="Galeria de fotos">
          <button type="button" className="ps-lightbox-close" aria-label="Fechar" onClick={() => setLightbox(false)}><X size={26} aria-hidden="true" /></button>
          <button type="button" className="ps-lightbox-nav ps-lightbox-prev" aria-label="Foto anterior" onClick={() => setActive(v => Math.max(0, v - 1))} disabled={active <= 0}><ChevronLeft size={34} aria-hidden="true" /></button>
          <img className="ps-lightbox-image" src={current.url} alt={current.alt} />
          <button type="button" className="ps-lightbox-nav ps-lightbox-next" aria-label="Próxima foto" onClick={() => setActive(v => Math.min(images.length - 1, v + 1))} disabled={active >= images.length - 1}><ChevronRight size={34} aria-hidden="true" /></button>
          <p className="ps-lightbox-counter">{Math.min(active, images.length - 1) + 1} / {images.length}</p>
        </div>
      )}
      <footer className="ps-post-footer"><p>{site.name} · Desenvolvido por <a href="https://vexorasuite.com.br" target="_blank" rel="noreferrer">Véxora Suite</a></p></footer>
    </main>
  );
}
