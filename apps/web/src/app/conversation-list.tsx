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

/** Tons de presença: utilities padrão, escolhidas pelos dados da conversa. */
const presenceToneTw = {
  overdue: "bg-red-600",
  live: "bg-blue-600",
  idle: "bg-amber-600",
} as const;

type PresenceTone = keyof typeof presenceToneTw;

function presenceTone(conversation: Conversation): PresenceTone | null {
  if (conversation.isOverdue) return "overdue";
  const basis = conversation.updatedAt || conversation.createdAt;
  const age = basis ? Date.now() - new Date(basis).getTime() : Number.POSITIVE_INFINITY;
  const minutes = age / 60000;
  if (minutes <= 5) return "live";
  if (minutes <= 20) return "idle";
  return null;
}

type OutboundMark = { glyph: string; tone: "queued" | "failed" | "sent" | "delivered" | "read"; label: string };

/** Tons do comprovante de envio; o verde de "lida" é o do WhatsApp. */
const tickToneTw: Record<OutboundMark["tone"], string> = {
  queued: "text-amber-600 dark:text-amber-400",
  failed: "font-extrabold text-red-600 dark:text-red-400",
  sent: "text-slate-600 dark:text-slate-300",
  delivered: "text-slate-950 dark:text-slate-200",
  read: "text-emerald-600 dark:text-emerald-400",
};

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

const conversationRowTw = "relative flex w-full flex-wrap content-start items-start gap-x-2 gap-y-1 border-b border-l-2 border-gray-200 bg-white px-3.5 py-2.5 text-left transition-colors duration-200 ease-in-out hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:hover:bg-slate-800";
const conversationRowSelectedTw = "border-l-blue-600 bg-blue-50 ring-1 ring-inset ring-blue-100 dark:bg-slate-800 dark:ring-slate-700";
const conversationRowIdleTw = "border-l-transparent";

/** Lista lateral de conversas do Atendimento (avatar, presença, canal, tags, destaque de novas). */
export function ConversationList({ conversations, conversationsLoading, selectedId, queueView, onSelect }: ConversationListProps) {
  return (
    <div className="grid min-h-0 flex-1 content-start overflow-y-auto" data-testid="conversation-list">
      {conversations.map((item) => {
        const last = item.messages?.[0];
        const outbound = last?.direction === "OUTBOUND";
        const mark = outbound ? outboundMark(last?.status) : null;
        const preview = last?.content || "Sem mensagens";
        const previewText = preview.length > 30 ? preview.slice(0, 30) + "…" : preview;
        const tags = contactLabels(item.contact);
        const selected = selectedId === item.id;
        const presence = presenceTone(item);
        return (
          <button
            key={item.id}
            className={conversationRowTw + " " + (selected ? conversationRowSelectedTw : conversationRowIdleTw)}
            onClick={() => onSelect(item)}
            aria-pressed={selected}
          >
            <span className="relative mt-0.5 inline-grid h-11 w-11 flex-none self-start">
              <ContactAvatar contact={item.contact} />
              {presence ? <span className={"absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-white dark:border-slate-900 " + presenceToneTw[presence]} aria-hidden="true" /> : null}
            </span>
            <span className="flex min-w-0 flex-1 flex-col gap-1">
              <span className="flex min-w-0 items-center">
                <strong>{contactDisplayName(item.contact, item.botState)}</strong>
                <span className="ml-0.5 inline-flex items-center gap-1">
                  <ChannelMark channel={item.channel || item.contact.source || "WHATSAPP"} />
                  <ChannelMark kind="agent" mode={item.handlingMode} channel={String(item.botState?.mode || item.botState?.provider || (item.handlingMode === "BOT" ? "BOT" : ""))} />
                </span>
                <span className="ml-auto flex-none text-xs tabular-nums text-slate-500 dark:text-slate-400">{timeShortLabel(item.lastMessageAt || item.createdAt)}</span>
              </span>
              <small className="flex min-w-0 items-center gap-1 text-2xs text-slate-600 dark:text-slate-300">
                {mark ? <span className={"flex-none text-2xs tabular-nums " + tickToneTw[mark.tone]} role="img" aria-label={mark.label}>{mark.glyph}</span> : null}
                <span className="block min-w-0 truncate">{previewText}</span>
              </small>
              {item.isOverdue ? (
                <span className="inline-flex items-center gap-1 text-xs font-semibold text-red-600 dark:text-red-400"><AlarmClock size={11} /> Atrasado · sem assistência</span>
              ) : (!item.assignee && item.status === "OPEN" ? (
                <span className="mt-0.5 inline-flex w-max items-center gap-1.5 text-xs font-semibold text-blue-700 dark:text-blue-300"><span className="h-2 w-2 rounded-full bg-blue-700 ring-2 ring-blue-100 dark:bg-blue-400 dark:ring-slate-700" aria-hidden="true" /> Nova há {timeShortLabel(item.lastMessageAt || item.createdAt)}</span>
              ) : null)}
            </span>
            {tags.length ? <span className="m-0 flex w-full flex-none flex-wrap gap-1">{tags.map((tag, index) => <span key={tag.name + index} className="inline-flex min-h-4 items-center gap-0.5 rounded-lg bg-blue-50 px-1.5 text-2xs font-bold text-blue-800 dark:bg-slate-800 dark:text-slate-200" style={{ backgroundColor: tag.color, color: tagForeground(tag.color), borderColor: tag.color }}>{tag.name}</span>)}</span> : null}
          </button>
        );
      })}
      {conversationsLoading && conversations.length === 0 ? <div className="px-3.5 py-5 text-center text-slate-600 dark:text-slate-300" role="status"><strong>Carregando conversas…</strong><p>Buscando as conversas desta fila.</p></div> : null}
      {!conversationsLoading && !conversations.length ? <div className="px-3.5 py-5 text-center text-slate-600 dark:text-slate-300"><strong>{queueView === "mine" ? "Nenhuma conversa atribuída a você" : queueView === "team" ? "Nenhuma conversa da sua equipe" : queueView === "others" ? "Nenhuma conversa em que você foi incluído" : "Nenhuma conversa nesta fila"}</strong><p>Você só vê conversas destinadas a você, às suas equipes ou incluídas por convite. A visão ampliada continua sujeita às permissões.</p></div> : null}
    </div>
  );
}
