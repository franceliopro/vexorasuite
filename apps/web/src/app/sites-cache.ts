"use client";
export type Site = any;
export type Form = any;
export type Item = any;
export type Page = any;
export type Block = any;

const sitesCache = new Map<string, Site[]>();

export function readSitesCache(tenantId?: string): Site[] | null {
  const key = tenantId || "__default__";
  const cached = sitesCache.get(key);
  if (cached) return cached;
  if (typeof window === "undefined") return null;
  try {
    const stored = window.localStorage.getItem("vx:sites-cache:" + key);
    if (stored) {
      const parsed = JSON.parse(stored);
      sitesCache.set(key, parsed);
      return parsed;
    }
  } catch { /* ignore */ }
  return null;
}

export function writeSitesCache(tenantId: string | undefined, data: Site[]) {
  const key = tenantId || "__default__";
  sitesCache.set(key, data);
  if (typeof window !== "undefined") {
    try { window.localStorage.setItem("vx:sites-cache:" + key, JSON.stringify(data)); } catch { /* ignore */ }
  }
}
