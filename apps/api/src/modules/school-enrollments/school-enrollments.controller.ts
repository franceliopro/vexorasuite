import { Body, Controller, Get, Headers, Param, Post, Req, UseGuards } from "@nestjs/common";
import { AuthGuard, Public } from "../../auth/auth.guard";
import { AuthenticatedRequest } from "../../auth/auth.types";
import { SchoolEnrollmentsService } from "./school-enrollments.service";

/** Matrícula da escola: rotas autenticadas exigem SCHOOL; o visitante usa só o token. */
@UseGuards(AuthGuard)
@Controller("school-enrollments")
export class SchoolEnrollmentsController {
  constructor(private readonly service: SchoolEnrollmentsService) {}

  @Get("overview")
  overview(@Req() req: AuthenticatedRequest) {
    return this.service.overview(req.user.tenantId);
  }

  @Post("templates")
  saveTemplate(@Req() req: AuthenticatedRequest, @Body() body: Record<string, unknown>) {
    return this.service.saveTemplate(body, req.user.tenantId, req.user.role, req.user.sub);
  }

  @Post("links")
  createLink(@Req() req: AuthenticatedRequest, @Body() body: Record<string, unknown>) {
    return this.service.createLink(body, req.user.tenantId, req.user.role, req.user.sub);
  }

  @Post("links/:id/rotate")
  rotateLink(@Req() req: AuthenticatedRequest, @Param("id") id: string) {
    return this.service.rotateLink(id, req.user.tenantId, req.user.role);
  }

  @Post("links/:id/status")
  setLinkStatus(@Req() req: AuthenticatedRequest, @Param("id") id: string, @Body() body: Record<string, unknown>) {
    return this.service.setLinkStatus(id, req.user.tenantId, req.user.role, body);
  }

  @Public()
  @Get("public/:token")
  publicForm(@Param("token") token: string) {
    return this.service.publicForm(token);
  }

  @Public()
  @Post("public/:token/submit")
  submit(@Param("token") token: string, @Body() body: Record<string, unknown>, @Req() req: AuthenticatedRequest) {
    const ip = req.ip || req.socket?.remoteAddress || "unknown";
    return this.service.submit(token, body, ip);
  }

  @Public()
  @Post("webhook/documenso")
  webhook(
    @Body() body: Record<string, unknown>,
    @Headers("x-documenso-secret") secret: string | undefined,
  ) {
    return this.service.handleWebhook(body, secret);
  }
}
