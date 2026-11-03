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
| `MAIL_TRANSPORT` | `smtp` · `log` · `off` | vazio = automático |
| `MAIL_SERVICE` | `gmail` · `zoho` · `titan` · `outlook` | preenche host, porta e TLS do provedor |
| `MAIL_HOST` | `smtp.gmail.com` | vazio = envio desligado |
| `MAIL_PORT` | `587` (STARTTLS) · `465` (TLS) | vazio = porta do preset |
| `MAIL_SECURE` | `true` no 465 | se vazio, derivado de `MAIL_PORT` |
| `MAIL_USER` | `vexorasuite@gmail.com` | conta autenticada |
| `MAIL_PASSWORD` | senha de app | somente no Dokploy |
| `MAIL_FROM` | igual a `MAIL_USER` | vazio = usa `MAIL_USER` |
| `MAIL_FROM_NAME` | `Vexora Suite` | nome exibido |
| `MAIL_REPLY_TO` | `suporte@vexorasuite.com.br` | opcional |

### Nomes alternativos aceitos

Uma variável criada com outro nome **não deixa mais o envio desligado em silêncio**. Estes nomes são
lidos como fallback, e `/api/mail/status` informa de qual deles veio cada valor:

| Campo | Nomes aceitos |
|---|---|
| host | `MAIL_HOST`, `SMTP_HOST`, `MAIL_SMTP_HOST` |
| porta | `MAIL_PORT`, `SMTP_PORT` |
| TLS | `MAIL_SECURE`, `SMTP_SECURE` |
| usuário | `MAIL_USER`, `SMTP_USER`, `MAIL_USERNAME`, `SMTP_USERNAME`, `GMAIL_USER` |
| senha | `MAIL_PASSWORD`, `SMTP_PASSWORD`, `MAIL_PASS`, `SMTP_PASS`, `MAIL_APP_PASSWORD`, `GMAIL_PASSWORD`, `GMAIL_APP_PASSWORD` |
| remetente | `MAIL_FROM`, `SMTP_FROM`, `MAIL_FROM_ADDRESS`, `MAIL_SENDER` |
| modo | `MAIL_TRANSPORT`, `MAIL_MODE` |

O nome canônico continua sendo o preferido: quando o valor vem de um alias, o status devolve um aviso
pedindo a troca.

## Gmail

Só duas variáveis são necessárias — o resto é deduzido:

```
MAIL_USER=vexorasuite@gmail.com
MAIL_PASSWORD=<senha de app de 16 caracteres>
```

Com isso o sistema já usa `smtp.gmail.com`, porta `465`, TLS implícito e remetente igual à conta
autenticada (o Gmail reescreve o *From* para a conta autenticada, então um remetente diferente se
perde). A senha de app é exibida pelo Google como `abcd efgh ijkl mnop`; **os espaços são removidos
automaticamente** e um aviso é emitido.

Requisitos do Gmail, que não são configuráveis por código:

1. **Verificação em duas etapas ativa** na conta.
2. **Senha de app** criada em <https://myaccount.google.com/apppasswords> — a senha normal da conta
   é recusada com `535-5.7.8`.
3. Envio para no máximo ~500 destinatários/dia em conta gratuita (Workspace tem cota maior).

## Onde definir as variáveis (Dokploy)

O `docker-compose.yml` declara `MAIL_*` no serviço `api` com interpolação (`${MAIL_HOST:-}`). Isso
significa que os valores precisam existir **no escopo que o compose lê**, não apenas dentro do
container. Se a variável for criada apenas na aba *Environment* isolada do serviço, o compose
interpola vazio e o container recebe string vazia — o envio fica em log sem erro visível.

Como detectar: `node dist/mail/mail-check.cli.js` mostra a linha
`vazias no ambiente: MAIL_HOST` quando a variável existe mas está vazia, e nada nessa linha quando
ela simplesmente não foi definida. A correção é definir as variáveis no nível do projeto/compose
(as mesmas que o `docker-compose.yml` referencia) e reiniciar o serviço.

## Verificação no servidor

O endpoint exige login de administração da plataforma; este comando usa o mesmo ambiente do processo:

```bash
# dentro do container da api
node dist/mail/mail-check.cli.js              # configuração resolvida + handshake SMTP real
node dist/mail/mail-check.cli.js --to voce@dominio.com   # envia uma mensagem de verdade
node dist/mail/mail-check.cli.js --json       # saída para script
```

Códigos de saída: `0` ok · `2` configuração incompleta · `3` handshake falhou · `4` envio recusado.

### Erros comuns

| Mensagem | Causa | Correção |
|---|---|---|
| `535-5.7.8 Username and Password not accepted` | senha da conta em vez de senha de app, 2FA desligado, ou senha revogada | criar nova senha de app |
| `550 From address not owned by user` (Gmail) | `MAIL_FROM` diferente de `MAIL_USER` | usar o mesmo endereço |
| `ETIMEDOUT` / `ECONNREFUSED` na 465 | saída de rede bloqueada, proxy ou porta fechada no host | liberar saída ou usar 587/STARTTLS |
| `422`/`400` ao enviar para muitos destinatários | cota diária do provedor | usar domínio próprio com SES/Resend |
| mensagem aceita mas cai em spam | falta `SPF`, `DKIM` e `DMARC` no DNS | publicar os três registros |


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
