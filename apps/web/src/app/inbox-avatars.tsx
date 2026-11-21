"use client";

import { useEffect, useState } from "react";
import { Instagram, Facebook, Mail, Bot, BrainCircuit, Music2 } from "lucide-react";
import { WhatsAppGlyph } from "./brand-glyph";
import type { Contact } from "./inbox-workspace-types";
import { contactDisplayName } from "../lib/contact-identity";

export function avatarUrl(contact: Contact): string | null {
  const meta = (contact.metadata ?? {}) as Record<string, unknown>;
  for (const key of ["avatarUrl", "profilePictureUrl", "photoUrl", "pictureUrl", "profileImage", "profilePicUrl", "profilePicture", "imageUrl", "photo", "avatar"]) {
    const value = meta[key];
    if (typeof value === "string" && /^https:\/\//i.test(value)) return value;
  }
  return null;
}

/** Base comum dos marcadores de canal: forma neutra, cor vem do tom de cada canal. */
const channelBaseTw = "inline-grid h-ib-mark w-ib-mark flex-none place-items-center rounded-ib-channel";
const channelTw = {
  ai: "bg-blue-50 text-blue-700",
  bot: "bg-zinc-200 text-slate-600",
  email: "bg-blue-50 text-blue-700",
  instagram: "bg-red-100 text-red-600",
  facebook: "bg-blue-100 text-blue-800",
  tiktok: "bg-zinc-200 text-slate-950",
  whatsapp: "bg-emerald-100 text-emerald-600",
} as const;

export function ChannelMark({ channel, kind = "source", mode }: { channel?: string; kind?: "source" | "agent"; mode?: "BOT" | "HUMAN" }) {
  const value = (channel || "WHATSAPP").toUpperCase();
  if (kind === "agent") {
    if (mode !== "BOT") return null;
    if (!value.trim()) return null;
    const isAi = ["AI", "LLM", "OPENAI", "GPT", "IA"].some(token => value === token);
    const tone = isAi ? channelTw.ai : channelTw.bot;
    return <span className={channelBaseTw + " " + tone} title={isAi ? "Atendimento por IA" : "Atendimento por chatbot"} aria-label={isAi ? "IA" : "Chatbot"}>{isAi ? <BrainCircuit size={12}/> : <Bot size={12}/>}</span>;
  }
  if (value.includes("EMAIL") || value.includes("E-MAIL")) return <span className={channelBaseTw + " " + channelTw.email} title="E-mail" aria-label="E-mail"><Mail size={13} strokeWidth={2.25}/></span>;
  if (value.includes("INSTAGRAM")) return <span className={channelBaseTw + " " + channelTw.instagram} title="Instagram" aria-label="Instagram"><Instagram size={13} strokeWidth={2.25}/></span>;
  if (value.includes("FACEBOOK") || value === "MESSENGER") return <span className={channelBaseTw + " " + channelTw.facebook} title="Facebook" aria-label="Facebook"><Facebook size={13} strokeWidth={2.25}/></span>;
  if (value.includes("TIKTOK")) return <span className={channelBaseTw + " " + channelTw.tiktok} title="TikTok" aria-label="TikTok"><Music2 size={13} strokeWidth={2.25}/></span>;
  if (value.includes("CHATBOT") || value.includes("WIDGET") || value.includes("WEBCHAT")) return <span className={channelBaseTw + " " + channelTw.bot} title="Chatbot do site" aria-label="Chatbot"><Bot size={13}/></span>;
  if (value.includes("AI") || value.includes("IA")) return <span className={channelBaseTw + " " + channelTw.ai} title="Inteligência artificial" aria-label="IA"><BrainCircuit size={13}/></span>;
  return <span className={channelBaseTw + " " + channelTw.whatsapp} title="WhatsApp" aria-label="WhatsApp"><WhatsAppGlyph size={13}/></span>;
}

/** Preenchimento padrão para chamadores que não definem tamanho (ex.: lista de conversas). */
const contactAvatarFillTw = "relative block h-full w-full overflow-hidden rounded-full";

/** Avatar de contato: a forma vive nas utilities; a foto e o fallback são dados do contato. */
export function ContactAvatar({ contact, className = contactAvatarFillTw }: { contact: Contact; className?: string }) {
  const proxy = "/api/backend/contacts/" + contact.id + "/avatar";
  const [src, setSrc] = useState<string | null>(proxy);
  useEffect(() => setSrc(proxy), [proxy, contact.metadata?.avatarUrl]);
  return (
    <span className={className}>
      {src ? <img key={src} src={src} alt={"Foto de " + contactDisplayName(contact)} loading="lazy" referrerPolicy="no-referrer" className="block h-full w-full rounded-full object-cover" onError={() => setSrc(current => current === proxy ? avatarUrl(contact) : null)}/> : null}
      {!src && <span className="grid h-full w-full place-items-center rounded-full bg-ib-avatar text-ib-avatar-fallback font-extrabold tracking-tight text-white">{contactDisplayName(contact).slice(0, 1).toUpperCase()}</span>}
    </span>
  );
}

export function InitialsAvatar({ name }: { name: string }) {
  const trimmed = name.trim();
  if (!trimmed) return <span className="grid h-7 w-7 flex-none place-items-center rounded-full bg-blue-50 text-ib-tick font-ib text-blue-800">?</span>;
  const parts = trimmed.split(/\s+/).filter(Boolean);
  const initials = parts.slice(0, 2).map((part) => part.charAt(0).toUpperCase()).join("") || "?";
  return <span className="grid h-7 w-7 flex-none place-items-center rounded-full bg-blue-50 text-ib-tick font-ib text-blue-800" data-testid="mention-avatar">{initials}</span>;
}

export function contactLabels(contact: Contact): Array<{ name: string; color: string }> {
  const value = contact.metadata?.tags;
  if (!Array.isArray(value)) return [];
  return value.flatMap((raw) => {
    if (typeof raw === "string") return [{ name: raw, color: "#eeecff" }];
    if (raw && typeof raw === "object" && "name" in raw && typeof (raw as { name?: unknown }).name === "string")
      return [{ name: (raw as { name: string }).name, color: typeof (raw as { color?: unknown }).color === "string" ? (raw as { color: string }).color : "#eeecff" }];
    return [];
  });
}
