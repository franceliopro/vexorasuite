import { Module } from '@nestjs/common';
import { SiteEditorController } from './site-editor.controller';
import { SiteEditorService } from './site-editor.service';
import { PrismaService } from '../../common/prisma.service';
import { AuthModule } from '../../auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [SiteEditorController],
  providers: [SiteEditorService, PrismaService],
  exports: [SiteEditorService],
})
export class SiteEditorModule {}
