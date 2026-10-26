import { BadGatewayException, BadRequestException, Controller, ForbiddenException, Get, Param, Post, Patch, Delete, Body, Query, Req, UseGuards } from "@nestjs/common";
import { createDecipheriv } from "node:crypto";
import { AuthGuard } from "../auth/auth.guard";
import type { AuthenticatedRequest } from "../auth/auth.types";
import { PrismaService } from "../prisma/prisma.service";

type EventInput = { summary?: string; description?: string; location?: string; start?: string; end?: string; attendees?: { email: string }[] };
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
    return { attendees: (data.attendees || []).filter(a=>/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(a.email)).slice(0,30).map(a=>({email:a.email})), summary: data.summary.trim().slice(0, 200), description: data.description?.slice(0, 4000) || "", location: data.location?.slice(0, 500) || "", start: { dateTime: start.toISOString() }, end: { dateTime: end.toISOString() } };
  }
  private async accessible(req:AuthenticatedRequest,accountId:string,calendarId:string){if(["OWNER","ADMIN","MANAGER"].includes(req.user.role))return;const rows=await this.prisma.calendarAssignment.findMany({where:{tenantId:req.user.tenantId,accountId,calendarId}});const teams=await this.prisma.departmentMember.findMany({where:{tenantId:req.user.tenantId,userId:req.user.sub},select:{departmentId:true}});if(!rows.some(r=>r.userId===req.user.sub||r.departmentId&&teams.some(t=>t.departmentId===r.departmentId)))throw new ForbiddenException("Esta agenda não foi atribuída a você ou à sua equipe.");}
  @Get("places")
  async places(@Req() req:AuthenticatedRequest,@Query("q") query:string){if(!query?.trim()||query.trim().length<3)return {suggestions:[]};if(query.length>180)throw new BadRequestException("Endereço muito longo.");const key=process.env.GOOGLE_MAPS_API_KEY;if(!key)throw new BadRequestException("Configure GOOGLE_MAPS_API_KEY no Dokploy para sugestões de endereços.");const response=await fetch("https://places.googleapis.com/v1/places:autocomplete",{method:"POST",headers:{"content-type":"application/json","X-Goog-Api-Key":key},body:JSON.stringify({input:query.trim(),languageCode:"pt-BR",regionCode:"BR"}),signal:AbortSignal.timeout(8000)});if(!response.ok)throw new BadGatewayException("Google Maps não pôde sugerir endereços.");const data=await response.json() as {suggestions?:{placePrediction?:{placeId?:string;text?:{text?:string}}}[]};return {suggestions:(data.suggestions||[]).filter(s=>s.placePrediction?.text?.text).slice(0,7).map(s=>({id:s.placePrediction!.placeId,label:s.placePrediction!.text!.text}))};}
  @Get("directory")
  async directory(@Req() req:AuthenticatedRequest){this.assertAdmin(req);const [members,departments]=await Promise.all([this.prisma.membership.findMany({where:{tenantId:req.user.tenantId},select:{userId:true,user:{select:{name:true,email:true}}}}),this.prisma.department.findMany({where:{tenantId:req.user.tenantId},select:{id:true,name:true}})]);return {members,departments};}
  @Get("assignments")
  async assignments(@Req() req:AuthenticatedRequest){this.assertAdmin(req);return this.prisma.calendarAssignment.findMany({where:{tenantId:req.user.tenantId}});}
  @Post("assignments")
  async assign(@Req() req:AuthenticatedRequest,@Body() body:{accountId?:string;calendarId?:string;userId?:string;departmentId?:string}){this.assertAdmin(req);if(!body.accountId||!body.calendarId||!!body.userId===!!body.departmentId)throw new BadRequestException("Selecione uma agenda e um agente ou equipe.");const acc=await this.prisma.googleConnection.findFirst({where:{id:body.accountId,tenantId:req.user.tenantId}});if(!acc)throw new BadRequestException("Conta inválida.");if(body.userId&&!await this.prisma.membership.findFirst({where:{tenantId:req.user.tenantId,userId:body.userId}}))throw new BadRequestException("Agente inválido.");if(body.departmentId&&!await this.prisma.department.findFirst({where:{tenantId:req.user.tenantId,id:body.departmentId}}))throw new BadRequestException("Equipe inválida.");const list=await this.google(req,body.accountId,"users/me/calendarList?maxResults=250") as {items?:{id:string}[]};if(!list.items?.some(x=>x.id===body.calendarId))throw new BadRequestException("Agenda não encontrada na conta Google.");const exists=await this.prisma.calendarAssignment.findFirst({where:{tenantId:req.user.tenantId,accountId:body.accountId,calendarId:body.calendarId,userId:body.userId||null,departmentId:body.departmentId||null}});if(exists)return exists;return this.prisma.calendarAssignment.create({data:{tenantId:req.user.tenantId,accountId:body.accountId,calendarId:body.calendarId,userId:body.userId||null,departmentId:body.departmentId||null}});}
  @Delete("assignments/:id")
  async unassign(@Req() req:AuthenticatedRequest,@Param("id") id:string){this.assertAdmin(req);await this.prisma.calendarAssignment.deleteMany({where:{id,tenantId:req.user.tenantId}});return {deleted:true};}
  @Post(":accountId/calendars")
  async createCalendar(@Req() req:AuthenticatedRequest,@Param("accountId") accountId:string,@Body() body:{summary?:string;timeZone?:string}){this.assertAdmin(req);if(!body.summary?.trim()||body.summary.length>120)throw new BadRequestException("Informe o nome da agenda.");return this.google(req,accountId,"calendars",{method:"POST",body:JSON.stringify({summary:body.summary.trim(),timeZone:body.timeZone||"America/Sao_Paulo"})});}
  @Get("accounts")
  async accounts(@Req() req: AuthenticatedRequest) { return this.prisma.googleConnection.findMany({ where: { tenantId: req.user.tenantId, scopes: { contains: "calendar.events" },  }, select: { id: true, email: true } }); }
  @Get(":accountId/calendars")
  async calendars(@Req() req: AuthenticatedRequest, @Param("accountId") accountId: string) { const data=await this.google(req, accountId, "users/me/calendarList?maxResults=250") as {items?:{id:string}[]};if(["OWNER","ADMIN","MANAGER"].includes(req.user.role))return data;const teams=await this.prisma.departmentMember.findMany({where:{tenantId:req.user.tenantId,userId:req.user.sub},select:{departmentId:true}});const grants=await this.prisma.calendarAssignment.findMany({where:{tenantId:req.user.tenantId,accountId}});return {...data,items:(data.items||[]).filter(x=>grants.some(g=>g.calendarId===x.id&&(g.userId===req.user.sub||g.departmentId&&teams.some(t=>t.departmentId===g.departmentId))))};}
  @Get(":accountId/events")
  async events(@Req() req: AuthenticatedRequest, @Param("accountId") accountId: string, @Query("calendarId") calendarId = "primary", @Query("timeMin") timeMin?: string, @Query("timeMax") timeMax?: string) {
    await this.accessible(req,accountId,calendarId);
    const params = new URLSearchParams({ singleEvents: "true", orderBy: "startTime", maxResults: "250" });
    if (timeMin) params.set("timeMin", new Date(timeMin).toISOString());
    if (timeMax) params.set("timeMax", new Date(timeMax).toISOString());
    return this.google(req, accountId, "calendars/" + encodeURIComponent(calendarId) + "/events?" + params);
  }
  @Post(":accountId/events")
  async create(@Req() req: AuthenticatedRequest, @Param("accountId") accountId: string, @Query("calendarId") calendarId = "primary", @Body() data: EventInput) {
    await this.accessible(req,accountId,calendarId);
    return this.google(req, accountId, "calendars/" + encodeURIComponent(calendarId) + "/events", { method: "POST", body: JSON.stringify(this.validate(data)) });
  }
  @Patch(":accountId/events/:eventId")
  async update(@Req() req: AuthenticatedRequest, @Param("accountId") accountId: string, @Param("eventId") eventId: string, @Query("calendarId") calendarId = "primary", @Body() data: EventInput) {
    this.assertAdmin(req);
    return this.google(req, accountId, "calendars/" + encodeURIComponent(calendarId) + "/events/" + encodeURIComponent(eventId), { method: "PATCH", body: JSON.stringify(this.validate(data)) });
  }
  @Delete(":accountId/events/:eventId")
  async remove(@Req() req: AuthenticatedRequest, @Param("accountId") accountId: string, @Param("eventId") eventId: string, @Query("calendarId") calendarId = "primary") {
    await this.accessible(req,accountId,calendarId);
    await this.google(req, accountId, "calendars/" + encodeURIComponent(calendarId) + "/events/" + encodeURIComponent(eventId), { method: "DELETE" });
    return { deleted: true };
  }
}
