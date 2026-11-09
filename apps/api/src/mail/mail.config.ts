/**
 * Single place that reads the mail variables.
 *
 * Two problems this solves, both silent before:
 *
 * 1. A variable created with a different name (`SMTP_HOST`, `GMAIL_USER`, ...) used to leave the
 *    transport off with no explanation. The accepted aliases are listed here and `sources` reports
 *    which variable actually supplied each value.
 * 2. Gmail needs three specific details or it refuses the message: port 465 with implicit TLS, the
 *    *From* address identical to the authenticated account, and the app password without the spaces
 *    the Google screen displays. They are applied (or warned about) here instead of in the docs only.
 */

export type MailMode = "smtp" | "log" | "off";

export type MailField =
  | "transport"
  | "service"
  | "host"
  | "port"
  | "secure"
  | "user"
  | "password"
  | "from"
  | "fromName"
  | "replyTo";

/** Canonical name first; the rest are accepted so an existing deployment is not silently broken. */
const FIELD_ALIASES: Record<MailField, string[]> = {
  transport: ["MAIL_TRANSPORT", "MAIL_MODE"],
  service: ["MAIL_SERVICE", "MAIL_PROVIDER", "SMTP_SERVICE"],
  host: ["MAIL_HOST", "SMTP_HOST", "MAIL_SMTP_HOST"],
  port: ["MAIL_PORT", "SMTP_PORT"],
  secure: ["MAIL_SECURE", "SMTP_SECURE"],
  user: ["MAIL_USER", "SMTP_USER", "MAIL_USERNAME", "SMTP_USERNAME", "GMAIL_USER"],
  password: [
    "MAIL_PASSWORD",
    "SMTP_PASSWORD",
    "MAIL_PASS",
    "SMTP_PASS",
    "MAIL_APP_PASSWORD",
    "GMAIL_PASSWORD",
    "GMAIL_APP_PASSWORD",
  ],
  from: ["MAIL_FROM", "SMTP_FROM", "MAIL_FROM_ADDRESS", "MAIL_SENDER"],
  fromName: ["MAIL_FROM_NAME", "SMTP_FROM_NAME", "MAIL_SENDER_NAME"],
  replyTo: ["MAIL_REPLY_TO", "SMTP_REPLY_TO"],
};

/** Host/port presets for the providers documented in docs/email.md. Never invented per tenant. */
const SERVICE_DEFAULTS: Record<string, { host: string; port: number }> = {
  gmail: { host: "smtp.gmail.com", port: 465 },
  google: { host: "smtp.gmail.com", port: 465 },
  zoho: { host: "smtp.zoho.com", port: 465 },
  titan: { host: "smtp.titan.email", port: 465 },
  outlook: { host: "smtp.office365.com", port: 587 },
  office365: { host: "smtp.office365.com", port: 587 },
};

export interface MailSettings {
  mode: MailMode;
  service?: string;
  host?: string;
  port: number;
  secure: boolean;
  user?: string;
  password?: string;
  from?: string;
  fromName?: string;
  replyTo?: string;
  /** Environment variable that supplied each resolved value. */
  sources: Partial<Record<MailField, string>>;
  /** Canonical variables still empty, when real delivery is requested but impossible. */
  missing: string[];
  /**
   * Names that exist in the environment but are blank. This is different from "absent": it usually
   * means the variable was created in a scope the compose file cannot interpolate (Dokploy project
   * env is read at compose time), so the container receives an empty string.
   */
  blank: string[];
  /** Variables filled with a documentation placeholder instead of a real value. */
  placeholders: string[];
  warnings: string[];
}

type Env = Record<string, string | undefined>;

/** A placeholder left in the panel ("<senha de app>") is not a credential. */
const looksLikePlaceholder = (value: string): boolean =>
  /^<.*>$/.test(value) || /\bsenha de app\b/i.test(value) || /\bsua senha\b/i.test(value) || value === "CHANGEME";

/**
 * Cleans a value copied from documentation.
 *
 * A documented example often carries an inline comment (`smtp.zoho.com   # ou smtp.titan.email`).
 * Copying that whole line into an environment variable produces a host with spaces and a `#`, which
 * fails at connection time with an error nobody reads. Secrets keep their `#`, because a password
 * may legitimately contain one.
 */
export function cleanValue(raw: string, options: { secret?: boolean } = {}): string {
  let value = raw.trim();
  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
    value = value.slice(1, -1).trim();
  }
  if (!options.secret) {
    const comment = value.search(/\s#/);
    if (comment > 0) value = value.slice(0, comment).trim();
  }
  return value;
}

