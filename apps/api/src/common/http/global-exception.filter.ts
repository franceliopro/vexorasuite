import { ArgumentsHost, Catch, ExceptionFilter, HttpException, Logger } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import type { Request, Response } from "express";

const REQUEST_ID_HEADER = "x-request-id";
const SAFE_REQUEST_ID = /^[A-Za-z0-9._-]{1,128}$/;

type ErrorResponse = {
  statusCode: number;
  timestamp: string;
  path: string;
  requestId: string;
  message: string;
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

    response.setHeader(REQUEST_ID_HEADER, requestId);
    response.status(statusCode).json({
      statusCode,
      timestamp: new Date().toISOString(),
      path,
      requestId,
      message: this.getPublicMessage(exception, statusCode),
    } satisfies ErrorResponse);

    this.logger.warn(this.describeFailure(exception, { statusCode, path, requestId }));
  }

  private getRequestId(request: Request): string {
    const candidate = request.header(REQUEST_ID_HEADER);
    return candidate && SAFE_REQUEST_ID.test(candidate) ? candidate : randomUUID();
  }

  private getPublicMessage(exception: unknown, statusCode: number): string {
    if (exception instanceof HttpException) {
      const exceptionResponse = exception.getResponse();
      if (typeof exceptionResponse === "string") {
        return exceptionResponse;
      }

      if (exceptionResponse && typeof exceptionResponse === "object") {
        const message = (exceptionResponse as { message?: unknown }).message;
        if (typeof message === "string") {
          return message;
        }
        if (Array.isArray(message) && message.every((item) => typeof item === "string")) {
          return message.join("; ");
        }
      }

      return exception.message || `HTTP request failed with status ${statusCode}`;
    }

    return "Internal server error";
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
      return `HTTP request failed ${JSON.stringify({ ...context, details })}`;
    } catch {
      return `HTTP request failed ${JSON.stringify(context)}`;
    }
  }
}
