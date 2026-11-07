import { Body, Controller, ForbiddenException, Get, Param, ParseUUIDPipe, Patch, Post, Req, UseGuards } from "@nestjs/common";
import { AuthGuard } from "../auth/auth.guard";
import { AuthenticatedRequest } from "../auth/auth.types";
import { EmailMailboxService } from "./email-mailbox.service";

@Controller("mailboxes")
@UseGuards(AuthGuard)
export class EmailMailboxController {
  constructor(private readonly mailboxes: EmailMailboxService) {}

  private authorize(request: AuthenticatedRequest): void {
    if (!["OWNER", "ADMIN", "MANAGER"].includes(request.user.role)) throw new ForbiddenException("Somente administradores podem gerenciar caixas de e-mail.");
  }

  @Get()
  async list(@Req() request: AuthenticatedRequest) {
    this.authorize(request);
    return { mailboxes: await this.mailboxes.list(request.user.tenantId) };
  }

  @Post()
  async create(@Req() request: AuthenticatedRequest, @Body() body: Record<string, unknown>) {
    this.authorize(request);
    return this.mailboxes.create(request.user.tenantId, body);
  }

  @Post(":id/verify")
  async verify(@Req() request: AuthenticatedRequest, @Param("id", ParseUUIDPipe) id: string) {
    this.authorize(request);
    return this.mailboxes.verify(request.user.tenantId, id);
  }

  @Patch(":id")
  async update(@Req() request: AuthenticatedRequest, @Param("id", ParseUUIDPipe) id: string, @Body() body: Record<string, unknown>) {
    this.authorize(request);
    return this.mailboxes.update(request.user.tenantId, id, body);
  }

  @Post(":id/sync")
  async sync(@Req() request: AuthenticatedRequest, @Param("id", ParseUUIDPipe) id: string) {
    this.authorize(request);
    return this.mailboxes.sync(request.user.tenantId, id);
  }
}
