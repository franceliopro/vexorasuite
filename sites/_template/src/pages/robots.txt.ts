import type { APIRoute } from "astro";
import { site } from "../data/site.config";
import { renderRobots } from "../lib/sitemap";

export const GET: APIRoute = () =>
  new Response(renderRobots(site.url), {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
