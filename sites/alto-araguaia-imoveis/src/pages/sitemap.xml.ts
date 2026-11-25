import type { APIRoute } from "astro";
import { getCollection } from "astro:content";
import { site } from "../data/site.config";
import { renderSitemap, type SitemapEntry } from "../lib/sitemap";

export const GET: APIRoute = async () => {
  const properties = await getCollection("properties");
  const entries: SitemapEntry[] = [
    { path: "/", priority: 1, changefreq: "weekly" },
    { path: "/imoveis/", priority: 0.9, changefreq: "weekly" },
    { path: "/imoveis-urbanos/", priority: 0.9, changefreq: "weekly" },
    { path: "/imoveis-rurais/", priority: 0.9, changefreq: "weekly" },
    ...properties.map((property) => ({
      path: `/imovel/${property.id}/`,
      priority: 0.8,
      changefreq: "weekly" as const,
    })),
    { path: "/sobre/", priority: 0.6 },
    { path: "/contato/", priority: 0.6 },
    { path: "/anuncie-seu-imovel/", priority: 0.6 },
    { path: "/p/politica-de-privacidade/", priority: 0.3 },
    { path: "/p/termos-de-uso/", priority: 0.3 },
  ];

  return new Response(renderSitemap(site.url, entries), {
    headers: { "Content-Type": "application/xml; charset=utf-8" },
  });
};
