/**
 * Turns an SMTP failure into the concrete next step.
 *
 * `535 Authentication Failed` and `550 sender rejected` are the two responses a real deployment
 * hits, and neither says what to fix. The mapping below is provider-aware because the same code
 * means different things: Gmail refuses the account password and rejects a foreign sender, Zoho
 * rejects a sender that is not a user or alias of the domain.
 */
export function explainSmtpError(detail: string | undefined): string | undefined {
  const text = (detail || "").toLowerCase();
  if (!text) return undefined;

  if (/535|invalid login|authentication failed|eauth|username and password not accepted/.test(text)) {
    return (
      "O servidor recusou o login. No Gmail: ative a verificação em duas etapas e use uma senha de app de 16 caracteres — a senha normal da conta é recusada. " +
      "No Zoho: habilite SMTP na conta e use senha de app quando houver 2FA."
    );
  }
  if (/550|553|5\.7\.1|from address|not owned|relaying denied|sender rejected/.test(text)) {
    return (
      "O servidor recusou o remetente. No Gmail, MAIL_FROM precisa ser igual a MAIL_USER (ou um alias verificado no Google Workspace); enviar como outro domínio é rejeitado. " +
      "No Zoho, o endereço precisa existir como usuário ou alias do domínio."
    );
  }
  if (/etimedout|etimeout|econnection|econnrefused|enetunreach|connection timeout|socket close/.test(text)) {
    return "Não foi possível abrir a conexão. Libere saída nas portas 465 (TLS) ou 587 (STARTTLS) no firewall do servidor.";
  }
  if (/certificate|self.signed|wrong version number|ssl|tls/.test(text)) {
    return "Falha de TLS: use MAIL_SECURE=true na porta 465 e MAIL_SECURE=false (ou vazio) na 587.";
  }
  if (/daily|quota|limit exceeded|too many/.test(text)) {
    return "Cota do provedor atingida. Conta Gmail gratuita envia ~500 mensagens/dia; considere um domínio próprio com SES/Resend.";
  }
  return undefined;
}
