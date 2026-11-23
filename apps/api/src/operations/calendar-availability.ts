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
