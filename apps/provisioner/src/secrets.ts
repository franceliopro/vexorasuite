import { readFileSync } from "node:fs";
import { ProvisionerError } from "./types.js";

/**
 * Lê um Docker secret a partir do caminho configurado por ambiente.
 * O valor nunca é devolvido em /meta, /status, logs ou respostas da GUI.
 */
export function readSecret(path: string): string {
  let raw: string;
  try {
    raw = readFileSync(path, "utf8");
  } catch {
    throw new ProvisionerError(
      "Docker secret indisponível",
      "configuration",
      503,
    );
  }
  const value = raw.trim();
  if (value.length === 0) {
    throw new ProvisionerError("Docker secret vazio", "configuration", 503);
  }
  return value;
}
