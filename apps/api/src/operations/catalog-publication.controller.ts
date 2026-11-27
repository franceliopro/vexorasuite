import {
  Body, Controller, ForbiddenException, Get, Param, ParseUUIDPipe, Post, Query, Req, UseGuards,
} from "@nestjs/common";
import { AuthGuard } from "../auth/auth.guard";
import { AuthenticatedRequest } from "../auth/auth.types";
import { administrative } from "../auth/module-policy";
import { CatalogPublicationService } from "./catalog-publication.service";

@Controller("catalog/publications")
@UseGuards(AuthGuard)
export class CatalogPublicationController {
  constructor(private readonly publications: CatalogPublicationService) {}

  private adminOnly(req: AuthenticatedRequest) {
    if (!administrative(req.user.role)) throw new ForbiddenException("Somente administradores publicam ou importam itens do catálogo.");
  }

  @Get("import/preview")
  async importPreview(@Req() req: AuthenticatedRequest, @Query("provider") provider?: string, @Query("limit") limit?: string) {
    this.adminOnly(req);
    return this.publications.importPreview(req.user.tenantId, provider, limit);
  }

  @Post("import")
  async importItem(@Req() req: AuthenticatedRequest, @Body() body: any) {
    this.adminOnly(req);
    return this.publications.importItem(req.user.tenantId, body?.provider, body?.externalId, body?.confirm, req.user.sub);
  }

  @Get(":itemId")
  async status(@Req() req: AuthenticatedRequest, @Param("itemId", ParseUUIDPipe) itemId: string) {
    return this.publications.status(req.user.tenantId, itemId);
  }

  @Post(":itemId/publish")
  async publish(@Req() req: AuthenticatedRequest, @Param("itemId", ParseUUIDPipe) itemId: string, @Body() body: any) {
    this.adminOnly(req);
    return this.publications.publish(req.user.tenantId, itemId, body?.provider, body?.confirm, req.user.sub);
  }
}
