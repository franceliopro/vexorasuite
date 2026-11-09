"use client";

import { useEffect, useState } from "react";
import { Instagram, Facebook, Mail, MessageCircle, Bot, BrainCircuit, Music2 } from "lucide-react";
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

export function ChannelMark({ channel, kind = "source", mode }: { channel?: string; kind?: "source" | "agent"; mode?: "BOT" | "HUMAN" }) {
  const value = (channel || "WHATSAPP").toUpperCase();
  if (kind === "agent") {
    if (mode !== "BOT") return null;
    if (!value.trim()) return null;
    const isAi = ["AI", "LLM", "OPENAI", "GPT", "IA"].some(token => value === token);
    return <span className={"channel-mark " + (isAi ? "channel-ai" : "channel-bot")} title={isAi ? "Atendimento por IA" : "Atendimento por chatbot"} aria-label={isAi ? "IA" : "Chatbot"}>{isAi ? <BrainCircuit size={12}/> : <Bot size={12}/>}</span>;
  }
  if (value.includes("EMAIL") || value.includes("E-MAIL")) return <span className="channel-mark channel-email" title="E-mail" aria-label="E-mail"><Mail size={13} strokeWidth={2.25}/></span>;
  if (value.includes("INSTAGRAM")) return <span className="channel-mark channel-instagram" title="Instagram" aria-label="Instagram"><Instagram size={13} strokeWidth={2.25}/></span>;
  if (value.includes("FACEBOOK") || value === "MESSENGER") return <span className="channel-mark channel-facebook" title="Facebook" aria-label="Facebook"><Facebook size={13} strokeWidth={2.25}/></span>;
  if (value.includes("TIKTOK")) return <span className="channel-mark channel-tiktok" title="TikTok" aria-label="TikTok"><Music2 size={13} strokeWidth={2.25}/></span>;
  if (value.includes("CHATBOT") || value.includes("WIDGET") || value.includes("WEBCHAT")) return <span className="channel-mark channel-bot" title="Chatbot do site" aria-label="Chatbot"><Bot size={13}/></span>;
  if (value.includes("AI") || value.includes("IA")) return <span className="channel-mark channel-ai" title="Inteligência artificial" aria-label="IA"><BrainCircuit size={13}/></span>;
  return <span className="channel-mark channel-whatsapp" title="WhatsApp" aria-label="WhatsApp"><svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true"><path fill="#25D366" d="M12 1.5a10.5 10.5 0 0 0-9.02 15.88L1.5 22.5l5.27-1.38A10.5 10.5 0 1 0 12 1.5Z"/><path fill="white" d="M12 3.5a8.5 8.5 0 0 0-7.3 12.85l.31.5-.79 2.9 2.98-.78.48.28A8.5 8.5 0 1 0 12 3.5Z"/><path fill="#25D366" d="M9.07 7.36c-.22-.48-.44-.49-.65-.5h-.55c-.19 0-.5.07-.77.36s-1 1-1 2.4 1.03 2.76 1.17 2.95c.14.2 2 3.2 4.94 4.37 2.44.97 2.94.78 3.47.73.53-.05 1.7-.7 1.94-1.37.24-.68.24-1.26.17-1.38-.07-.12-.27-.19-.57-.34l-1.68-.83c-.3-.14-.52-.21-.74.12-.22.34-.85 1.03-1.04 1.25-.2.22-.38.25-.68.1-.3-.14-1.28-.47-2.43-1.5-.9-.8-1.5-1.8-1.68-2.1-.18-.3-.02-.46.13-.61.14-.13.3-.34.45-.51.15-.17.2-.3.3-.5.1-.2.05-.38-.02-.53l-.75-1.8Z"/></svg></span>;
}

export function ContactAvatar({ contact, className = "conversation-avatar" }: { contact: Contact; className?: string }) {
  const proxy = "/api/backend/contacts/" + contact.id + "/avatar";
  const [src, setSrc] = useState<string | null>(proxy);
  useEffect(() => setSrc(proxy), [proxy, contact.metadata?.avatarUrl]);
  return <span className={className}>{src ? <img key={src} src={src} alt={"Foto de " + contactDisplayName(contact)} loading="lazy" referrerPolicy="no-referrer" onError={() => setSrc(current => current === proxy ? avatarUrl(contact) : null)}/> : null}{!src && <span className="avatar-fallback">{contactDisplayName(contact).slice(0, 1).toUpperCase()}</span>}</span>;
}

export function InitialsAvatar({ name }: { name: string }) {
  const trimmed = name.trim();
  if (!trimmed) return <span className="mention-avatar">?</span>;
  const parts = trimmed.split(/\s+/).filter(Boolean);
  const initials = parts.slice(0, 2).map((part) => part.charAt(0).toUpperCase()).join("") || "?";
  return <span className="mention-avatar">{initials}</span>;
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
