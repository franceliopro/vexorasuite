import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { SiteEditorController } from './site-editor.controller';
import { SiteEditorService } from './site-editor.service';
import { SiteAiService } from './site-ai.service';
import { PrismaService } from '../../common/prisma.service';
import { AuthModule } from '../../auth/auth.module';
import { PrismaModule } from '../../prisma/prisma.module';
import { AiModule } from '../../ai/ai.module';

@Module({
  imports: [AuthModule, JwtModule.register({}), PrismaModule, AiModule],
  controllers: [SiteEditorController],
  providers: [SiteEditorService, SiteAiService, PrismaService],
  exports: [SiteEditorService],
})
export class SiteEditorModule {}
