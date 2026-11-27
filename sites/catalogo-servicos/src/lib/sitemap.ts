import { safeBaseUrl } from "./config";

export type SitemapEntry = {
  path: string;
  priority?: number;
  changefreq?: "daily" | "weekly" | "monthly" | "yearly";
  lastmod?: string;
};

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function renderSitemap(base: string, entries: SitemapEntry[]): string {
  const root = safeBaseUrl(base);
  const today = new Date().toISOString().slice(0, 10);
  const urls = entries
    .map((entry) => {
      const path = entry.path.startsWith("/") ? entry.path : `/${entry.path}`;
      const loc = `${root}${path}`;
      const priority = entry.priority ?? 0.5;
      const changefreq = entry.changefreq ?? "monthly";
      const lastmod = entry.lastmod ?? today;
      return [
        "  <url>",
        `    <loc>${escapeXml(loc)}</loc>`,
        `    <lastmod>${lastmod}</lastmod>`,
        `    <changefreq>${changefreq}</changefreq>`,
        `    <priority>${priority}</priority>`,
        "  </url>",
      ].join("\n");
    })
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
}

export function renderRobots(base: string): string {
  const sitemap = `${safeBaseUrl(base)}/sitemap.xml`;
  return `User-agent: *\nAllow: /\nDisallow: /api/\n\nSitemap: ${sitemap}\n`;
}
