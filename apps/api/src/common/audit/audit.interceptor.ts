import { CallHandler, ExecutionContext, Injectable, Logger, NestInterceptor } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { catchError, Observable, tap, throwError } from "rxjs";
import { PrismaService } from "../../prisma/prisma.service";
import { AUDIT_COVERED } from "./audit.decorator";

const MUTATIONS = new Set(["POST", "PATCH", "PUT", "DELETE"]);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Records every state-changing request in `audit_logs`.
 *
 * Before this, only ~24 of 249 routes wrote an audit entry, so most writes had no evidence of who
 * did what. The record is deliberately narrow: actor, tenant, route, status and duration. The
 * request body is never stored, because it carries passwords, message content and personal data.
 *
 * The write never blocks the response and never fails the request; a database error is logged.
 */
@Injectable()
export class AuditInterceptor implements NestInterceptor {
  private readonly logger = new Logger(AuditInterceptor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly reflector: Reflector,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest();
    const method = String(request?.method || "").toUpperCase();
    const user = request?.user;

    // Reads are not audited at request level, anonymous calls (login, register) have no tenant
    // to attach to, and controllers with their own entries opt out through @AuditCovered().
    if (!MUTATIONS.has(method) || !user?.tenantId || !user?.sub) return next.handle();
    const covered = this.reflector.getAllAndOverride<boolean>(AUDIT_COVERED, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (covered) return next.handle();

    const startedAt = Date.now();
    const response = context.switchToHttp().getResponse();
    return next.handle().pipe(
      tap(() => this.record(request, user, method, response?.statusCode ?? 200, Date.now() - startedAt)),
      catchError((error: unknown) => {
        const status = Number((error as { status?: number; statusCode?: number })?.status
          ?? (error as { statusCode?: number })?.statusCode
          ?? 500);
        this.record(request, user, method, status, Date.now() - startedAt, error);
        return throwError(() => error);
      }),
    );
  }

  private record(
    request: any,
    user: { sub: string; tenantId: string },
    method: string,
    status: number,
    durationMs: number,
    error?: unknown,
  ): void {
    const route = this.routeOf(request);
    const entityId = typeof request?.params?.id === "string" && UUID.test(request.params.id) ? request.params.id : null;
    const details: Record<string, unknown> = {
      method,
      route,
      status,
      durationMs,
    };
    if (error) details.error = error instanceof Error ? error.message.slice(0, 200) : String(error).slice(0, 200);

    void this.prisma.auditLog
      .create({
        data: {
          tenantId: user.tenantId,
          userId: user.sub,
          action: `api.${method.toLowerCase()}`,
          entityType: this.entityTypeOf(route),
          entityId,
          details: details as any,
        },
      })
      .catch((cause: unknown) => {
        this.logger.warn(
          `Não foi possível registrar a auditoria de ${method} ${route}: ${cause instanceof Error ? cause.message : String(cause)}`,
        );
      });
  }

  /** Uses the matched route pattern (with :id placeholders) instead of the raw URL. */
  private routeOf(request: any): string {
    const raw = String(request?.route?.path || request?.path || request?.originalUrl || "/");
    return raw.split("?")[0]!.slice(0, 200);
  }

  private entityTypeOf(route: string): string {
    const segment = route.replace(/^\/api(?=\/)/, "").split("/").filter(Boolean)[0];
    return segment ? segment.slice(0, 60) : "request";
  }
}
