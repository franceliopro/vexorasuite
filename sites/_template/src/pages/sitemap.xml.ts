import type { APIRoute } from "astro";
import { site } from "../data/site.config";
import { renderSitemap } from "../lib/sitemap";

export const GET: APIRoute = () => {
  const body = renderSitemap(site.url, [
    { path: "/", priority: 1, changefreq: "weekly" },
    { path: "/sobre/", priority: 0.7 },
    { path: "/contato/", priority: 0.7 },
  ]);

  return new Response(body, {
    headers: { "Content-Type": "application/xml; charset=utf-8" },
  });
};
