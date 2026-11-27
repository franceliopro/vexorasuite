import type { APIRoute } from "astro";
import { site } from "../data/site.config";
import { itemPath, readyItems, safeLastmod } from "../lib/catalog";
import { renderSitemap } from "../lib/sitemap";

export const GET: APIRoute = () => {
  const body = renderSitemap(site.url, [
    { path: "/", priority: 1, changefreq: "weekly" },
    { path: "/servicos/", priority: 0.8, changefreq: "weekly" },
    { path: "/sobre/", priority: 0.7 },
    { path: "/contato/", priority: 0.7 },
    ...readyItems.map((item) => ({
      path: itemPath(item.id),
      priority: 0.6,
      lastmod: safeLastmod(item.updatedAt),
    })),
  ]);

  return new Response(body, {
    headers: { "Content-Type": "application/xml; charset=utf-8" },
  });
};
