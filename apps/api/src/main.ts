import "reflect-metadata";
import { DocumentNormalizationPipe } from "./common/documents";
import { ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true, rawBody: true });
  app.setGlobalPrefix("api");
  // Behind Dokploy/Traefik the real client address comes in X-Forwarded-For. Without this the
  // rate limit would bucket every visitor under the proxy IP. Set TRUST_PROXY=0 if the API is
  // ever exposed directly.
  const trustProxy = process.env.TRUST_PROXY ?? (process.env.NODE_ENV === "production" ? "1" : "");
  if (trustProxy) {
    app.getHttpAdapter().getInstance().set("trust proxy", /^\d+$/.test(trustProxy) ? Number(trustProxy) : trustProxy);
  }
  app.enableShutdownHooks();
  app.enableCors({
    origin: (process.env.CORS_ORIGINS ?? "http://localhost:3000").split(",").map((value) => value.trim()),
    credentials: true,
  });
  app.useGlobalPipes(new DocumentNormalizationPipe(), new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true }));
  const port = Number(process.env.API_PORT ?? 3001);
  await app.listen(port, "0.0.0.0");
}
void bootstrap();
