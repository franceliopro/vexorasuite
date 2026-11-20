import { Body, Controller, Post, Req, UseGuards } from "@nestjs/common";
import { AuthGuard } from "../../auth/auth.guard";
import { AuthenticatedRequest } from "../../auth/auth.types";
import { SitesImportService } from "./sites-import.service";

/** Rotas de importação. O módulo SITES já é exigido pela política de rotas /api/sites*. */
@UseGuards(AuthGuard)
@Controller("sites/import")
export class SitesImportController {
  constructor(private readonly service: SitesImportService) {}

  @Post("url")
  fromUrl(@Req() req: AuthenticatedRequest, @Body() body: Record<string, unknown>) {
    return this.service.fromUrl(body, req.user.tenantId, req.user.role);
  }

  @Post("html")
  fromHtml(@Req() req: AuthenticatedRequest, @Body() body: Record<string, unknown>) {
    return this.service.fromHtml(body, req.user.tenantId, req.user.role);
  }

  @Post("zip")
  fromZip(@Req() req: AuthenticatedRequest, @Body() body: Record<string, unknown>) {
    return this.service.fromZip(body, req.user.tenantId, req.user.role);
  }
}
