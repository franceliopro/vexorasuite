import { Body, Controller, Delete, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../../auth/auth.guard';
import { AuthenticatedRequest } from '../../auth/auth.types';
import { PresenceService } from './presence.service';

@UseGuards(AuthGuard)
@Controller('presence')
export class PresenceController {
  constructor(private readonly service: PresenceService) {}

  @Get()
  list(@Req() req: AuthenticatedRequest) { return this.service.list(req); }

  @Get('art/:id/svg')
  svg(@Req() req: AuthenticatedRequest, @Param('id') id: string) { return this.service.svg(req, id); }

  @Post('sites/external')
  addSite(@Req() req: AuthenticatedRequest, @Body() body: { title?: string; url?: string; description?: string }) {
    return this.service.addExternalSite(req, body);
  }

  @Delete('sites/external/:id')
  removeSite(@Req() req: AuthenticatedRequest, @Param('id') id: string) { return this.service.removeExternalSite(req, id); }

  @Post('art')
  createArt(@Req() req: AuthenticatedRequest, @Body() body: { title?: string; headline?: string; subtitle?: string; cta?: string; colors?: Record<string, string> }) {
    return this.service.createArtwork(req, body);
  }

  @Post('art/:id/publish')
  publishArt(@Req() req: AuthenticatedRequest, @Param('id') id: string) { return this.service.publishArtwork(req, id); }
}
