import { ServiceUnavailableException } from "@nestjs/common";

export type ImapMode = "imap" | "off";

export interface ImapSettings {
  mode: ImapMode;
  service?: string;
  host?: string;
  port: number;
  secure: boolean;
  user?: string;
  password?: string;
  mailbox: string;
  missing: string[];
  blank: string[];
  warnings: string[];
}

type Env = Record<string, string | undefined>;

const PRESETS: Record<string, { host: string; port: number }> = {
  gmail: { host: "imap.gmail.com", port: 993 },
  google: { host: "imap.gmail.com", port: 993 },
  zoho: { host: "imap.zoho.com", port: 993 },
  titan: { host: "imap.titan.email", port: 993 },
  outlook: { host: "outlook.office365.com", port: 993 },
  office365: { host: "outlook.office365.com", port: 993 },
};

const first = (env: Env, names: string[]): { value: string; source: string } | undefined => {
  for (const name of names) {
    const value = env[name]?.trim();
    if (value) return { value, source: name };
  }
  return undefined;
};

const truthy = (value: string): boolean => ["1", "true", "yes", "on"].includes(value.toLowerCase());

const parseHost = (raw: string): { host: string; port?: number } => {
  const value = raw.trim().replace(/^[a-z]+:\/\//i, "").replace(/\/+$/, "");
  const match = /^([^:\s]+):(\d{2,5})$/.exec(value);
  return match ? { host: match[1]!, port: Number(match[2]) } : { host: value.split(/\s/)[0]! };
};

const looksLikePlaceholder = (value: string): boolean =>
  /^<.*>$/.test(value) || /senha de app|sua senha|changeme/i.test(value);

export function maskImapAddress(address?: string): string | undefined {
  if (!address) return undefined;
  const at = address.lastIndexOf("@");
  if (at <= 0) return "***";
  const local = address.slice(0, at);
  return local.slice(0, 2) + "*".repeat(Math.max(1, local.length - 2)) + address.slice(at);
}

export function resolveImapSettings(env: Env = process.env): ImapSettings {
  const warnings: string[] = [];
  const serviceEntry = first(env, ["MAIL_IMAP_SERVICE", "MAIL_SERVICE"]);
  const hostEntry = first(env, ["MAIL_IMAP_HOST"]);
  const portEntry = first(env, ["MAIL_IMAP_PORT"]);
  const secureEntry = first(env, ["MAIL_IMAP_SECURE"]);
  const userEntry = first(env, ["MAIL_IMAP_USER", "MAIL_USER"]);
  const passwordEntry = first(env, ["MAIL_IMAP_PASSWORD", "MAIL_PASSWORD"]);
  const mailbox = first(env, ["MAIL_IMAP_MAILBOX"])?.value || "INBOX";

  let service = serviceEntry?.value.toLowerCase();
  if (!service && userEntry && /@(gmail|googlemail)\.com$/i.test(userEntry.value)) service = "gmail";

  const preset = service ? PRESETS[service] : undefined;
  const host = hostEntry ? parseHost(hostEntry.value).host : preset?.host;
  const parsedHost = hostEntry ? parseHost(hostEntry.value) : undefined;
  let port = portEntry ? Number(portEntry.value) : parsedHost?.port || preset?.port || 993;
  if (!Number.isFinite(port) || port <= 0) port = 993;

  const secure = secureEntry ? truthy(secureEntry.value) : port === 993;
  if (secureEntry && !secure && port === 993) {
    warnings.push("MAIL_IMAP_SECURE=false com porta 993: o servidor normalmente espera TLS implícito.");
  }
  if (hostEntry && parsedHost?.host !== hostEntry.value) {
    warnings.push("MAIL_IMAP_HOST foi normalizada para remover esquema, porta ou barra final.");
  }

  let password = passwordEntry?.value;
  const userPlaceholder = Boolean(userEntry?.value && looksLikePlaceholder(userEntry.value));
  const passwordPlaceholder = Boolean(passwordEntry?.value && looksLikePlaceholder(passwordEntry.value));
  const placeholders = userPlaceholder || passwordPlaceholder;
  if (password && service === "gmail") password = password.replace(/\s+/g, "");

  const missing: string[] = [];
  if (!host) missing.push("MAIL_IMAP_HOST");
  if (!userEntry || userPlaceholder) missing.push("MAIL_IMAP_USER");
  if (!passwordEntry || !password || passwordPlaceholder) missing.push("MAIL_IMAP_PASSWORD");
  if (placeholders) warnings.push("A configuração IMAP contém texto de exemplo, não uma credencial real.");

  const blank = ["MAIL_IMAP_HOST", "MAIL_IMAP_PORT", "MAIL_IMAP_SECURE", "MAIL_IMAP_USER", "MAIL_IMAP_PASSWORD", "MAIL_IMAP_MAILBOX"]
    .filter((name) => env[name] !== undefined && !env[name]?.trim());

  return {
    mode: missing.length ? "off" : "imap",
    service,
    host,
    port,
    secure,
    user: userEntry?.value,
    password,
    mailbox,
    missing,
    blank,
    warnings,
  };
}

export function assertImapConfigured(settings = resolveImapSettings()): asserts settings is ImapSettings & { mode: "imap"; host: string; user: string; password: string } {
  if (settings.mode !== "imap" || !settings.host || !settings.user || !settings.password) {
    throw new ServiceUnavailableException(
      `IMAP incompleto: defina ${settings.missing.join(", ") || "MAIL_IMAP_*"} antes de conectar a caixa de entrada.`,
    );
  }
}
