import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { SitesDeployController } from './sites-deploy.controller';
import { SitesDeployService } from './sites-deploy.service';
import { CloudflareService } from './cloudflare.service';
import { PrismaService } from '../../common/prisma.service';
import { AuthModule } from '../../auth/auth.module';
import { PrismaModule } from '../../prisma/prisma.module';

// AuthGuard precisa de JwtService e do PrismaService canonico no contexto do modulo
// (OperationsModule segue o mesmo padrao: AuthModule + JwtModule.register({}) + PrismaModule).
@Module({
  imports: [AuthModule, JwtModule.register({}), PrismaModule],
  controllers: [SitesDeployController],
  providers: [SitesDeployService, CloudflareService, PrismaService],
  exports: [SitesDeployService, CloudflareService],
})
export class SitesDeployModule {}
