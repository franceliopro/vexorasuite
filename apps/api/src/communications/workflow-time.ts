import { BadRequestException } from "@nestjs/common";
export function localParts(date: Date, zone: string) {
  try {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: zone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }).formatToParts(date);
    const p = Object.fromEntries(parts.map((x) => [x.type, x.value]));
    return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`;
  } catch {
    throw new BadRequestException("Fuso horário inválido.");
  }
}
export function localInstant(local: string, zone: string) {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(local))
    throw new BadRequestException("Data e horário inválidos.");
  const wall = Date.parse(local + "Z");
  if (!Number.isFinite(wall)) throw new BadRequestException("Data inválida.");
  const offsets = new Set(
    [-36, -12, 0, 12, 36].map((h) => {
      const d = new Date(wall + h * 3600000);
      return Date.parse(localParts(d, zone) + "Z") - d.getTime();
    }),
  );
  const matches = [...offsets]
    .map((offset) => new Date(wall - offset))
    .filter((d) => localParts(d, zone) === local)
    .sort((a, b) => a.getTime() - b.getTime());
  if (!matches.length)
    throw new BadRequestException(
      "Este horário não existe no fuso escolhido. Escolha outro horário.",
    );
  return matches[0]!;
}
/** Calendar-day recurrence preserves local wall time across daylight saving changes. */
export function repeatInstant(previous: Date, days: number, zone: string) {
  const local = localParts(previous, zone);
  const wall = new Date(local + "Z");
  wall.setUTCDate(wall.getUTCDate() + days);
  return localInstant(wall.toISOString().slice(0, 16), zone);
}
export function workflowSteps(raw: unknown) {
  if (!Array.isArray(raw) || raw.length < 1 || raw.length > 20)
    throw new BadRequestException("Use de 1 a 20 etapas.");
  return raw.map((step: any) => {
    if (
      !step ||
      !["WAIT", "TASK", "NOTE", "TAG", "UNTAG", "WHATSAPP", "ASSIGN_DEPARTMENT", "ASSIGN_AGENT", "STAGE", "PRIORITY", "STATUS"].includes(step.type)
    )
      throw new BadRequestException("Etapa inválida.");
    const minutes = Number(step.minutes || 0);
    if (!Number.isInteger(minutes) || minutes < 0 || minutes > 525600)
      throw new BadRequestException("Intervalo inválido.");
    if (
      step.type !== "WAIT" &&
      (typeof step.text !== "string" ||
        !step.text.trim() ||
        step.text.length > 2000)
    )
      throw new BadRequestException("Escreva o conteúdo da etapa.");
    return {
      type: String(step.type),
      minutes,
      text: typeof step.text === "string" ? step.text.trim() : "",
    };
  });
}
