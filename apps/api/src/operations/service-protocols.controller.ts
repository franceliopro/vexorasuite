import { Controller, Get, Param, ParseUUIDPipe, Post, Req, UseGuards } from "@nestjs/common";
import { AuthGuard } from "../auth/auth.guard";
import { AuthenticatedRequest } from "../auth/auth.types";
import { ServiceProtocolsService } from "./service-protocols.service";

@Controller("service-protocols")
@UseGuards(AuthGuard)
export class ServiceProtocolsController {
  constructor(private readonly protocols: ServiceProtocolsService) {}

  @Post("conversations/:conversationId")
  create(@Req() request: AuthenticatedRequest, @Param("conversationId", ParseUUIDPipe) conversationId: string) {
    return this.protocols.getOrCreate(request.user.tenantId, conversationId);
  }

  @Get(":code")
  find(@Req() request: AuthenticatedRequest, @Param("code") code: string) {
    return this.protocols.find(request.user.tenantId, code);
  }
}
