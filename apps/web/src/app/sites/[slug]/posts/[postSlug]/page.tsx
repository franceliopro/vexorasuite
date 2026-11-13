"use client";
import { use, useEffect, useState } from "react";
import Link from "next/link";
import sanitizeHtml from "sanitize-html";
import { ArrowLeft, CalendarDays } from "lucide-react";

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
const stripHtml = (html: string) => html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
const initials = (n: string) => n.trim().split(/\s+/).slice(0, 2).map(w => w[0]?.toUpperCase() || "").join("") || "V";
const safeBody = (html: string) => sanitizeHtml(String(html || ""), SANITIZE_OPTIONS);

function formatDate(iso: string) { const d = new Date(iso); return Number.isNaN(d.getTime()) ? "" : d.toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" }); }

export default function SitePostPage({ params }: { params: Promise<{ slug: string; postSlug: string }> }) {
  const { slug, postSlug } = use(params);
  const [site, setSite] = useState<Site | null>(null);
  const [post, setPost] = useState<Item | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/backend/public/sites/" + encodeURIComponent(slug), { cache: "no-store" })
      .then(async r => { const data = await r.json().catch(() => ({})); if (!r.ok) throw new Error("Este site não está disponível no momento."); const normalized = data?.site && typeof data.site === "object" ? data.site : data; return normalized; })
      .then((normalized: any) => {
        const items: Item[] = Array.isArray(normalized?.items) ? normalized.items : [];
        const match = items.find(i => i.kind === "post" && i.slug === postSlug);
        if (!match) throw new Error("Esta matéria não existe ou não está publicada.");
        setSite(normalized as Site);
        setPost(match);
      })
      .catch(e => setError(e instanceof Error ? e.message : "Não foi possível carregar a matéria."));
  }, [slug, postSlug]);

  if (!site || !post) return error ? (
    <main className="ps-post-shell"><section className="ps-post-error"><h1>Ops…</h1><p>{error}</p><Link className="ps-btn" href={"/sites/" + slug}>Voltar ao site</Link></section></main>
  ) : (
    <main className="ps-post-shell"><section className="ps-post-error" role="status"><p>Carregando matéria…</p></section></main>
  );

  const bodyHtml = safeBody(String(post.data?.body || ""));
  const cover = safeImg(post.coverUrl) || safeImg(String(post.data?.coverUrl || ""));
  const date = post.publishedAt || post.createdAt || "";
  return (
    <main className="ps-post-shell">
      <header className="ps-post-header" style={{ ["--site-primary" as any]: site.primaryColor, ["--site-accent" as any]: site.accentColor } as React.CSSProperties}>
        <Link className="ps-post-back" href={"/sites/" + slug}><ArrowLeft size={17} aria-hidden="true" /> {site.name}</Link>
        <span className="ps-post-brand">{safeImg(site.logoUrl) ? <img src={site.logoUrl!} alt={"Logo " + site.name} /> : <span className="ps-post-monogram">{initials(site.name)}</span>}<strong>{site.name}</strong></span>
      </header>
      <article className="ps-post-article" style={{ ["--site-primary" as any]: site.primaryColor, ["--site-accent" as any]: site.accentColor } as React.CSSProperties}>
        {post.createdAt || post.publishedAt ? <p className="ps-post-date"><CalendarDays size={15} aria-hidden="true" /> {formatDate(date)}</p> : null}
        <h1>{post.title}</h1>
        {post.excerpt ? <p className="ps-post-excerpt">{post.excerpt}</p> : null}
        {cover ? <figure className="ps-post-cover"><img src={cover} alt={post.excerpt || post.title} /></figure> : null}
        <div className="ps-post-body" dangerouslySetInnerHTML={{ __html: bodyHtml || "<p>Conteúdo em elaboração.</p>" }} />
      </article>
      <footer className="ps-post-footer"><p>{site.name} · Desenvolvido por <a href="https://vexorasuite.com.br" target="_blank" rel="noreferrer">Véxora Suite</a></p></footer>
    </main>
  );
}
