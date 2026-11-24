import type { APIRoute } from "astro";
import { getCollection } from "astro:content";
import { site } from "../data/site.config";
import { renderSitemap, type SitemapEntry } from "../lib/sitemap";

export const GET: APIRoute = async () => {
  const properties = await getCollection("properties");
  const entries: SitemapEntry[] = [
    { path: "/", priority: 1, changefreq: "weekly" },
    { path: "/imoveis/", priority: 0.9, changefreq: "weekly" },
    ...properties.map((property) => ({
      path: `/imoveis/${property.id}/`,
      priority: 0.7,
    })),
    { path: "/sobre/", priority: 0.6 },
    { path: "/contato/", priority: 0.6 },
  ];

  return new Response(renderSitemap(site.url, entries), {
    headers: { "Content-Type": "application/xml; charset=utf-8" },
  });
};
