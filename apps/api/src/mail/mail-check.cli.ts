/**
 * Mail diagnostics for the deployed container.
 *
 * The API endpoint needs a platform login and a browser; this runs with the same environment the
 * process uses, which is what actually matters when a variable name or a provider rule is wrong.
 *
 *   node dist/mail/mail-check.cli.js               # resolved configuration + real SMTP handshake
 *   node dist/mail/mail-check.cli.js --to a@b.com  # also sends a real test message
 *   node dist/mail/mail-check.cli.js --json        # machine-readable output
 *
 * Exit codes: 0 ok · 2 configuration incomplete · 3 handshake failed · 4 delivery failed.
 */
import { mailProblem, maskAddress, resolveMailSettings } from "./mail.config";
import { renderEmail } from "./mail.template";
import { SmtpMailTransport } from "./transports/smtp.transport";

interface Options {
  to?: string;
  json: boolean;
  help: boolean;
}

function parse(argv: string[]): Options {
  const options: Options = { json: false, help: false };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index] ?? "";
    if (argument === "--json") options.json = true;
    else if (argument === "--help" || argument === "-h") options.help = true;
    else if (argument === "--to") options.to = argv[index + 1];
    else if (argument.startsWith("--to=")) options.to = argument.slice("--to=".length);
  }
  return options;
}

const USAGE = `Uso: node dist/mail/mail-check.cli.js [--to endereco@dominio.com] [--json]

Lê as variáveis MAIL_* do ambiente do processo, mostra de qual variável veio cada valor,
abre uma conexão SMTP real e, com --to, envia uma mensagem de teste.`;

async function main(): Promise<number> {
  const options = parse(process.argv.slice(2));
  if (options.help) {
    console.log(USAGE);
    return 0;
  }

  const settings = resolveMailSettings();
  const summary = {
    mode: settings.mode,
    service: settings.service,
    host: settings.host,
    port: settings.port,
    secure: settings.secure,
    from: settings.from,
    user: maskAddress(settings.user),
    password: settings.password ? "definida" : undefined,
    fromName: settings.fromName,
    replyTo: settings.replyTo,
    sources: settings.sources,
    missing: settings.missing,
    blank: settings.blank,
    warnings: settings.warnings,
    note: mailProblem(settings),
  };

  if (!options.json) {
    console.log("Configuração de e-mail resolvida do ambiente:\n");
    for (const [field, value] of Object.entries(summary)) {
      if (field === "sources" || field === "missing" || field === "blank" || field === "warnings" || field === "note") continue;
      if (value === undefined) continue;
      const source = (settings.sources as Record<string, string>)[field];
      console.log(`  ${field.padEnd(10)} ${String(value)}${source ? `   (de ${source})` : ""}`);
    }
    for (const warning of settings.warnings) console.log(`  aviso: ${warning}`);
    if (settings.blank.length > 0) console.log(`  vazias no ambiente: ${settings.blank.join(", ")}`);
    if (settings.missing.length > 0) console.log(`  faltando: ${settings.missing.join(", ")}`);
    console.log(`\n  ${summary.note}\n`);
  }

  if (settings.mode !== "smtp") {
    if (options.json) console.log(JSON.stringify({ ...summary, verified: false, sent: null }, null, 2));
    return 2;
  }

  const transport = new SmtpMailTransport({
    service: settings.service,
    host: settings.host!,
    port: settings.port,
    secure: settings.secure,
    user: settings.user,
    password: settings.password,
    from: settings.from!,
    fromName: settings.fromName,
    replyTo: settings.replyTo,
  });

  let code = 0;
  try {
    const handshake = await transport.verify?.();
    if (!options.json) {
      console.log(handshake?.ok ? "Conexão SMTP: OK (login aceito pelo servidor)." : "Conexão SMTP: FALHOU.");
    }
    if (!handshake?.ok) {
      if (!options.json) console.log(`  motivo: ${handshake?.detail ?? "não informado"}`);
      code = 3;
    }

    let sent: unknown = null;
    if (options.to) {
      const { html, text } = renderEmail({
        title: "Teste do transporte de e-mail",
        intro: "Mensagem enviada pelo mail-check da Véxora Suite.",
        footnote: "Se você recebeu isto, o SMTP está entregando com sucesso.",
      });
      const result = await transport.send({
        to: options.to,
        subject: "Véxora Suite — teste de envio",
        text,
        html,
      });
      sent = result;
      if (!options.json) {
        console.log(
          result.delivered
            ? `Envio aceito pelo servidor para ${result.accepted?.join(", ") ?? options.to} (id ${result.providerId ?? "n/d"}).`
            : `Envio NÃO aceito: ${result.reason ?? "motivo não informado"}.`,
        );
      }
      if (!result.delivered) code = 4;
    }

    if (options.json) {
      console.log(JSON.stringify({ ...summary, verified: handshake?.ok === true, handshake, sent }, null, 2));
    }
    return code;
  } finally {
    transport.close();
  }
}

if (require.main === module) {
  main()
    .then((code) => process.exit(code))
    .catch((error: unknown) => {
      console.error(`Falha inesperada: ${error instanceof Error ? error.message : String(error)}`);
      process.exit(1);
    });
}
