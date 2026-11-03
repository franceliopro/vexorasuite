import { forwardRef, Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { PrismaModule } from "../prisma/prisma.module";
import { AuthController } from "./auth.controller";
import { AuthGuard } from "./auth.guard";
import { AuthService } from "./auth.service";
import { AuthThrottle } from "./auth-throttle";
import { RefreshSessionService } from "./refresh-session.service";
import { MailModule } from "../mail/mail.module";

@Module({
  imports: [JwtModule.register({}), PrismaModule, forwardRef(() => MailModule)],
  controllers: [AuthController],
  providers: [
    AuthService,
    RefreshSessionService,
    AuthGuard,
    {
      // AuthThrottle receives primitive runtime settings. Construct it explicitly
      // so Nest never tries to resolve those values as injectable providers.
      provide: AuthThrottle,
      useFactory: () => new AuthThrottle(),
    },
  ],
  exports: [AuthGuard],
})
export class AuthModule {}
