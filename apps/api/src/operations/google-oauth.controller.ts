import { Controller, Get, Res } from "@nestjs/common";
import type { Response } from "express";

const callbackPath = "/api/integrations/google/callback";
@Controller("integrations/google")
export class GoogleOAuthController {
  @Get("config")
  config() {
    const base = (process.env.API_PUBLIC_URL || "").replace(/\/$/, "");
    return {
      callbackUrl: base ? base + callbackPath : null,
      configured: Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET),
      status: "PENDING_OAUTH_IMPLEMENTATION",
      message: "Rota de retorno disponível. A autorização Google ainda não está habilitada.",
    };
  }

  @Get("callback")
  callback(@Res() response: Response) {
    // No token exchange is performed until CSRF state, PKCE, tenant binding and
    // encrypted per-tenant credential storage have been implemented.
    response.status(503).json({
      status: "GOOGLE_OAUTH_NOT_ENABLED",
      message: "O retorno OAuth está publicado, mas a conexão Google ainda não está habilitada.",
    });
  }
}
