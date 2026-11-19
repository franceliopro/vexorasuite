import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { SitesDeployController } from './sites-deploy.controller';
import { SitesDeployService } from './sites-deploy.service';
import { CloudflareService } from './cloudflare.service';
import { PrismaService } from '../../common/prisma.service';
import { AuthModule } from '../../auth/auth.module';

// AuthGuard precisa de JwtService no contexto do modulo (o AuthModule exporta o
// guard, mas nao o JwtModule) — mesmo padrao do OperationsModule.
@Module({
  imports: [AuthModule, JwtModule.register({})],
  controllers: [SitesDeployController],
  providers: [SitesDeployService, CloudflareService, PrismaService],
  exports: [SitesDeployService, CloudflareService],
})
export class SitesDeployModule {}
