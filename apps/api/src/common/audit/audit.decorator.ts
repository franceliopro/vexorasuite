import { SetMetadata } from "@nestjs/common";

export const AUDIT_COVERED = "audit_covered";

/**
 * Marks a controller (or handler) that already writes its own semantic audit entries, so the
 * generic request audit does not duplicate them.
 */
export const AuditCovered = () => SetMetadata(AUDIT_COVERED, true);
