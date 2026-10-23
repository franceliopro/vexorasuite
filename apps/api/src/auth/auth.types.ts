import { Request } from "express";

export interface AuthPayload {
  sub: string;
  tenantId: string;
  tenantSlug: string;
  role: "OWNER" | "ADMIN" | "MANAGER" | "AGENT";
}

export interface AuthenticatedRequest extends Request {
  user: AuthPayload;
}
