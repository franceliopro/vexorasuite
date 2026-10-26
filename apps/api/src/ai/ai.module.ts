import { Module } from "@nestjs/common";
import { PrismaModule } from "../prisma/prisma.module";
import { AiService } from "./ai.service";
import { AssistantController } from "./assistant.controller";

@Module({ imports: [PrismaModule], controllers: [AssistantController], providers: [AiService], exports: [AiService] })
export class AiModule {}
