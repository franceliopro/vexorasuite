import { CallHandler, ExecutionContext, HttpException, HttpStatus, Injectable, NestInterceptor } from "@nestjs/common";
import { Observable } from "rxjs";
import { RateLimitService } from "./rate-limit.service";

/**
 * Runs after the guards, so an authenticated request is counted against the user instead of the
 * shared address of the reverse proxy.
 */
@Injectable()
export class RateLimitInterceptor implements NestInterceptor {
  constructor(private readonly limiter: RateLimitService) {}

  async intercept(context: ExecutionContext, next: CallHandler): Promise<Observable<unknown>> {
    if (!this.limiter.enabled) return next.handle();
    const request = context.switchToHttp().getRequest();
    if (String(request?.method || "").toUpperCase() === "OPTIONS") return next.handle();

    const decision = await this.limiter.check(request);
    const response = context.switchToHttp().getResponse();
    const setHeader = (name: string, value: string) => {
      if (!response?.setHeader || response.headersSent || response.writableEnded) return;
      response.setHeader(name, value);
    };
    if (response?.setHeader && !response.headersSent && !response.writableEnded) {
      response.setHeader("X-RateLimit-Limit", String(decision.limit));
      response.setHeader("X-RateLimit-Remaining", String(decision.remaining));
    }
    if (!decision.allowed) {
      const retryAfter = Math.max(1, Math.ceil((decision.resetAt - Date.now()) / 1000));
      setHeader("Retry-After", String(retryAfter));
      throw new HttpException(
        `Muitas requisições em pouco tempo. Tente novamente em ${retryAfter} segundo(s).`,
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    return next.handle();
  }
}
