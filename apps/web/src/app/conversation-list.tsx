"use client";

import { AlarmClock } from "lucide-react";
import { tagForeground } from "../lib/tag-contrast";
import { formatDateBR } from "../lib/date-format";
import { contactDisplayName } from "../lib/contact-identity";
import { ChannelMark, ContactAvatar, contactLabels } from "./inbox-avatars";
import type { Conversation } from "./inbox-workspace-types";

function timeShortLabel(value: string | undefined, now = new Date()): string {
  const date = new Date(value || "");
  if (!Number.isFinite(date.getTime())) return "";
  const minutes = Math.max(0, Math.floor((now.getTime() - date.getTime()) / 60000));
  if (minutes < 1) return "agora";
  if (minutes < 60) return `há ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `há ${hours} h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `há ${days} d`;
  return formatDateBR(date);
}

function presenceTone(conversation: Conversation): string | null {
  if (conversation.isOverdue) return "conversation-presence presence-dot-coral";
  const basis = conversation.updatedAt || conversation.createdAt;
  const age = basis ? Date.now() - new Date(basis).getTime() : Number.POSITIVE_INFINITY;
  const minutes = age / 60000;
  if (minutes <= 5) return "conversation-presence";
  if (minutes <= 20) return "conversation-presence presence-dot-amber";
  return null;
}

type OutboundMark = { glyph: string; tone: "queued" | "failed" | "sent" | "delivered" | "read"; label: string };

function outboundMark(status: string | undefined): OutboundMark | null {
  const normalized = String(status || "SENT").toUpperCase();
  if (normalized === "QUEUED") return { glyph: "◷", tone: "queued", label: "Enviando" };
  if (normalized === "FAILED") return { glyph: "!", tone: "failed", label: "Falhou" };
  if (normalized === "READ") return { glyph: "✓✓", tone: "read", label: "Lida" };
  if (normalized === "DELIVERED") return { glyph: "✓✓", tone: "delivered", label: "Entregue" };
  return { glyph: "✓", tone: "sent", label: "Enviada" };
}

export interface ConversationListProps {
  conversations: Conversation[];
  conversationsLoading: boolean;
  selectedId: string | null;
  queueView: string;
  onSelect: (conversation: Conversation) => void;
}

/** Lista lateral de conversas do Atendimento (avatar, presença, canal, tags, destaque de novas). */
export function ConversationList({ conversations, conversationsLoading, selectedId, queueView, onSelect }: ConversationListProps) {
  return (
    <div className="inbox-conversation-list">
      {conversations.map((item) => {
        const last = item.messages?.[0];
        const outbound = last?.direction === "OUTBOUND";
        const mark = outbound ? outboundMark(last?.status) : null;
        const preview = last?.content || "Sem mensagens";
        const previewText = preview.length > 30 ? preview.slice(0, 30) + "…" : preview;
        const tags = contactLabels(item.contact);
        return (
          <button key={item.id} className={"inbox-conversation " + (selectedId === item.id ? "selected" : "")} onClick={() => onSelect(item)}>
            <span className="conversation-avatar-wrap"><ContactAvatar contact={item.contact} />{presenceTone(item) ? <span className={presenceTone(item) as string} aria-hidden="true" /> : null}</span>
            <span className="conversation-summary">
              <span className="conversation-title-row"><strong>{contactDisplayName(item.contact, item.botState)}</strong><span className="conversation-channel-marks"><ChannelMark channel={item.channel || item.contact.source || "WHATSAPP"} /><ChannelMark kind="agent" mode={item.handlingMode} channel={String(item.botState?.mode || item.botState?.provider || (item.handlingMode === "BOT" ? "BOT" : ""))} /></span><span className="conversation-time">{timeShortLabel(item.lastMessageAt || item.createdAt)}</span></span>
              <small className="conversation-preview">{mark ? <span className={"conversation-tick tick-" + mark.tone} role="img" aria-label={mark.label}>{mark.glyph}</span> : null}<span className="conversation-preview-text">{previewText}</span></small>
              {item.isOverdue ? <span className="conversation-overdue"><AlarmClock size={11} /> Atrasado · sem assistência</span> : (!item.assignee && item.status === "OPEN" ? <span className="conversation-new"><span className="conversation-new-dot" aria-hidden="true" /> Nova há {timeShortLabel(item.lastMessageAt || item.createdAt)}</span> : null)}
            </span>
            {tags.length ? <span className="conversation-tags">{tags.map((tag, index) => <span key={tag.name + index} className="conversation-tag" style={{ backgroundColor: tag.color, color: tagForeground(tag.color), borderColor: "color-mix(in srgb, " + tag.color + " 82%, #334155)" }}>{tag.name}</span>)}</span> : null}
          </button>
        );
      })}
      {conversationsLoading && conversations.length === 0 ? <div className="inbox-empty" role="status"><strong>Carregando conversas…</strong><p>Buscando as conversas desta fila.</p></div> : null}
      {!conversationsLoading && !conversations.length ? <div className="inbox-empty"><strong>{queueView === "mine" ? "Nenhuma conversa atribuída a você" : queueView === "team" ? "Nenhuma conversa da sua equipe" : queueView === "others" ? "Nenhuma conversa em que você foi incluído" : "Nenhuma conversa nesta fila"}</strong><p>Você só vê conversas destinadas a você, às suas equipes ou incluídas por convite. A visão ampliada continua sujeita às permissões.</p></div> : null}
    </div>
  );
}
