export const PHP_VERSIONS = [
  "5.2",
  "5.3",
  "5.4",
  "5.5",
  "5.6",
  "7.0",
  "7.1",
  "7.2",
  "7.3",
  "7.4",
  "8.0",
  "8.1",
  "8.2",
  "8.3",
  "8.4",
  "8.5",
  "8.6",
] as const;

export type PhpVersion = (typeof PHP_VERSIONS)[number];

const LEGACY_VERSIONS = new Set<string>(
  PHP_VERSIONS.filter(
    (version) => version.startsWith("5.") || version.startsWith("7."),
  ),
);

export function isPhpVersion(value: unknown): value is PhpVersion {
  return (
    typeof value === "string" &&
    (PHP_VERSIONS as readonly string[]).includes(value)
  );
}

export function isLegacyPhpVersion(value: string): boolean {
  return LEGACY_VERSIONS.has(value);
}
