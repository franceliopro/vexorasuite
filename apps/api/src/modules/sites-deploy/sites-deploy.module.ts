import { Module } from '@nestjs/common';
import { SitesDeployController } from './sites-deploy.controller';
import { SitesDeployService } from './sites-deploy.service';
import { CloudflareService } from './cloudflare.service';
import { PrismaService } from '../../common/prisma.service';
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [ConfigModule],
  controllers: [SitesDeployController],
  providers: [SitesDeployService, CloudflareService, PrismaService],
  exports: [SitesDeployService, CloudflareService],
})
export class SitesDeployModule {}