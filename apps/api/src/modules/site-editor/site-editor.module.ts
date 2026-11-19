import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { SiteEditorController } from './site-editor.controller';
import { SiteEditorService } from './site-editor.service';
import { PrismaService } from '../../common/prisma.service';
import { AuthModule } from '../../auth/auth.module';
import { PrismaModule } from '../../prisma/prisma.module';

@Module({
  imports: [AuthModule, JwtModule.register({}), PrismaModule],
  controllers: [SiteEditorController],
  providers: [SiteEditorService, PrismaService],
  exports: [SiteEditorService],
})
export class SiteEditorModule {}