/** Accepts `smtp.zoho.com`, `smtp://smtp.zoho.com`, `smtp.zoho.com:465` and `smtp.zoho.com/`. */
export function parseHost(raw: string): { host: string; port?: number } {
  let value = raw.toLowerCase().replace(/^[a-z]+:\/\//, "").replace(/\/+$/, "");
  const withPort = /^([^:\s]+):(\d{2,5})$/.exec(value);
  if (withPort) return { host: withPort[1]!, port: Number(withPort[2]) };
  value = value.split(/\s/)[0]!;
  return { host: value };
}

const pick = (env: Env, field: MailField): { value: string; source: string } | undefined => {
  for (const name of FIELD_ALIASES[field]) {
    const raw = env[name];
    if (typeof raw !== "string") continue;
    const value = cleanValue(raw, { secret: field === "password" });
    // A value left as "<senha de app>" would otherwise be sent as a real credential.
    if (value && !looksLikePlaceholder(value)) return { value, source: name };
  }
  return undefined;
};


const truthy = (value: string): boolean => ["1", "true", "yes", "on"].includes(value.toLowerCase());
const falsy = (value: string): boolean => ["0", "false", "no", "off"].includes(value.toLowerCase());

export function maskAddress(address?: string): string | undefined {
  if (!address) return undefined;
  const at = address.lastIndexOf("@");
  if (at <= 0) return "***";
  const local = address.slice(0, at);
  const visible = local.slice(0, Math.min(2, local.length));
  return `${visible}${"*".repeat(Math.max(1, local.length - visible.length))}${address.slice(at)}`;
}


/**
 * Reads the environment once and explains the result.
 *
 * `mode` is `smtp` only when the values needed to actually deliver are present; otherwise it falls
 * back to `log` (message written to the log, reported as not delivered) and `missing` names what is
 * absent. Requesting `smtp` without those values never produces a fake success.
 */
export function resolveMailSettings(env: Env = process.env): MailSettings {
  const warnings: string[] = [];
  const sources: Partial<Record<MailField, string>> = {};
  const note = (field: MailField, source: string) => {
    const canonical = FIELD_ALIASES[field][0];
    sources[field] = source;
    if (source !== canonical) {
      warnings.push(`${canonical} não está definida; o valor veio de ${source}. Use ${canonical}.`);
    }
  };

  const transport = pick(env, "transport");
  const requested = (transport?.value || "").toLowerCase();
  if (transport) note("transport", transport.source);
  if (requested === "off") {
    return { mode: "off", port: 587, secure: false, sources, missing: [], blank: [], placeholders: [], warnings };
  }

  const placeholders = Object.values(FIELD_ALIASES)
    .flat()
    .filter((name, index, all) => all.indexOf(name) === index)
    .filter((name) => {
      const raw = env[name];
      if (typeof raw !== "string" || !raw.trim()) return false;
      return looksLikePlaceholder(cleanValue(raw, { secret: name.includes("PASSWORD") }));
    });
  if (placeholders.length > 0) {
    warnings.push(`${placeholders.join(", ")} continua com o texto de exemplo da documentação, não um valor real.`);
  }

  const serviceEntry = pick(env, "service");
  let service = serviceEntry?.value.toLowerCase();
  if (serviceEntry) note("service", serviceEntry.source);

  const userEntry = pick(env, "user");
  if (userEntry) {
    note("user", userEntry.source);
    // A Gmail account without MAIL_SERVICE still means Gmail: the host and the TLS mode are known.
    if (!service && /@(gmail|googlemail)\.com$/i.test(userEntry.value)) {
      service = "gmail";
      sources.service = `${userEntry.source} (detectado como Gmail)`;
    }
  }

  const hostEntry = pick(env, "host");
  const preset = service ? SERVICE_DEFAULTS[service] : undefined;
  let host = hostEntry?.value;
  let hostPort: number | undefined;
  if (hostEntry) {
    note("host", hostEntry.source);
    // Accepts what people actually paste: a scheme, a trailing slash or host:port.
    const parsed = parseHost(hostEntry.value);
    host = parsed.host;
    hostPort = parsed.port;
    if (parsed.host !== hostEntry.value) {
      warnings.push(`MAIL_HOST normalizada de "${hostEntry.value}" para "${parsed.host}".`);
    }
  }
  if (!host && preset) {
    host = preset.host;
    sources.host = `padrão de ${service}`;
  }

  const portEntry = pick(env, "port");
  let port = portEntry ? Number(portEntry.value) : hostPort;
  if (portEntry) note("port", portEntry.source);
  if (!Number.isFinite(port) || (port as number) <= 0) port = preset?.port ?? 587;

  const secureEntry = pick(env, "secure");
  const secure = secureEntry ? truthy(secureEntry.value) : (port as number) === 465;
  if (secureEntry) {
    note("secure", secureEntry.source);
    if (falsy(secureEntry.value) && (port as number) === 465) {
      warnings.push("MAIL_SECURE=false com porta 465: o Gmail e o Zoho esperam TLS implícito nessa porta.");
    }
  }

  const passwordEntry = pick(env, "password");
  let password = passwordEntry?.value;
  if (passwordEntry) note("password", passwordEntry.source);
  if (password && service === "gmail" && /\s/.test(password)) {
    // Google shows app passwords as "abcd efgh ijkl mnop"; the spaces are part of the display only.
    password = password.replace(/\s+/g, "");
    warnings.push("Espaços removidos da senha: a senha de app do Gmail é exibida com espaços, mas é enviada sem eles.");
  }

  const fromEntry = pick(env, "from");
  let from = fromEntry?.value;
  if (fromEntry) note("from", fromEntry.source);
  if (!from && userEntry) {
    from = userEntry.value;
    sources.from = `${userEntry.source} (remetente = conta autenticada)`;
  }
  if (from && !from.includes("@")) warnings.push("MAIL_FROM não parece um endereço de e-mail.");

  const fromNameEntry = pick(env, "fromName");
  const fromName = fromNameEntry?.value;
  if (fromNameEntry) note("fromName", fromNameEntry.source);

  const replyToEntry = pick(env, "replyTo");
  const replyTo = replyToEntry?.value;
  if (replyToEntry) note("replyTo", replyToEntry.source);

  const missing: string[] = [];
  if (!host) missing.push("MAIL_HOST");
  if (!from) missing.push("MAIL_FROM");
  // A user without a password (or the reverse) cannot authenticate: treating that as "configured"
  // would only move the failure to the handshake, after someone trusted the status endpoint.
  if (userEntry && !password) missing.push("MAIL_PASSWORD");
  if (!userEntry && password) missing.push("MAIL_USER");
  if (service === "gmail" && !userEntry) missing.push("MAIL_USER");
  // Gmail and Zoho both send as the authenticated mailbox: a different From is rewritten or
  // refused, so the address the customer sees would not be the one configured.
  if ((service === "gmail" || service === "zoho") && from && userEntry && from.toLowerCase() !== userEntry.value.toLowerCase()) {
    warnings.push(
      `No ${service === "gmail" ? "Gmail" : "Zoho"} o remetente é reescrito (ou recusado) quando difere da conta autenticada: use MAIL_FROM igual a MAIL_USER, ou verifique o domínio/alias no provedor.`,
    );
  }

  // Present but empty is a different problem from absent, and it has a different fix. A blank
  // variable for a field that is already resolved (a provider preset, for instance) is noise.
  const resolvedFields = new Set(Object.keys(sources) as MailField[]);
  const blank = Object.values(FIELD_ALIASES)
    .flat()
    .filter((name, index, all) => all.indexOf(name) === index)
    .filter((name) => env[name] !== undefined && !String(env[name]).trim())
    .filter((name) =>
      !Object.entries(FIELD_ALIASES).some(
        ([field, names]) => resolvedFields.has(field as MailField) && names.includes(name),
      ),
    );

  const authIncomplete = (Boolean(userEntry) && !password) || (!userEntry && Boolean(password));
  const deliverable = Boolean(host && from) && !authIncomplete && requested !== "log";
  return {
    mode: deliverable ? "smtp" : "log",
    service,
    host,
    port: port as number,
    secure,
    user: userEntry?.value,
    password,
    from,
    fromName,
    replyTo,
    sources,
    missing: deliverable ? [] : [...new Set(missing)],
    blank,
    placeholders,
    warnings,
  };
}

/** Human-readable reason shown by the status endpoint when delivery is not possible. */
export function mailProblem(settings: MailSettings): string {
  if (settings.mode === "off") return "Envio de e-mail desativado neste ambiente (MAIL_TRANSPORT=off).";
  if (settings.mode === "smtp") return "SMTP configurado. Use POST /api/mail/verify para confirmar a conexão.";
  if (settings.placeholders.length > 0) {
    return `SMTP incompleto: ${settings.placeholders.join(", ")} ainda contém o texto de exemplo da documentação. Substitua pelo valor real.`;
  }
  if (settings.missing.length > 0) {
    const blank = settings.blank.length > 0
      ? ` Atenção: ${settings.blank.join(", ")} existe(m) no ambiente mas vazio(s) — confira se foram definidas no escopo lido pelo docker-compose.`
      : "";
    return `SMTP incompleto: defina ${settings.missing.join(", ")}. Enquanto isso, e-mails são apenas registrados no log e reportados como não entregues.${blank}`;
  }
  if (settings.placeholders.length > 0) {
    return `SMTP incompleto: ${settings.placeholders.join(", ")} ainda contém o texto de exemplo da documentação. Substitua pelo valor real.`;
  }
  return "Transporte de log ativo (MAIL_TRANSPORT=log): e-mails são registrados e reportados como não entregues.";
}
