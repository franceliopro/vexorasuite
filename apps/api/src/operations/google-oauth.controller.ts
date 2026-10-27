import { BadRequestException, Controller, Delete, ForbiddenException, Get, Param, Post, Query, Req, Res, ServiceUnavailableException, UseGuards } from "@nestjs/common";
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import type { Response } from "express";
import { AuthGuard } from "../auth/auth.guard";
import type { AuthenticatedRequest } from "../auth/auth.types";
import { PrismaService } from "../prisma/prisma.service";

const callbackPath = "/api/integrations/google/callback";
const scopes: Record<string, string[]> = {
  calendar: ["openid", "email", "profile", "https://www.googleapis.com/auth/calendar", "https://www.googleapis.com/auth/calendar.events", "https://www.googleapis.com/auth/calendar.readonly"],
  drive: ["openid", "email", "profile", "https://www.googleapis.com/auth/drive.file"],
  "drive-library": ["openid", "email", "profile", "https://www.googleapis.com/auth/drive.file", "https://www.googleapis.com/auth/drive.readonly"],
  "drive-manager": ["openid", "email", "profile", "https://www.googleapis.com/auth/drive"],
};
@Controller("integrations/google")
export class GoogleOAuthController {
  constructor(private readonly prisma: PrismaService) {}
  private key() {
    const value = process.env.GOOGLE_TOKEN_ENCRYPTION_KEY || "";
    if (!/^[a-f0-9]{64}$/i.test(value)) throw new ServiceUnavailableException("GOOGLE_TOKEN_ENCRYPTION_KEY deve conter 64 caracteres hexadecimais.");
    return Buffer.from(value, "hex");
  }
  private encrypt(value: string) {
    const iv = randomBytes(12);
    const cipher = createCipheriv("aes-256-gcm", this.key(), iv);
    const data = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
    return [iv, cipher.getAuthTag(), data].map(x => x.toString("base64url")).join(".");
  }
  private decrypt(value: string) {
    const parts = value.split(".");
    if (parts.length !== 3 || parts.some(part => !part)) throw new BadRequestException("Credencial criptografada inválida.");
    const iv = Buffer.from(parts[0]!, "base64url");
    const tag = Buffer.from(parts[1]!, "base64url");
    const data = Buffer.from(parts[2]!, "base64url");
    const cipher = createDecipheriv("aes-256-gcm", this.key(), iv);
    cipher.setAuthTag(tag);
    return Buffer.concat([cipher.update(data), cipher.final()]).toString("utf8");
  }
  private configValues() {
    const id = process.env.GOOGLE_CLIENT_ID;
    const secret = process.env.GOOGLE_CLIENT_SECRET;
    const base = (process.env.API_PUBLIC_URL || "").replace(/\/$/, "");
    if (!id || !secret || !base.startsWith("https://")) throw new ServiceUnavailableException("Configure GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET e API_PUBLIC_URL HTTPS.");
    this.key();
    return { id, secret, redirect: base + callbackPath };
  }
  @Get("config")
  config() {
    const base = (process.env.API_PUBLIC_URL || "").replace(/\/$/, "");
    return { callbackUrl: base ? base + callbackPath : null, configured: Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET), encryptionConfigured: /^[a-f0-9]{64}$/i.test(process.env.GOOGLE_TOKEN_ENCRYPTION_KEY || ""), status: "OAUTH_AVAILABLE" };
  }
  @Get("connections")
  @UseGuards(AuthGuard)
  async connections(@Req() req: AuthenticatedRequest) {
    if (!["OWNER", "ADMIN"].includes(req.user.role)) throw new ForbiddenException("Apenas administradores podem gerenciar o Google.");
    const rows = await this.prisma.googleConnection.findMany({ where: { tenantId: req.user.tenantId }, select: { id: true, email: true, scopes: true, disabledServices: true, expiresAt: true, updatedAt: true, refreshTokenEncrypted: true } });
    return rows.map(({ refreshTokenEncrypted, ...row }) => ({ ...row, renewable: Boolean(refreshTokenEncrypted) }));
  }
  @Post("start/:service")
  @UseGuards(AuthGuard)
  async start(@Req() req: AuthenticatedRequest, @Param("service") service: string) {
    if (!["OWNER", "ADMIN"].includes(req.user.role)) throw new ForbiddenException("Apenas administradores podem conectar contas Google.");
    if (!scopes[service]) throw new BadRequestException("Serviço Google inválido.");
    const { id, redirect } = this.configValues();
    const state = randomBytes(32).toString("base64url");
    const verifier = randomBytes(48).toString("base64url");
    const challenge = createHash("sha256").update(verifier).digest("base64url");
    await this.prisma.googleOAuthAttempt.create({ data: { stateHash: createHash("sha256").update(state).digest("hex"), tenantId: req.user.tenantId, userId: req.user.sub, service, verifierEncrypted: this.encrypt(verifier), expiresAt: new Date(Date.now() + 10 * 60 * 1000) } });
    const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
    for (const [key, value] of Object.entries({ client_id: id, redirect_uri: redirect, response_type: "code", scope: scopes[service].join(" "), state, code_challenge: challenge, code_challenge_method: "S256", access_type: "offline", prompt: "consent", include_granted_scopes: "true" })) url.searchParams.set(key, value);
    return { authorizationUrl: url.toString() };
  }
  @Get("callback")
  async callback(@Query("state") state: string, @Query("code") code: string, @Query("error") error: string, @Res() res: Response) {
    const target = new URL("/", process.env.WEB_PUBLIC_URL || "https://app.vexorasuite.com.br");
    target.searchParams.set("module", "Canais e integrações");
    const done = (status: string) => { target.searchParams.set("google", status); return res.redirect(303, target.toString()); };
    if (!state || !/^[A-Za-z0-9_-]{40,100}$/.test(state)) return done("invalid_state");
    const stateHash = createHash("sha256").update(state).digest("hex");
    const attempt = await this.prisma.googleOAuthAttempt.findUnique({ where: { stateHash } });
    if (!attempt) return done("expired");
    // Atomically consume the state before any network call to prevent replay.
    const consumed = await this.prisma.googleOAuthAttempt.deleteMany({ where: { stateHash, expiresAt: { gt: new Date() } } });
    if (!consumed.count) return done("expired");
    if (error || !code) return done("denied");
    const authorized = await this.prisma.membership.findFirst({ where: { tenantId: attempt.tenantId, userId: attempt.userId, role: { in: ["OWNER","ADMIN"] }, tenant: { status: "ACTIVE" }, user: { isActive: true } }, select: { id: true } });
    if (!authorized) return done("access_revoked");
    try {
      const { id, secret, redirect } = this.configValues();
      const body = new URLSearchParams({ code, client_id: id, client_secret: secret, redirect_uri: redirect, grant_type: "authorization_code", code_verifier: this.decrypt(attempt.verifierEncrypted) });
      const response = await fetch("https://oauth2.googleapis.com/token", { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body, signal: AbortSignal.timeout(15000) });
      if (!response.ok) return done("token_error");
      const token = await response.json() as { access_token?: string; refresh_token?: string; expires_in?: number; scope?: string };
      if (!token.access_token) return done("token_error");
      const infoResponse = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", { headers: { authorization: "Bearer " + token.access_token }, signal: AbortSignal.timeout(15000) });
      if (!infoResponse.ok) return done("identity_error");
      const info = await infoResponse.json() as { sub?: string; email?: string; email_verified?: boolean };
      if (!info.sub || !info.email || !info.email_verified) return done("identity_error");
      const granted = (token.scope || "").split(" ");
      if (!scopes[attempt.service]?.some(s => s.startsWith("https://") && granted.includes(s))) return done("scope_missing");
      const prior = await this.prisma.googleConnection.findUnique({ where: { tenantId_googleAccountId: { tenantId: attempt.tenantId, googleAccountId: info.sub } } });
      if (!token.refresh_token && !prior?.refreshTokenEncrypted) return done("offline_missing");
      await this.prisma.googleConnection.upsert({
        where: { tenantId_googleAccountId: { tenantId: attempt.tenantId, googleAccountId: info.sub } },
        create: { tenantId: attempt.tenantId, googleAccountId: info.sub, email: info.email, scopes: token.scope || "", accessTokenEncrypted: this.encrypt(token.access_token), refreshTokenEncrypted: token.refresh_token ? this.encrypt(token.refresh_token) : null, expiresAt: new Date(Date.now() + (token.expires_in || 3600) * 1000) },
        update: { disabledServices: { set: (prior?.disabledServices || []).filter(s=>s!==(attempt.service.startsWith("drive-")?"drive":attempt.service)&&s!=="hidden:"+(attempt.service.startsWith("drive-")?"drive":attempt.service)) }, email: info.email, scopes: Array.from(new Set([...(prior?.scopes || "").split(" "), ...granted])).filter(Boolean).join(" "), accessTokenEncrypted: this.encrypt(token.access_token), ...(token.refresh_token ? { refreshTokenEncrypted: this.encrypt(token.refresh_token) } : {}), expiresAt: new Date(Date.now() + (token.expires_in || 3600) * 1000) },
      });
      return done("connected");
    } catch { return done("failed"); }
  }
  @Delete("connections/:id/services/:service")
  @UseGuards(AuthGuard)
  async disconnectService(@Req() req:AuthenticatedRequest,@Param("id") id:string,@Param("service") service:string){
    if(!["OWNER","ADMIN"].includes(req.user.role))throw new ForbiddenException("Apenas administradores podem gerenciar Google.");
    if(!["calendar","drive"].includes(service))throw new BadRequestException("Serviço inválido.");
    const row=await this.prisma.googleConnection.findFirst({where:{id,tenantId:req.user.tenantId}});
    if(!row)throw new BadRequestException("Conexão não encontrada.");
    await this.prisma.googleConnection.update({where:{id},data:{disabledServices:{set:Array.from(new Set([...row.disabledServices,service]))}}});
    return {disconnected:true,service,otherServicePreserved:true};
  }
  @Delete('connections/:id/services/:service/forget')
  @UseGuards(AuthGuard)
  async forgetService(@Req() req:AuthenticatedRequest,@Param('id') id:string,@Param('service') service:string){
    if(!['OWNER','ADMIN'].includes(req.user.role))throw new ForbiddenException();
    if(!['calendar','drive'].includes(service))throw new BadRequestException('Serviço inválido.');
    await this.prisma.$transaction(async tx=>{
      await tx.$queryRaw`SELECT id FROM google_connections WHERE id=${id}::uuid AND tenant_id=${req.user.tenantId}::uuid FOR UPDATE`;
      const row=await tx.googleConnection.findFirst({where:{id,tenantId:req.user.tenantId}});
      if(!row||!row.disabledServices.includes(service))throw new BadRequestException('Desconecte este serviço antes de removê-lo da lista.');
      await tx.googleConnection.update({where:{id},data:{disabledServices:{set:Array.from(new Set([...row.disabledServices,'hidden:'+service]))}}});
    });return {removed:true,service};
  }
  @Delete("connections/:id/forget")
  @UseGuards(AuthGuard)
  async forget(@Req() req:AuthenticatedRequest,@Param('id') id:string){
    if(!['OWNER','ADMIN'].includes(req.user.role))throw new ForbiddenException();
    const row=await this.prisma.googleConnection.findFirst({where:{id,tenantId:req.user.tenantId}});
    if(!row)throw new BadRequestException('Conexão não encontrada.');
    const services=['calendar','drive'].filter(service=>row.scopes.includes(service==='drive'?'/drive':'/calendar'));
    if(services.some(service=>!row.disabledServices.includes(service)))throw new BadRequestException('Desconecte os serviços antes de remover a conta.');
    await this.prisma.googleConnection.deleteMany({where:{id,tenantId:req.user.tenantId}});return {removed:true};
  }
  @Delete("connections/:id")
  @UseGuards(AuthGuard)
  async disconnect(@Req() req: AuthenticatedRequest, @Param("id") id: string) {
    if (!["OWNER", "ADMIN"].includes(req.user.role)) throw new ForbiddenException("Apenas administradores podem desconectar Google.");
    const row = await this.prisma.googleConnection.findFirst({ where: { id, tenantId: req.user.tenantId } });
    if (!row) throw new BadRequestException("Conexão não encontrada.");
    const token = row.refreshTokenEncrypted ? this.decrypt(row.refreshTokenEncrypted) : this.decrypt(row.accessTokenEncrypted);
    try { await fetch("https://oauth2.googleapis.com/revoke?token=" + encodeURIComponent(token), { method: "POST", signal: AbortSignal.timeout(8000) }); } catch { /* Local removal must still succeed. */ }
    await this.prisma.googleConnection.delete({ where: { id: row.id } });
    return { disconnected: true };
  }
}

