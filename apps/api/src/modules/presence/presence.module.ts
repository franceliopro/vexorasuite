import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AuthModule } from '../../auth/auth.module';
import { PrismaModule } from '../../prisma/prisma.module';
import { PrismaService } from '../../common/prisma.service';
import { CloudflareService } from '../sites-deploy/cloudflare.service';
import { PresenceController } from './presence.controller';
import { PresenceService } from './presence.service';

@Module({
  imports: [AuthModule, JwtModule.register({}), PrismaModule],
  controllers: [PresenceController],
  providers: [PresenceService, CloudflareService, PrismaService],
})
export class PresenceModule {}
