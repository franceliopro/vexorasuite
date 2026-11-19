import { Module } from '@nestjs/common';
import { SitesDeployController } from './sites-deploy.controller';
import { SitesDeployService } from './sites-deploy.service';
import { CloudflareService } from './cloudflare.service';
import { PrismaService } from '../../common/prisma.service';
import { AuthModule } from '../../auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [SitesDeployController],
  providers: [SitesDeployService, CloudflareService, PrismaService],
  exports: [SitesDeployService, CloudflareService],
})
export class SitesDeployModule {}
