import "reflect-metadata";
import { ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true, rawBody: true });
  app.setGlobalPrefix("api");
  app.enableShutdownHooks();
  app.enableCors({
    origin: (process.env.CORS_ORIGINS ?? "http://localhost:3000").split(",").map((value) => value.trim()),
    credentials: true,
  });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true }));
  const port = Number(process.env.API_PORT ?? 3001);
  await app.listen(port, "0.0.0.0");
}
void bootstrap();
