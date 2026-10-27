import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  UseGuards,
} from "@nestjs/common";
import { AuthGuard } from "../auth/auth.guard";
import { AuthenticatedRequest } from "../auth/auth.types";
import { WorkflowsService } from "./workflows.service";
@Controller("workflows")
@UseGuards(AuthGuard)
export class WorkflowsController {
  constructor(private readonly workflows: WorkflowsService) {}
  @Get() list(@Req() req: AuthenticatedRequest) {
    return this.workflows.list(req);
  }
  @Post() save(@Req() req: AuthenticatedRequest, @Body() input: any) {
    return this.workflows.save(req, input || {});
  }
  @Post(":id/state") state(
    @Req() req: AuthenticatedRequest,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() input: any,
  ) {
    return this.workflows.toggle(req, id, input || {});
  }
  @Post("runs/:id/cancel") cancel(
    @Req() req: AuthenticatedRequest,
    @Param("id", ParseUUIDPipe) id: string,
  ) {
    return this.workflows.cancel(req, id);
  }
}
