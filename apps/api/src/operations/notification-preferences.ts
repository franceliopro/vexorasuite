/**
 * Eventos de notificação que o código realmente emite hoje.
 *
 * Não há aqui canal novo (e-mail, WhatsApp ou push externo): as preferências
 * apenas filtram avisos internos e push já existentes no produto.
 */
export const NOTIFICATION_EVENTS = [
  "CONVERSATION_ASSIGNED_TO_ME",
  "CONVERSATION_ASSIGNED_TO_MY_TEAM",
  "MENTION",
  "TASK_DUE",
  "CONVERSATION_MESSAGE_RECEIVED",
] as const;

export type NotificationEvent = (typeof NOTIFICATION_EVENTS)[number];

/** Preserva o comportamento atual até que a pessoa escolha outra coisa. */
export const DEFAULT_NOTIFICATION_EVENTS: readonly NotificationEvent[] = NOTIFICATION_EVENTS;

const KNOWN = new Set<string>(NOTIFICATION_EVENTS);

export function isNotificationEvent(value: unknown): value is NotificationEvent {
  return typeof value === "string" && KNOWN.has(value);
}

export function normalizeNotificationEvents(input: unknown): NotificationEvent[] {
  if (!Array.isArray(input)) throw new TypeError("Informe a lista de eventos.");
  const events = new Set<NotificationEvent>();
  for (const value of input) {
    if (!isNotificationEvent(value)) throw new TypeError("Evento de notificação desconhecido.");
    events.add(value);
  }
  return NOTIFICATION_EVENTS.filter((event) => events.has(event));
}

export function notificationEventsOf(stored: unknown): NotificationEvent[] {
  if (!Array.isArray(stored)) return [...DEFAULT_NOTIFICATION_EVENTS];
  const values = stored.filter((value): value is string => typeof value === "string");
  return NOTIFICATION_EVENTS.filter((event) => values.includes(event));
}

export function allowsNotification(stored: unknown, event: NotificationEvent): boolean {
  return notificationEventsOf(stored).includes(event);
}
