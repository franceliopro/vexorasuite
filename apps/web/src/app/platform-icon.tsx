"use client";
import {
  Instagram,
  Facebook,
  MessageCircle,
  Mail as MailIcon,
  Linkedin,
  Youtube,
  Music2,
  Send,
  Gamepad2,
  Ghost,
  Twitter,
  Cloud,
  AtSign,
  Plug,
} from "lucide-react";
import { WhatsAppGlyph, GoogleGlyph } from "./brand-glyph";

const platformNames: Record<string, string> = {
  email: "E-mail",
  instagram: "Instagram",
  facebook: "Facebook",
  messenger: "Messenger",
  whatsapp: "WhatsApp",
  tiktok: "TikTok",
  linkedin: "LinkedIn",
  youtube: "YouTube",
  threads: "Threads",
  pinterest: "Pinterest",
  x: "X",
  twitter: "X",
  reddit: "Reddit",
  bluesky: "Bluesky",
  telegram: "Telegram",
  discord: "Discord",
  snapchat: "Snapchat",
  googlebusiness: "Google Business",
  google: "Google",
};

const platformColors: Record<string, string> = {
  email: "#EA4335",
  instagram: "#D9468D",
  facebook: "#1877F2",
  messenger: "#168AFF",
  whatsapp: "#25D366",
  tiktok: "#20242B",
  linkedin: "#0A66C2",
  youtube: "#E53935",
  threads: "#303030",
  pinterest: "#BD081C",
  x: "#111827",
  twitter: "#111827",
  reddit: "#FF4500",
  bluesky: "#1685FE",
  telegram: "#229ED9",
  discord: "#5865F2",
  snapchat: "#E5C900",
  googlebusiness: "#4285F4",
  google: "#4285F4",
};

/** Normaliza um identificador de canal (provider, plataforma, "WAHA"…) para a chave canônica. */
export function normalizePlatform(value?: string | null): string {
  const raw = (value || "").toLowerCase().trim();
  if (!raw) return "";
  if (raw.includes("gmail") || raw.includes("google") || raw.includes("outlook") || raw.includes("email") || raw.includes("e-mail")) return "email";
  if (raw.includes("waha") || raw.includes("whatsapp") || raw.includes("whats")) return "whatsapp";
  if (raw.includes("instagram") || raw === "ig" || raw.includes("zerma") || raw.includes("zernio:instagram")) return "instagram";
  if (raw.includes("messenger")) return "messenger";
  if (raw.includes("facebook") || raw.includes("zernio:facebook")) return "facebook";
  if (raw.includes("linkedin")) return "linkedin";
  if (raw.includes("youtube") || raw.includes("yt")) return "youtube";
  if (raw.includes("tiktok")) return "tiktok";
  if (raw.includes("telegram")) return "telegram";
  if (raw.includes("discord")) return "discord";
  if (raw.includes("snapchat")) return "snapchat";
  if (raw.includes("threads")) return "threads";
  if (raw.includes("pinterest")) return "pinterest";
  if (raw.includes("reddit")) return "reddit";
  if (raw.includes("bluesky")) return "bluesky";
  if (raw === "x" || raw.includes("twitter")) return "x";
  if (raw.includes("googlebusiness")) return "googlebusiness";
  return "";
}

export function platformLabel(value?: string | null): string {
  const key = normalizePlatform(value);
  return key ? platformNames[key] || value || "Canal" : value?.trim() || "Canal";
}

export function platformColor(value?: string | null): string {
  return platformColors[normalizePlatform(value)] || "#64748B";
}

/** Logotipo original da rede — sem caixa, sem cor de fundo. */
export function PlatformIcon({ platform, size = 18 }: { platform?: string | null; size?: number }) {
  const value = normalizePlatform(platform);
  const color = platformColor(platform);
  const stroke = { size, strokeWidth: 1.9, color, "aria-hidden": true as const };
  switch (value) {
    case "email":
      return <MailIcon {...stroke} />;
    case "instagram":
      return <Instagram {...stroke} />;
    case "facebook":
      return <Facebook {...stroke} />;
    case "messenger":
      return <Facebook {...stroke} />;
    case "linkedin":
      return <Linkedin {...stroke} />;
    case "youtube":
      return <Youtube {...stroke} />;
    case "tiktok":
      return <Music2 {...stroke} />;
    case "telegram":
      return <Send {...stroke} />;
    case "discord":
      return <Gamepad2 {...stroke} />;
    case "snapchat":
      return <Ghost {...stroke} />;
    case "x":
      return <Twitter {...stroke} />;
    case "bluesky":
      return <Cloud {...stroke} />;
    case "threads":
      return <AtSign {...stroke} />;
    case "pinterest":
    case "reddit":
      return <MessageCircle {...stroke} />;
    case "googlebusiness":
    case "google":
      return <GoogleGlyph size={size} />;
    case "whatsapp":
      return <WhatsAppGlyph size={size} />;
    case "":
      return <Plug {...stroke} />;
    default:
      return <MessageCircle {...stroke} />;
  }
}
