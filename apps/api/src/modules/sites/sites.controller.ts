import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Req, UseGuards } from "@nestjs/common";
import { AuthGuard } from "../../auth/auth.guard";
import { AuthenticatedRequest } from "../../auth/auth.types";
import { SitesService } from "./sites.service";

@UseGuards(AuthGuard)
@Controller("sites")
export class SitesController {
  constructor(private readonly service: SitesService) {}

  @Get()
  list(@Req() req: AuthenticatedRequest) {
    return this.service.list(req.user.tenantId);
  }

  @Get(":id")
  get(@Param("id", ParseUUIDPipe) id: string, @Req() req: AuthenticatedRequest) {
    return this.service.get(id, req.user.tenantId);
  }

  @Post()
  create(@Req() req: AuthenticatedRequest, @Body() body: Record<string, unknown>) {
    return this.service.create(req.user.tenantId, req.user.role, body);
  }

  @Patch(":id")
  update(
    @Param("id", ParseUUIDPipe) id: string,
    @Req() req: AuthenticatedRequest,
    @Body() body: Record<string, unknown>,
  ) {
    return this.service.update(id, req.user.tenantId, req.user.role, body);
  }

  @Delete(":id")
  remove(@Param("id", ParseUUIDPipe) id: string, @Req() req: AuthenticatedRequest) {
    return this.service.remove(id, req.user.tenantId, req.user.role);
  }
}
