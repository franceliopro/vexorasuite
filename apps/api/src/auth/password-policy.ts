import { randomBytes } from "node:crypto";

export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 128;
export const PASSWORD_SYMBOLS = "@#$%&*()_-=+/\\|ç{[}]'!;:?";
export const PASSWORD_REQUIREMENTS = "Use pelo menos 8 caracteres, com uma maiúscula, uma minúscula, um número e um destes símbolos: " + PASSWORD_SYMBOLS;

export function newPasswordProblem(password: unknown): string | null {
  if (typeof password !== "string" || [...password].length < PASSWORD_MIN_LENGTH) {
    return "A senha deve ter pelo menos 8 caracteres.";
  }
  if (password.length > PASSWORD_MAX_LENGTH) return "A senha deve ter no máximo " + PASSWORD_MAX_LENGTH + " caracteres.";
  const hasSymbol = [...password].some(character => PASSWORD_SYMBOLS.includes(character));
  if (!/\p{Lu}/u.test(password) || !/\p{Ll}/u.test(password.replaceAll("ç", "")) || !/[0-9]/.test(password) || !hasSymbol) {
    return PASSWORD_REQUIREMENTS;
  }
  return null;
}

export function generateTemporaryPassword(): string {
  let password: string;
  do {
    password = "Vx!" + randomBytes(24).toString("base64url");
  } while (!/[0-9]/.test(password));
  return password;
}
