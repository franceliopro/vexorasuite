import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { PrismaModule } from "../prisma/prisma.module";
import { AuthController } from "./auth.controller";
import { AuthGuard } from "./auth.guard";
import { AuthService } from "./auth.service";
import { AuthThrottle, AUTH_MAX_ATTEMPTS, AUTH_WINDOW_MINUTES, AUTH_NOW } from "./auth-throttle";

@Module({
  imports: [JwtModule.register({}), PrismaModule],
  controllers: [AuthController],
  providers: [
    AuthService,
    AuthGuard,
    AuthThrottle,
    {
      provide: AUTH_MAX_ATTEMPTS,
      useFactory: () => Number(process.env.AUTH_MAX_ATTEMPTS ?? 10),
    },
    {
      provide: AUTH_WINDOW_MINUTES,
      useFactory: () => Number(process.env.AUTH_WINDOW_MINUTES ?? 15),
    },
    {
      provide: AUTH_NOW,
      useFactory: () => () => Date.now(),
    },
  ],
  exports: [AuthGuard],
})
export class AuthModule {}
