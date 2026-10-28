import { BadRequestException } from "@nestjs/common";
import sanitizeHtml from "sanitize-html";
export function emailAddress(value: unknown) {
  if (
    typeof value !== "string" ||
    value.length > 254 ||
    !/^[-\w.!#$%&'*+/=?^`{|}~]+@[a-z0-9.-]+\.[a-z]{2,}$/i.test(value)
  )
    throw new BadRequestException("Informe um e-mail válido.");
  return value.toLowerCase();
}
export function text(value: unknown, max = 180) {
  if (
    typeof value !== "string" ||
    !value.trim() ||
    value.length > max ||
    /[\r\n\x00]/.test(value)
  )
    throw new BadRequestException("Texto inválido.");
  return value.trim();
}
const styles = {
  color: [/^#[\da-f]{3,8}$/i, /^[a-z]+$/i],
  "background-color": [/^#[\da-f]{3,8}$/i, /^[a-z]+$/i],
  "font-size": [/^\d{1,3}(px|pt|em|rem|%)$/],
  "font-family": [/^[\w\s,'-]+$/],
  "font-weight": [/^(normal|bold|[1-9]00)$/],
  "text-align": [/^(left|right|center|justify)$/],
  "line-height": [/^\d(\.\d{1,2})?$/],
  padding: [/^\d{1,3}px( \d{1,3}px){0,3}$/],
  margin: [/^\d{1,3}px( \d{1,3}px){0,3}$/],
  width: [/^\d{1,4}(px|%)$/],
  "max-width": [/^\d{1,4}(px|%)$/],
  "border-radius": [/^\d{1,2}px$/],
  border: [/^\dpx solid #[\da-f]{3,8}$/i],
};
/** Email is a document, not executable application code. CSS is limited to email-safe declarations. */
export function cleanEmail(value: unknown) {
  if (typeof value !== "string" || value.length > 150000)
    throw new BadRequestException("Use HTML de até 150 mil caracteres.");
  const html = sanitizeHtml(value, {
    allowedTags: [
      "div",
      "section",
      "p",
      "br",
      "hr",
      "h1",
      "h2",
      "h3",
      "h4",
      "strong",
      "b",
      "em",
      "i",
      "u",
      "s",
      "span",
      "a",
      "img",
      "ul",
      "ol",
      "li",
      "blockquote",
      "table",
      "tbody",
      "thead",
      "tr",
      "td",
      "th",
    ],
    allowedAttributes: {
      "*": ["style"],
      a: ["href", "title"],
      img: ["src", "alt", "width", "height"],
      table: ["width", "cellpadding", "cellspacing", "role"],
      td: ["colspan", "rowspan", "width"],
    },
    allowedStyles: { "*": styles },
    allowedSchemes: ["https", "mailto"],
    allowedSchemesByTag: { img: ["https"] },
    allowProtocolRelative: false,
    disallowedTagsMode: "discard",
    enforceHtmlBoundary: false,
  });
  if (!html.trim()) throw new BadRequestException("O cartão está vazio.");
  return html;
}
export function escapeHtml(value: string) {
  return value.replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );
}
export function personalize(html: string, name: string) {
  return html.replace(/{{(?:nome|novo_nome)}}/g, escapeHtml(name));
}
export function anniversary(value: unknown, month: number) {
  if (typeof value !== "string") return false;
  const m =
    value.match(/^\d{4}-(\d{2})-\d{2}/) ||
    value.match(/^\d{2}\/(\d{2})\/\d{4}$/);
  return !!m && Number(m[1]) === month;
}
export function occasion(metadata: any, kind: string, month: number) {
  const m = metadata && typeof metadata === "object" ? metadata : {};
  const fields = m.fields || m.customFields || {};
  if (kind === "birthday")
    return anniversary(
      m.birthDate ||
        m.birthday ||
        m.dataNascimento ||
        fields.birthDate ||
        fields.data_nascimento,
      month,
    );
  if (kind === "partnership")
    return anniversary(
      m.partnershipDate ||
        m.customerSince ||
        m.partnershipStartedAt ||
        fields.partnershipDate ||
        fields.inicio_parceria,
      month,
    );
  return true;
}
export const emailTemplates = [
  {
    name: "Feliz aniversário",
    subject: "Feliz aniversário, {{nome}}!",
    html: '<div style="padding:32px;background-color:#f4f1ff;border-radius:16px"><h1 style="color:#6258df">Hoje é seu dia, {{nome}}!</h1><p>Desejamos saúde, alegria e muitas conquistas.</p><p>Com carinho, nossa equipe.</p></div>',
  },
  {
    name: "Aniversário de parceria",
    subject: "Celebramos nossa parceria, {{nome}}",
    html: '<div style="padding:32px"><h1>Obrigado pela confiança, {{nome}}!</h1><p>É uma alegria celebrar mais um ano dessa parceria.</p><p>Conte sempre com a nossa equipe.</p></div>',
  },
  {
    name: "Novidade do mês",
    subject: "Uma novidade para você",
    html: '<div style="padding:32px"><h1>Olá, {{nome}}!</h1><p>Escreva aqui a novidade ou condição especial que deseja apresentar.</p><p><a href="https://example.com">Saiba mais</a></p></div>',
  },
];
