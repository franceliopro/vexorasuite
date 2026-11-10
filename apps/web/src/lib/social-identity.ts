/**
 * Identidade social de contatos (frontend): deduz plataforma de origem e
 * o @usuário a partir do source/metadata gravado pelos canais.
 * Espelha social-identity.ts do backend.
 */
export type SocialPlatform = "instagram" | "facebook" | "messenger" | "tiktok" | "linkedin" | "youtube" | "telegram" | "x" | "threads" | "whatsapp" | "";

/** Plataforma social por token livre (source/channel/provider), ou "" quando não for rede social conhecida. */
export function socialPlatformOf(value?: string | null): SocialPlatform {
  const raw = (value || "").toLowerCase().trim();
  if (!raw) return "";
  if (raw.includes("instagram") || raw === "ig") return "instagram";
  if (raw.includes("messenger")) return "messenger";
  if (raw.includes("facebook") || raw === "fb") return "facebook";
  if (raw.includes("tiktok") || raw.includes("tik tok")) return "tiktok";
  if (raw.includes("linkedin")) return "linkedin";
  if (raw.includes("youtube") || raw === "yt") return "youtube";
  if (raw.includes("telegram")) return "telegram";
  if (raw === "x" || raw.includes("twitter") || raw === "x.com") return "x";
  if (raw.includes("threads")) return "threads";
  if (raw.includes("zernio:instagram")) return "instagram";
  if (raw.includes("zernio:facebook")) return "facebook";
  return "";
}

/** Plataforma social do contato: observa source, channel e provider, nessa ordem. */
export function socialPlatformOfContact(contact: { source?: string | null; metadata?: Record<string, unknown> | null }): SocialPlatform {
  const metadata = contact.metadata && typeof contact.metadata === "object" ? contact.metadata : {};
  const candidates = [
    typeof metadata.source === "string" ? metadata.source : "",
    typeof metadata.channel === "string" ? metadata.channel : "",
    typeof metadata.provider === "string" ? metadata.provider : "",
    contact.source || "",
  ];
  for (const candidate of candidates) {
    const platform = socialPlatformOf(candidate);
    if (platform) return platform;
  }
  return "";
}

/** True quando o contato veio de rede social (não WhatsApp, não e-mail, não manual). */
export function isSocialContact(contact: { source?: string | null; metadata?: Record<string, unknown> | null }): boolean {
  return socialPlatformOfContact(contact) !== "";
}

/** @usuário registrado no canal (sem o "@"), ou "" quando indisponível. */
export function socialHandleOf(contact: { metadata?: Record<string, unknown> | null }): string {
  const metadata = contact.metadata && typeof contact.metadata === "object" ? contact.metadata : {};
  const profile = metadata.profile && typeof metadata.profile === "object" && !Array.isArray(metadata.profile) ? (metadata.profile as Record<string, unknown>) : {};
  const candidates: unknown[] = [
    metadata.handle, metadata.username, metadata.platformUsername, metadata.instagramUsername, metadata.pageUsername, metadata.userName, metadata.slug,
    profile.username, profile.handle,
  ];
  // Instagram: tenta extrair do profileUrl quando não há campo de usuário.
  for (const value of [metadata.profileUrl, metadata.url, metadata.link, profile.url]) {
    if (typeof value !== "string" || !value) continue;
    try {
      const url = new URL(value);
      if (!["instagram.com", "www.instagram.com"].includes(url.hostname) || url.protocol !== "https:") continue;
      const name = url.pathname.split("/").filter(Boolean)[0];
      if (name && !["p", "reel", "reels", "stories", "explore"].includes(name)) candidates.push(name);
    } catch { /* link inválido — ignora */ }
  }
  for (const value of candidates) {
    if (typeof value !== "string") continue;
    const trimmed = value.trim().replace(/^@/, "");
    if (/^[\w.+-]{2,60}$/.test(trimmed)) return trimmed;
  }
  return "";
}

/** "@usuario" para exibição, ou "" quando indisponível. */
export function socialHandleLabel(contact: { metadata?: Record<string, unknown> | null }): string {
  const handle = socialHandleOf(contact);
  return handle ? "@" + handle : "";
}

/** Melhor contraste (texto escuro/claro) sobre o fundo de uma etiqueta. */
export function tagForeground(hex: string): string {
  const value = (hex || "").trim().replace(/^#/, "");
  const full = value.length === 3 ? value.split("").map((c) => c + c).join("") : value.length === 6 ? value : "eeecff";
  const r = parseInt(full.slice(0, 2), 16), g = parseInt(full.slice(2, 4), 16), b = parseInt(full.slice(4, 6), 16);
  if ([r, g, b].some(Number.isNaN)) return "#1f2937";
  const luminance = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  return luminance > 0.6 ? "#1f2937" : "#ffffff";
}
