import { createHash } from "node:crypto";
import { BadGatewayException } from "@nestjs/common";
import type { GoogleAccessService } from "./google-access.service";

export async function calendarIsAvailable(
  access: GoogleAccessService,
  tenantId: string,
  accountId: string,
  calendarId: string,
  from: Date,
  to: Date,
): Promise<boolean> {
  const token = await access.token(tenantId, accountId, "calendar");
  const response = await fetch("https://www.googleapis.com/calendar/v3/freeBusy", {
    method: "POST",
    headers: { authorization: "Bearer " + token, "content-type": "application/json" },
    signal: AbortSignal.timeout(8000),
    body: JSON.stringify({ timeMin: from.toISOString(), timeMax: to.toISOString(), items: [{ id: calendarId }] }),
  });
  if (!response.ok) throw new BadGatewayException("Não foi possível confirmar a disponibilidade desta agenda.");

  const result = await response.json().catch(() => null) as { calendars?: Record<string, { busy?: unknown[]; errors?: unknown[] }> } | null;
  const calendars = result?.calendars;
  const calendar = calendars && Object.hasOwn(calendars, calendarId) ? calendars[calendarId] : undefined;
  if (!calendar || calendar.errors?.length || !Array.isArray(calendar.busy)) {
    throw new BadGatewayException("Não foi possível confirmar a disponibilidade desta agenda.");
  }
  return calendar.busy.length === 0;
}

export async function bookCalendarSlot(
  access: GoogleAccessService,
  tenantId: string,
  accountId: string,
  calendarId: string,
  from: Date,
  to: Date,
  title: string,
  bookingKey: string,
): Promise<"confirmado" | "ocupado" | "indisponível"> {
  const id = createHash("sha256").update(bookingKey).digest("hex");
  const token = await access.token(tenantId, accountId, "calendar");
  const events = "https://www.googleapis.com/calendar/v3/calendars/" + encodeURIComponent(calendarId) + "/events";
  const headers = { authorization: "Bearer " + token, "content-type": "application/json" };
  const init = () => ({ headers, signal: AbortSignal.timeout(8000) });
  const confirmed = async (response: Response) => {
    if (!response.ok) return false;
    const event = await response.json().catch(() => null) as { id?: string; status?: string } | null;
    return event?.id === id && event.status === "confirmed";
  };
  const existing = await fetch(events + "/" + id, init());
  if (existing.status !== 404) return await confirmed(existing) ? "confirmado" : "indisponível";

  if (!await calendarIsAvailable(access, tenantId, accountId, calendarId, from, to)) return "ocupado";
  const response = await fetch(events, {
    ...init(),
    method: "POST",
    body: JSON.stringify({ id, summary: title, start: { dateTime: from.toISOString() }, end: { dateTime: to.toISOString() } }),
  }).catch(() => null);
  if (response && await confirmed(response)) return "confirmado";

  const persisted = await fetch(events + "/" + id, init());
  return await confirmed(persisted) ? "confirmado" : "indisponível";
}
