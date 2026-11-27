import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common";
import { AuthGuard } from "../auth/auth.guard";
import { AuthenticatedRequest } from "../auth/auth.types";
import { administrative } from "../auth/module-policy";
import { StorefrontCatalogService } from "./storefront-catalog.service";

@Controller("storefront")
@UseGuards(AuthGuard)
export class StorefrontController {
  constructor(private readonly catalog: StorefrontCatalogService) {}

  private adminOnly(req: AuthenticatedRequest) {
    if (!administrative(req.user.role))
      throw new ForbiddenException("Somente administradores gerenciam a vitrine pública.");
  }

  @Get("tokens")
  async list(@Req() req: AuthenticatedRequest) {
    this.adminOnly(req);
    return { tokens: await this.catalog.listTokens(req.user.tenantId) };
  }

  @Post("tokens")
  async create(@Req() req: AuthenticatedRequest, @Body() body: any) {
    this.adminOnly(req);
    return this.catalog.createToken(req.user.tenantId, body);
  }

  @Put("tokens/:id")
  async update(@Req() req: AuthenticatedRequest, @Param("id", ParseUUIDPipe) id: string, @Body() body: any) {
    this.adminOnly(req);
    return this.catalog.updateToken(req.user.tenantId, id, body);
  }

  @Delete("tokens/:id")
  async revoke(@Req() req: AuthenticatedRequest, @Param("id", ParseUUIDPipe) id: string) {
    this.adminOnly(req);
    return this.catalog.revokeToken(req.user.tenantId, id);
  }

  /** Usado pelo atendente: texto/link prontos, sem sessão pública e sem inventar domínio. */
  @Get("share")
  async share(@Req() req: AuthenticatedRequest, @Query("itemId") itemId?: string) {
    return this.catalog.share(req.user.tenantId, itemId);
  }
}

/** Feed somente leitura, sem AuthGuard. O token substitui a sessão e limita o escopo ao catálogo ativo. */
@Controller("public/storefront")
export class PublicStorefrontController {
  constructor(private readonly catalog: StorefrontCatalogService) {}

  @Get(":token")
  async feed(@Param("token") token: string) {
    return this.catalog.publicCatalog(token);
  }
}
