import { Module } from "@nestjs/common";
import { PrismaModule } from "../prisma/prisma.module";
import { AuthModule } from "../auth/auth.module";
import { AiService } from "./ai.service";
import { AssistantController } from "./assistant.controller";

@Module({ imports: [PrismaModule, AuthModule], controllers: [AssistantController], providers: [AiService], exports: [AiService] })
export class AiModule {}
