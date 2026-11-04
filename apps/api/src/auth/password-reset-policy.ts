import { ForbiddenException } from "@nestjs/common";

export const PLATFORM_ADMIN_PASSWORD_RESET_MESSAGE =
  "A senha da administração Véxora só pode ser redefinida pela própria administração.";

export function assertPasswordResetTargetAllowed(
  actorIsPlatformAdmin: boolean | undefined,
  targetIsPlatformAdmin: boolean | undefined,
): void {
  if (targetIsPlatformAdmin === true && actorIsPlatformAdmin !== true) {
    throw new ForbiddenException(PLATFORM_ADMIN_PASSWORD_RESET_MESSAGE);
  }
}
