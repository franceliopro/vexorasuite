import { BadGatewayException } from "@nestjs/common";

/**
 * Contrato comum de mídia recebida. Webhooks de WAHA, Meta Cloud API e Zernio
 * usam formatos diferentes; a conversa guarda apenas metadados normalizados e
 * o navegador nunca recebe uma URL de provedor (nem credenciais).
 */
export type MediaContentType = "text" | "audio" | "image" | "video" | "file";
export type MediaDelivery = "READY" | "UNAVAILABLE";

export type NormalizedInboundMedia = {
  hasMedia: boolean;
  /** Referência segura: caminho do gateway WAHA ou URL https de host permitido. Nunca host arbitrário do webhook. */
  mediaUrl: string | null;
  filename: string | null;
  mimetype: string | null;
  contentType: MediaContentType;
  /** Identificador do provedor quando o binário precisa ser resolvido no servidor (Meta). */
  mediaRef: string | null;
  mediaDelivery: MediaDelivery;
};

export type InboundMediaProvider = "WAHA" | "META" | "ZERNIO";

export type InboundMediaInput = {
  provider: unknown;
  type?: unknown;
  hasMedia?: unknown;
  mimetype?: unknown;
  mimeType?: unknown;
  filename?: unknown;
  mediaUrl?: unknown;
  mediaId?: unknown;
  attachments?: unknown;
};

/** Hosts de onde o servidor aceita buscar mídia. Correspondência exata ou por sufixo de domínio. */
export const MEDIA_HOST_ALLOWLIST = [
  "zernio.com",
  "facebook.com",
  "fbcdn.net",
  "fbsbx.com",
  "whatsapp.net",
  "instagram.com",
  "cdninstagram.com",
] as const;

const clean = (value: unknown, max: number): string =>
  typeof value === "string" ? value.replace(/[\u0000-\u001f\u007f]/g, "").trim().slice(0, max) : "";

const pick = (row: Record<string, unknown>, keys: string[]): string => {
  for (const key of keys) {
    const value = clean(row[key], 1000);
    if (value) return value;
  }
  return "";
};

function firstAttachment(value: unknown): Record<string, unknown> {
  if (!Array.isArray(value)) return {};
  for (const item of value) {
    if (item && typeof item === "object" && !Array.isArray(item)) return item as Record<string, unknown>;
  }
  return {};
}

/** Aceita somente https, sem credenciais/porta explícita e com host da lista. */
export function isAllowedMediaUrl(value: unknown): boolean {
  const raw = clean(value, 2048);
  if (!raw) return false;
  let url: URL;
  try { url = new URL(raw); } catch { return false; }
  if (url.protocol !== "https:" || url.username || url.password || url.port) return false;
  const host = url.hostname.toLowerCase().replace(/\.$/, "");
  if (!host || host === "localhost" || /^\d{1,3}(\.\d{1,3}){3}$/.test(host) || host.includes("[")) return false;
  return (MEDIA_HOST_ALLOWLIST as readonly string[]).some(domain => host === domain || host.endsWith("." + domain));
}

/** URL do gateway WAHA: apenas o caminho interno, nunca o host recebido no webhook. */
export function wahaMediaPath(value: unknown): string | null {
  const raw = clean(value, 2048);
  // URL relativa ao gateway ou absoluta: o host e a query (token) nunca são persistidos.
  if (!raw || raw.startsWith("//")) return null;
  try {
    const url = new URL(raw, "https://gateway.invalid/");
    if (url.username || url.password) return null;
    return /^\/api\/files\/[^\s]+$/.test(url.pathname) ? url.pathname : null;
  } catch { return null; }
}

function contentTypeOf(mimetype: string, type: string, hasMedia: boolean): MediaContentType {
  if (mimetype.startsWith("audio/") || ["audio", "voice", "ptt"].includes(type)) return "audio";
  if (mimetype.startsWith("image/") || ["image", "sticker"].includes(type)) return "image";
  if (mimetype.startsWith("video/") || type === "video") return "video";
  if (hasMedia || type === "document" || type === "file" || mimetype.startsWith("application/")) return "file";
  return "text";
}

/** Normaliza mídia de qualquer provedor para os mesmos campos, sem confiar em URL externa. */
export function normalizeInboundMedia(input: InboundMediaInput): NormalizedInboundMedia {
  const provider = String(input.provider || "").toUpperCase();
  const type = clean(input.type, 60).toLowerCase();
  const attachment = firstAttachment(input.attachments);
  const attachmentUrl = pick(attachment, ["url", "mediaUrl", "media_url", "fileUrl", "link"]);
  const attachmentMime = pick(attachment, ["mimeType", "mimetype", "contentType", "type"]);
  const attachmentName = pick(attachment, ["filename", "fileName", "name", "mediaName"]);
  const attachmentId = pick(attachment, ["id", "mediaId", "fileId", "providerMessageId"]);
  const mimetype = pick({ ...input, mimeType: input.mimeType || input.mimetype }, ["mimetype", "mimeType"]) || attachmentMime;
  const filename = clean(input.filename, 255) || attachmentName;
  const mediaId = clean(input.mediaId, 255) || attachmentId;
  const hasMedia = input.hasMedia === true || type !== "" && type !== "text" || Boolean(mimetype || attachmentUrl || mediaId);

  let mediaUrl: string | null = null;
  let mediaRef: string | null = null;
  let mediaDelivery: MediaDelivery = "UNAVAILABLE";
  if (provider === "WAHA") {
    mediaUrl = wahaMediaPath(input.mediaUrl);
    // Sem URL ainda é possível recuperar pelo message id no gateway (recoverMessageMedia).
    mediaDelivery = "READY";
  } else if (provider === "META") {
    mediaRef = mediaId || null;
    // Meta: somente o id vai para o banco; a URL é resolvida na Graph API com token da empresa.
    mediaDelivery = mediaId ? "READY" : "UNAVAILABLE";
  } else if (provider === "ZERNIO") {
    mediaUrl = isAllowedMediaUrl(attachmentUrl) ? attachmentUrl : null;
    mediaDelivery = mediaUrl ? "READY" : "UNAVAILABLE";
  }

  return {
    hasMedia,
    mediaUrl,
    filename: filename || null,
    mimetype: mimetype || null,
    contentType: contentTypeOf(mimetype.toLowerCase(), type, hasMedia),
    mediaRef,
    mediaDelivery,
  };
}

/** Lê a resposta de mídia com limite de tamanho e tipo, sem repassar cabeçalhos de credencial. */
export async function readMediaResponse(response: Response, maxBytes = 25 * 1024 * 1024): Promise<{ buffer: Buffer; mimetype: string }> {
  const mimetype = ((response.headers.get("content-type") || "application/octet-stream").split(";")[0] || "application/octet-stream").toLowerCase();
  const allowed = ["audio/", "image/", "video/", "application/"].some(prefix => mimetype.startsWith(prefix));
  const declared = Number(response.headers.get("content-length") || 0);
  if (!response.ok || !allowed || declared > maxBytes) throw new BadGatewayException("Mídia indisponível ou acima do limite.");
  const reader = response.body?.getReader();
  if (!reader) throw new BadGatewayException("Mídia vazia.");
  const chunks: Buffer[] = [];
  let size = 0;
  try {
    for (;;) {
      const part = await reader.read();
      if (part.done) break;
      size += part.value.length;
      if (size > maxBytes) throw new BadGatewayException("Mídia acima do limite.");
      chunks.push(Buffer.from(part.value));
    }
  } finally {
    await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
  return { buffer: Buffer.concat(chunks), mimetype };
}
