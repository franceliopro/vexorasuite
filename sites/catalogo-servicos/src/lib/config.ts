/**
 * Helpers compartilhados por todas as interfaces.
 * Nunca transformam um valor de exemplo em um link "funcional".
 */
export function isPlaceholder(value: string | undefined | null): boolean {
  if (!value) return true;
  const trimmed = value.trim();
  if (!trimmed) return true;
  if (/\{\{[^}]+\}\}/.test(trimmed)) return true;
  if (/\.example\b/i.test(trimmed)) return true;
  if (/(^|@|\.)example\.(com|org|net|local|test|invalid)\b/i.test(trimmed)) return true;
  if (/CHANGE_ME/i.test(trimmed)) return true;
  const digits = trimmed.replace(/\D/g, "");
  if (digits.length >= 8 && /^0+$/.test(digits)) return true;
  return false;
}

export function displayOr(value: string | undefined, fallback: string): string {
  return isPlaceholder(value) ? fallback : (value as string);
}

export function whatsappHref(value: string, message = ""): string | null {
  if (isPlaceholder(value)) return null;
  const digits = value.replace(/\D/g, "");
  if (digits.length < 12 || digits.length > 15) return null;
  const query = message ? `?text=${encodeURIComponent(message)}` : "";
  return `https://wa.me/${digits}${query}`;
}

export function mailtoHref(
  email: string,
  subject = "",
  body = "",
): string | null {
  if (isPlaceholder(email)) return null;
  const params = new URLSearchParams();
  if (subject) params.set("subject", subject);
  if (body) params.set("body", body);
  const query = params.toString();
  return `mailto:${email}${query ? `?${query}` : ""}`;
}

export function safeBaseUrl(base: string): string {
  if (isPlaceholder(base)) return "https://example.com";
  try {
    new URL(base);
    return base.replace(/\/$/, "");
  } catch {
    return "https://example.com";
  }
}

export function absoluteUrl(base: string, pathname: string): string {
  const path = pathname.startsWith("/") ? pathname : `/${pathname}`;
  return new URL(path, safeBaseUrl(base) + "/").href;
}
