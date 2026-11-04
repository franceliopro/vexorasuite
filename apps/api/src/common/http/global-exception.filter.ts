import { ArgumentsHost, Catch, ExceptionFilter, HttpException, Logger } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import type { Request, Response } from "express";

const REQUEST_ID_HEADER = "x-request-id";
const SAFE_REQUEST_ID = /^[A-Za-z0-9._-]{1,128}$/;
const PUBLIC_PROVIDER_REASONS = new Set([
  "auth",
  "conflict",
  "forbidden",
  "invalid_request",
  "not_found",
  "partial_failure",
  "rate_limit",
  "unavailable",
]);

type PublicMessage = string | string[];

type ErrorResponse = {
  statusCode: number;
  timestamp: string;
  path: string;
  requestId: string;
  message: PublicMessage;
  providerStatus?: number;
  providerReason?: string;
};

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const http = host.switchToHttp();
    const request = http.getRequest<Request>();
    const response = http.getResponse<Response>();
    const statusCode = exception instanceof HttpException ? exception.getStatus() : 500;
    const requestId = this.getRequestId(request);
    const path = request.originalUrl ?? request.url ?? "";

    if (response.headersSent) {
      this.logger.warn(`HTTP request failed after headers were sent ${this.describeFailure(exception, { statusCode, path, requestId })}`);
      return;
    }

    response.setHeader(REQUEST_ID_HEADER, requestId);
    response.status(statusCode).json({
      statusCode,
      timestamp: new Date().toISOString(),
      path,
      requestId,
      message: this.getPublicMessage(exception, statusCode),
      ...this.getPublicProviderDetails(exception),
    } satisfies ErrorResponse);

    this.logger.warn(this.describeFailure(exception, { statusCode, path, requestId }));
  }

  private getRequestId(request: Request): string {
    const candidate = request.header(REQUEST_ID_HEADER);
    return candidate && SAFE_REQUEST_ID.test(candidate) ? candidate : randomUUID();
  }

  private getPublicMessage(exception: unknown, statusCode: number): PublicMessage {
    if (exception instanceof HttpException) {
      const exceptionResponse = exception.getResponse();
      if (this.isProviderError(exceptionResponse)) {
        return "A integração externa não confirmou a operação.";
      }
      if (typeof exceptionResponse === "string") {
        return exceptionResponse;
      }

      if (exceptionResponse && typeof exceptionResponse === "object") {
        const message = (exceptionResponse as { message?: unknown }).message;
        if (typeof message === "string") {
          return message;
        }
        if (Array.isArray(message) && message.every((item) => typeof item === "string")) {
          return message;
        }
      }

      return exception.message || `HTTP request failed with status ${statusCode}`;
    }

    return "Internal server error";
  }

  private getPublicProviderDetails(exception: unknown): Pick<ErrorResponse, "providerStatus" | "providerReason"> {
    if (!(exception instanceof HttpException)) {
      return {};
    }

    const exceptionResponse = exception.getResponse();
    if (!this.isProviderError(exceptionResponse) || !exceptionResponse || typeof exceptionResponse !== "object") {
      return {};
    }

    const response = exceptionResponse as { providerStatus?: unknown; providerReason?: unknown };
    const details: Pick<ErrorResponse, "providerStatus" | "providerReason"> = {};
    if (typeof response.providerStatus === "number" && Number.isInteger(response.providerStatus) && response.providerStatus >= 100 && response.providerStatus <= 599) {
      details.providerStatus = response.providerStatus;
    }
    if (typeof response.providerReason === "string" && PUBLIC_PROVIDER_REASONS.has(response.providerReason)) {
      details.providerReason = response.providerReason;
    }
    return details;
  }

  private isProviderError(response: unknown): response is Record<string, unknown> {
    return Boolean(
      response &&
        typeof response === "object" &&
        ("providerStatus" in response || "providerReason" in response || "providerCode" in response || "dashboardUrl" in response),
    );
  }

  private describeFailure(
    exception: unknown,
    context: { statusCode: number; path: string; requestId: string },
  ): string {
    let details: unknown;
    if (exception instanceof HttpException) {
      details = exception.getResponse();
    } else if (exception instanceof Error) {
      details = { name: exception.name, message: exception.message, stack: exception.stack };
    } else {
      details = exception;
    }

    try {
      return JSON.stringify({ ...context, details });
    } catch {
      return JSON.stringify(context);
    }
  }
}
