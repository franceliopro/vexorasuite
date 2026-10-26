import { BadGatewayException, BadRequestException, Controller, ForbiddenException, Get, Param, Post, Patch, Delete, Body, Query, Req, UseGuards } from "@nestjs/common";
import { createDecipheriv } from "node:crypto";
import { AuthGuard } from "../auth/auth.guard";
import type { AuthenticatedRequest } from "../auth/auth.types";
import { PrismaService } from "../prisma/prisma.service";

type EventInput = { summary?: string; description?: string; location?: string; start?: string; end?: string; colorId?: string; attendees?: { email: string }[] };
@Controller("integrations/google/calendar")
@UseGuards(AuthGuard)
export class GoogleCalendarController {
  constructor(private readonly prisma: PrismaService) {}
  private decrypt(value: string) {
    const key = process.env.GOOGLE_TOKEN_ENCRYPTION_KEY || "";
    if (!/^[a-f0-9]{64}$/i.test(key)) throw new BadRequestException("Criptografia Google não configurada.");
    const parts = value.split(".");
    if (parts.length !== 3) throw new BadRequestException("Token criptografado inválido.");
    const decipher = createDecipheriv("aes-256-gcm", Buffer.from(key, "hex"), Buffer.from(parts[0]!, "base64url"));
    decipher.setAuthTag(Buffer.from(parts[1]!, "base64url"));
    return Buffer.concat([decipher.update(Buffer.from(parts[2]!, "base64url")), decipher.final()]).toString("utf8");
  }
  private async token(req: AuthenticatedRequest, accountId: string) {
    const account = await this.prisma.googleConnection.findFirst({ where: { id: accountId, tenantId: req.user.tenantId } });
    if (!account || !account.scopes.includes("calendar.events")) throw new ForbiddenException("Conta sem autorização para Google Agenda nesta empresa.");
    if (account.expiresAt.getTime() > Date.now() + 60000) return this.decrypt(account.accessTokenEncrypted);
    if (!account.refreshTokenEncrypted) throw new BadRequestException("Reconecte a conta Google para renovar a autorização.");
    const response = await fetch("https://oauth2.googleapis.com/token", { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ client_id: process.env.GOOGLE_CLIENT_ID || "", client_secret: process.env.GOOGLE_CLIENT_SECRET || "", refresh_token: this.decrypt(account.refreshTokenEncrypted), grant_type: "refresh_token" }), signal: AbortSignal.timeout(15000) });
    if (!response.ok) throw new BadGatewayException("Falha ao renovar acesso Google. Reconecte a conta.");
    const result = await response.json() as { access_token?: string; expires_in?: number };
    if (!result.access_token) throw new BadGatewayException("Google não retornou token.");
    // Refresh is not persisted here; use the short-lived token for this request.
    return result.access_token;
  }
  private async google(req: AuthenticatedRequest, accountId: string, path: string, init: RequestInit = {}) {
    const accessToken = await this.token(req, accountId);
    const response = await fetch("https://www.googleapis.com/calendar/v3/" + path, { ...init, headers: { authorization: "Bearer " + accessToken, "content-type": "application/json" }, signal: AbortSignal.timeout(15000) });
    const result = await response.json().catch(() => ({})) as Record<string, unknown>;
    if (!response.ok) throw new BadGatewayException(typeof result.error === "object" ? "Google Agenda recusou a operação. Verifique as permissões da conta." : "Falha na comunicação com Google Agenda.");
    return result;
  }
  private assertAdmin(req: AuthenticatedRequest) { if (!["OWNER", "ADMIN", "MANAGER"].includes(req.user.role)) throw new ForbiddenException("Sem permissão para alterar a agenda."); }
  private validate(data: EventInput) {
    if (!data.summary?.trim() || !data.start || !data.end) throw new BadRequestException("Informe título, início e término.");
    const start = new Date(data.start), end = new Date(data.end);
    if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime()) || end <= start) throw new BadRequestException("Datas inválidas.");
    return { colorId: /^[1-9]$|^1[01]$/.test(data.colorId || "") ? data.colorId : undefined, attendees: (data.attendees || []).filter(a=>/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(a.email)).slice(0,30).map(a=>({email:a.email})), summary: data.summary.trim().slice(0, 200), description: data.description?.slice(0, 4000) || "", location: data.location?.slice(0, 500) || "", start: { dateTime: start.toISOString() }, end: { dateTime: end.toISOString() } };
  }
  @Get("accounts")
  async accounts(@Req() req: AuthenticatedRequest) { return this.prisma.googleConnection.findMany({ where: { tenantId: req.user.tenantId, scopes: { contains: "calendar.events" } }, select: { id: true, email: true } }); }
  @Get(":accountId/calendars")
  async calendars(@Req() req: AuthenticatedRequest, @Param("accountId") accountId: string) { return this.google(req, accountId, "users/me/calendarList?maxResults=100"); }
  @Get(":accountId/events")
  async events(@Req() req: AuthenticatedRequest, @Param("accountId") accountId: string, @Query("calendarId") calendarId = "primary", @Query("timeMin") timeMin?: string, @Query("timeMax") timeMax?: string) {
    const params = new URLSearchParams({ singleEvents: "true", orderBy: "startTime", maxResults: "250" });
    if (timeMin) params.set("timeMin", new Date(timeMin).toISOString());
    if (timeMax) params.set("timeMax", new Date(timeMax).toISOString());
    return this.google(req, accountId, "calendars/" + encodeURIComponent(calendarId) + "/events?" + params);
  }
  @Post(":accountId/events")
  async create(@Req() req: AuthenticatedRequest, @Param("accountId") accountId: string, @Query("calendarId") calendarId = "primary", @Body() data: EventInput) {
    this.assertAdmin(req);
    return this.google(req, accountId, "calendars/" + encodeURIComponent(calendarId) + "/events", { method: "POST", body: JSON.stringify(this.validate(data)) });
  }
  @Patch(":accountId/events/:eventId")
  async update(@Req() req: AuthenticatedRequest, @Param("accountId") accountId: string, @Param("eventId") eventId: string, @Query("calendarId") calendarId = "primary", @Body() data: EventInput) {
    this.assertAdmin(req);
    return this.google(req, accountId, "calendars/" + encodeURIComponent(calendarId) + "/events/" + encodeURIComponent(eventId), { method: "PATCH", body: JSON.stringify(this.validate(data)) });
  }
  @Delete(":accountId/events/:eventId")
  async remove(@Req() req: AuthenticatedRequest, @Param("accountId") accountId: string, @Param("eventId") eventId: string, @Query("calendarId") calendarId = "primary") {
    this.assertAdmin(req);
    await this.google(req, accountId, "calendars/" + encodeURIComponent(calendarId) + "/events/" + encodeURIComponent(eventId), { method: "DELETE" });
    return { deleted: true };
  }
}
