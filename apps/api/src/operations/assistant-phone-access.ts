/** Normalize a phone number to its digits-only E.164 representation for access checks. */
export function normalizeAssistantPhone(value: unknown): string {
  if (typeof value !== "string") return "";
  const digits = value.replace(/\D/g, "");
  return digits.length >= 8 && digits.length <= 15 ? digits : "";
}

export function isAuthorizedAssistantPhone(phone: unknown, allowedPhones: unknown): boolean {
  const normalized = normalizeAssistantPhone(phone);
  if (!normalized || !Array.isArray(allowedPhones)) return false;
  return allowedPhones.some(value => normalizeAssistantPhone(value) === normalized);
}
