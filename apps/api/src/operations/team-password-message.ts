import { PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH, PASSWORD_SYMBOLS } from "../auth/password-policy";
import type { MailMessage } from "../mail/mail.types";

const appUrl = "https://app.vexorasuite.com.br";
function escapeHtml(value: string) {
  const entities: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
  return value.replace(/[&<>"']/g, character => entities[character]!);
}

export function teamPasswordMessage(input: {
  name: string; email: string; company: string; password: string; reason: "create" | "reset";
}): MailMessage {
  const title = input.reason === "create" ? "Seu acesso à Véxora Suite" : "Sua nova senha temporária";
  const intro = input.reason === "create"
    ? "Seu acesso está pronto. Use os dados abaixo para entrar na Véxora Suite."
    : "Sua senha foi redefinida. Use os dados abaixo para entrar na Véxora Suite.";
  const greeting = "Olá, " + input.name + "!";
  const instruction = "Ao entrar, você deverá trocar a senha temporária por uma senha de sua escolha.";
  const rules = [
    "Use de " + PASSWORD_MIN_LENGTH + " a " + PASSWORD_MAX_LENGTH + " caracteres.",
    "Inclua uma letra maiúscula, uma minúscula e um número.",
    "Inclua pelo menos um destes símbolos: " + PASSWORD_SYMBOLS,
  ];
  const fields = [
    ["Identificador da empresa", input.company],
    ["Login (e-mail)", input.email],
    ["Senha temporária", input.password],
  ];
  const text = [greeting, "", intro, "", "Acesse: " + appUrl,
    ...fields.map(([label, value]) => label + ": " + value), "",
    instruction, ...rules.map(rule => "- " + rule), "", "Equipe Véxora Suite"].join("\n");
  const html = `<!doctype html>
<html lang="pt-BR"><body style="margin:0;background:#f1f4f8;color:#16243a;font-family:Arial,sans-serif">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:20px 12px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#fff;border:1px solid #e0e7ef;border-radius:16px">
<tr><td style="padding:28px">
<p style="margin:0 0 12px;color:#2456a7;font-size:15px;font-weight:bold">Véxora Suite</p>
<h1 style="margin:0 0 18px;font-size:25px;line-height:1.2">${title}</h1>
<p style="margin:0 0 8px;font-weight:bold">${escapeHtml(greeting)}</p>
<p style="margin:0 0 18px;line-height:1.5">${intro}</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#eef4fb;border-radius:10px">
${fields.map(([label, value]) => `<tr><td style="padding:10px 14px"><strong style="display:block;font-size:13px;margin-bottom:4px">${label}</strong><span style="word-break:break-word">${escapeHtml(value!)}</span></td></tr>`).join("")}
</table>
<p style="margin:22px 0"><a href="${appUrl}" style="display:inline-block;padding:12px 16px;background:#204f9c;color:#fff;text-decoration:none;border-radius:8px;font-weight:bold">Acessar a Véxora Suite</a></p>
<h2 style="margin:0 0 8px;font-size:17px">Como escolher a nova senha</h2>
<p style="margin:0;line-height:1.5">${instruction}</p>
<ul style="margin:8px 0 20px;padding-left:20px;line-height:1.5">${rules.map(rule => "<li>" + escapeHtml(rule) + "</li>").join("")}</ul>
<p style="margin:0;color:#52627a">Equipe Véxora Suite</p>
</td></tr></table></td></tr></table></body></html>`;
  return { to: input.email, subject: title, text, html };
}
