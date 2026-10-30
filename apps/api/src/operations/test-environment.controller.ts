import { Body, Controller, Post, Req, UseGuards } from "@nestjs/common";
import { AuthGuard } from "../auth/auth.guard";
import { AuthenticatedRequest } from "../auth/auth.types";
import { TestEnvironmentResetService } from "./test-environment-reset.service";

@Controller("admin")
@UseGuards(AuthGuard)
export class TestEnvironmentController {
  constructor(private readonly resetService: TestEnvironmentResetService) {}

  @Post("test-reset")
  reset(@Req() request: AuthenticatedRequest, @Body() body: {
    confirmation?: unknown;
    clientSlug?: unknown;
    resetPlatformConversations?: unknown;
    disconnectProviders?: unknown;
  }) {
    return this.resetService.reset(request, body);
  }
}
