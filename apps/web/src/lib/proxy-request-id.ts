import { randomUUID } from "node:crypto";

export const REQUEST_ID_HEADER = "x-request-id";
const SAFE_REQUEST_ID = /^[A-Za-z0-9._-]{1,128}$/;

export function isSafeRequestId(value: string | null | undefined): value is string {
  return Boolean(value && SAFE_REQUEST_ID.test(value));
}

export function getProxyRequestId(request: Request): string {
  const candidate = request.headers.get(REQUEST_ID_HEADER);
  return isSafeRequestId(candidate) ? candidate : randomUUID();
}

export function getResponseRequestId(headers: Headers, fallback: string): string {
  const candidate = headers.get(REQUEST_ID_HEADER);
  return isSafeRequestId(candidate) ? candidate : fallback;
}

export function applyResponseRequestId(response: Response, requestId: string): Response {
  response.headers.set(REQUEST_ID_HEADER, requestId);
  return response;
}
