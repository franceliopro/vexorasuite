import "reflect-metadata";
import { DocumentNormalizationPipe } from "./common/documents";
import { GlobalExceptionFilter } from "./common/http/global-exception.filter";
import { ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";

const DEFAULT_CORS_ORIGIN = "http://localhost:3000";
const HTTP_PROTOCOL = "http:";
const HTTPS_PROTOCOL = "https:";

function isLocalhost(hostname: string): boolean {
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "[::1]";
}

export function parseCorsOrigins(
  configuredOrigins = process.env.CORS_ORIGINS ?? DEFAULT_CORS_ORIGIN,
  nodeEnv = process.env.NODE_ENV,
): string[] {
  const entries = configuredOrigins.split(",");
  if (entries.some((entry) => entry.trim().length === 0)) {
    throw new Error("CORS_ORIGINS must not contain empty entries");
  }

  const origins = entries.map((entry) => {
    const value = entry.trim();
    if (value === "*") {
      throw new Error("CORS_ORIGINS does not allow wildcard origins");
    }

    let parsed: URL;
    try {
      parsed = new URL(value);
    } catch {
      throw new Error(`Invalid CORS origin: ${value}`);
    }

    if (parsed.protocol !== HTTP_PROTOCOL && parsed.protocol !== HTTPS_PROTOCOL) {
      throw new Error(`CORS origin must use HTTP or HTTPS: ${value}`);
    }
    if (parsed.pathname !== "/" || parsed.search || parsed.hash || parsed.username || parsed.password) {
      throw new Error(`CORS origin must not include a path or credentials: ${value}`);
    }
    if (parsed.protocol === HTTP_PROTOCOL && (nodeEnv === "production" || !isLocalhost(parsed.hostname))) {
      throw new Error(`HTTP CORS origins are only allowed for localhost outside production: ${value}`);
    }

    return parsed.origin;
  });

  return [...new Set(origins)];
}

export function isAllowedCorsOrigin(requestOrigin: string | undefined, allowedOrigins: string[]): boolean {
  if (!requestOrigin) {
    return true;
  }

  try {
    return allowedOrigins.includes(new URL(requestOrigin).origin);
  } catch {
    return false;
  }
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true, rawBody: true });
  app.setGlobalPrefix("api");
  app.useGlobalFilters(new GlobalExceptionFilter());
  // Behind Dokploy/Traefik the real client address comes in X-Forwarded-For. Without this the
  // rate limit would bucket every visitor under the proxy IP. Set TRUST_PROXY=0 if the API is
  // ever exposed directly.
  const trustProxy = process.env.TRUST_PROXY ?? (process.env.NODE_ENV === "production" ? "1" : "");
  if (trustProxy) {
    app.getHttpAdapter().getInstance().set("trust proxy", /^\d+$/.test(trustProxy) ? Number(trustProxy) : trustProxy);
  }
  app.enableShutdownHooks();
  const allowedCorsOrigins = parseCorsOrigins();
  app.enableCors({
    origin: (requestOrigin, callback) => {
      callback(null, isAllowedCorsOrigin(requestOrigin, allowedCorsOrigins));
    },
    credentials: true,
  });
  app.useGlobalPipes(new DocumentNormalizationPipe(), new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true }));
  const port = Number(process.env.API_PORT ?? 3001);
  await app.listen(port, "0.0.0.0");
}

if (require.main === module) {
  void bootstrap();
}
