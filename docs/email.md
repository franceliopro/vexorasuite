# E-mail de saída

## Como funciona

Todo envio passa por `MailService` (`apps/api/src/mail`). O transporte é escolhido pelo ambiente,
uma vez por processo:

| Configuração | Transporte | Resultado de `send()` |
|---|---|---|
| `MAIL_HOST` + `MAIL_FROM` preenchidos | SMTP (nodemailer) | `delivered: true` **apenas** se o servidor aceitar o destinatário |
| `MAIL_TRANSPORT=log` | log | `delivered: false` — a mensagem vai para o log, nada é enviado |
| `MAIL_TRANSPORT=smtp` sem `MAIL_HOST`/`MAIL_FROM` | log + `warn` | `delivered: false` |
| `MAIL_TRANSPORT=off` | nenhum | `delivered: false` |

`delivered: true` significa que o **servidor SMTP aceitou a mensagem**. Não significa que ela chegou
à caixa de entrada: rejeição posterior (spam, caixa cheia, bounce) é do provedor. O sistema nunca
anuncia entrega a partir de uma flag de configuração.

## Variáveis

| Variável | Exemplo | Observação |
|---|---|---|
| `MAIL_HOST` | `smtp.zoho.com` | vazio = envio desligado |
| `MAIL_PORT` | `587` (STARTTLS) · `465` (TLS) | — |
| `MAIL_SECURE` | `true` no 465 | se vazio, derivado de `MAIL_PORT` |
| `MAIL_USER` | `nao-responda@vexorasuite.com.br` | — |
| `MAIL_PASSWORD` | senha de app | somente no Dokploy |
| `MAIL_FROM` | `nao-responda@vexorasuite.com.br` | precisa ser domínio verificado |
| `MAIL_FROM_NAME` | `Vexora Suite` | nome exibido |
| `MAIL_REPLY_TO` | `suporte@vexorasuite.com.br` | opcional |

## Provedores compatíveis

Todos por SMTP, sem SDK proprietário:

- **Zoho Mail** — `smtp.zoho.com`, 465/TLS, senha de app.
- **Titan** — `smtp.titan.email`, 465/TLS.
- **Amazon SES** — `email-smtp.<região>.amazonaws.com`, 587, credenciais SMTP do SES.
- **Resend / Postmark / Mailgun** — todos expõem endpoint SMTP.
- **Gmail Workspace** — `smtp.gmail.com`, 587, senha de app (exige 2FA).

## Antes de ligar em produção

1. Verificar o domínio no provedor e publicar **SPF**, **DKIM** e **DMARC** no DNS. Sem isso, o envio
   funciona e cai em spam.
2. `MAIL_FROM` precisa usar o domínio verificado — o provedor recusa o resto.
3. Configurar as variáveis no Dokploy (nunca no Git) e reiniciar o serviço `api`.

## Diagnóstico

Somente administração da plataforma (empresa cliente não vê isto):

```http
GET  /api/mail/status     # transporte atual, remetente, host
POST /api/mail/verify     # abre conexão SMTP de verdade (auth incluída)
POST /api/mail/test       # {"to":"voce@dominio.com"} envia uma mensagem real
```

`POST /api/mail/verify` é a única evidência de que a integração funciona: configuração sozinha não
prova conexão.

## Segurança

- Credenciais apenas por variável de ambiente; nunca aparecem em log, resposta ou auditoria.
- Todo texto interpolado no HTML é escapado (`escapeHtml`), então nome de empresa ou assunto vindo
do usuário não injeta markup.
- A mensagem sempre tem versão texto puro, para clientes que bloqueiam HTML.
