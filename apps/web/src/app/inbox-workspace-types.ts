"use client";

export type Agent = { id: string; name: string; email: string };

export type Contact = {
  id: string;
  name: string;
  phone?: string | null;
  email?: string | null;
  externalId?: string | null;
  source?: string | null;
  pipelineId?: string | null;
  metadata?: Record<string, unknown>;
};

export type MessageLinkPreview = { url: string; title?: string; description?: string; imageUrl?: string };

export type Message = {
  id: string;
  content: string;
  contentType: string;
  direction: string;
  status: string;
  occurredAt: string;
  senderName?: string | null;
  metadata?: Record<string, unknown> & {
    linkedConversationId?: string;
    departmentName?: string;
    linkPreview?: MessageLinkPreview;
  };
};

export type Conversation = {
  id: string;
  status: string;
  createdAt?: string;
  updatedAt?: string;
  channel?: string;
  handlingMode?: "BOT" | "HUMAN";
  botState?: Record<string, unknown>;
  isOverdue?: boolean;
  department?: { id: string; key: string; name: string } | null;
  archivedAt?: string | null;
  deletedAt?: string | null;
  contact: Contact;
  assignee?: { id: string; name: string } | null;
  messages: Message[];
  subject?: string | null;
  lastMessageAt?: string | null;
  priority?: string | null;
};
