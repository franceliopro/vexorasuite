import { BadRequestException } from "@nestjs/common";

/** Normaliza um caminho de pasta relativo à raiz do gerenciador: "/" ou "/segmentos". */
export const normalizeFolder = (value: unknown): string => {
  const raw = String(value ?? "/").trim().replace(/\\/g, "/").replace(/\/{2,}/g, "/");
  let path = raw.startsWith("/") ? raw : "/" + raw;
  const parts = path.split("/").filter(Boolean);
  if (parts.length > 12) throw new BadRequestException("Pasta muito profunda — máximo de 12 níveis.");
  for (const segment of parts) {
    if (segment === "." || segment === ".." || segment.length > 80) throw new BadRequestException("Caminho de pasta inválido.");
  }
  return "/" + parts.join("/") || "/";
};

/** Pasta pai de um caminho ("/a/b" → "/a", "/a" → "/", "/" → "/"). */
export const folderParent = (path: string): string => {
  if (path === "/") return "/";
  const i = path.lastIndexOf("/");
  return i <= 0 ? "/" : path.slice(0, i);
};

/** Nome de um caminho ("/a/b" → "b"). */
export const folderName = (path: string): string => path === "/" ? "Raiz" : path.slice(path.lastIndexOf("/") + 1);

/** Filhos diretos de uma pasta, dado um conjunto de pastas conhecidas. */
export const directChildrenOf = (folder: string, folders: string[]): string[] => {
  const base = folder === "/" ? "" : folder;
  const depth = folder === "/" ? 1 : folder.split("/").filter(Boolean).length + 1;
  const children = new Set<string>();
  for (const path of folders) {
    if (path === folder) continue;
    const prefix = base + "/";
    if (!path.startsWith(prefix)) continue;
    const segments = path.slice(prefix.length).split("/").filter(Boolean);
    if (segments.length === 1) children.add(path);
  }
  return [...children].sort((a, b) => folderName(a).localeCompare(folderName(b), "pt-BR"));
};

/** Garante as pastas de uma cadeia ("/a/b" cria "/a" e "/a/b"). */
export const folderChainOf = (path: string): string[] => {
  if (path === "/") return [];
  const segments = path.split("/").filter(Boolean);
  const out: string[] = [];
  let current = "";
  for (const segment of segments) {
    current += "/" + segment;
    out.push(current);
  }
  return out;
};
