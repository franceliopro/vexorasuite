import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { SiteEditorController } from './site-editor.controller';
import { SiteEditorService } from './site-editor.service';
import { SiteAiService } from './site-ai.service';
import { SitePreviewService } from './site-preview.service';
import { PublicSitePreviewController } from './public-site-preview.controller';
import { PrismaService } from '../../common/prisma.service';
import { AuthModule } from '../../auth/auth.module';
import { PrismaModule } from '../../prisma/prisma.module';
import { AiModule } from '../../ai/ai.module';

@Module({
  imports: [AuthModule, JwtModule.register({}), PrismaModule, AiModule],
  controllers: [SiteEditorController, PublicSitePreviewController],
  providers: [SiteEditorService, SiteAiService, SitePreviewService, PrismaService],
  exports: [SiteEditorService, SitePreviewService],
})
export class SiteEditorModule {}
