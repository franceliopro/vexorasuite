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

### Configuração explícita (a que está no Dokploy)

As sete variáveis, com o valor **exato** no campo — sem o comentário que vem junto no exemplo:

```
MAIL_HOST=smtp.gmail.com
MAIL_PORT=465
MAIL_SECURE=true
MAIL_USER=<a conta Gmail que envia>
MAIL_PASSWORD=<senha de app de 16 caracteres>
MAIL_FROM=<a mesma conta Gmail>
MAIL_FROM_NAME=Vexora Suite
```

> **O ponto que mais falha:** com `MAIL_HOST=smtp.gmail.com`, o `MAIL_FROM` **precisa ser igual ao
> `MAIL_USER`**. Um endereço de domínio próprio (`nao-responda@vexorasuite.com.br`) só é aceito se ele
> estiver verificado como alias; fora disso o Gmail recusa com `550`. O sistema detecta essa divergência
> e avisa no status, no log de boot e no `mail-check`.

Se o remetente precisa ter a marca (`nao-responda@vexorasuite.com.br`), há dois caminhos — nenhum é
configurável por variável de ambiente:

1. **Gmail → Configurações → Contas → “Enviar e-mail como”**: adicionar o endereço, confirmar o código e
   mantê-lo como alias da conta. A partir daí o Gmail aceita `MAIL_FROM` com esse endereço.
2. **Google Workspace**: criar o endereço como alias do usuário (ou grupo) no domínio `vexorasuite.com.br`
   e autenticar com essa conta.

Sem um dos dois, o envio funciona **com `MAIL_FROM` = a conta Gmail**; com o endereço de domínio próprio,
o Gmail responde `550`.

Requisitos do Gmail, que não são configuráveis por código:

1. **Verificação em duas etapas ativa** na conta.
2. **Senha de app** criada em <https://myaccount.google.com/apppasswords> — a senha normal da conta
   é recusada com `535-5.7.8`.
3. Envio para no máximo ~500 destinatários/dia em conta gratuita (Workspace tem cota maior).

## Zoho (alternativa)

Se o provedor for Zoho, as mesmas sete variáveis trocando o host:

```
MAIL_HOST=smtp.zoho.com
MAIL_PORT=465
MAIL_SECURE=true
MAIL_USER=nao-responda@vexorasuite.com.br
MAIL_PASSWORD=<senha de app gerada no Zoho>
MAIL_FROM=nao-responda@vexorasuite.com.br
MAIL_FROM_NAME=Vexora Suite
```

Ou `MAIL_SERVICE=zoho` + `MAIL_USER` + `MAIL_PASSWORD` (host, porta e TLS vêm do preset).

Requisitos do lado do Zoho:

1. **SMTP habilitado** na conta (Zoho Mail → Configurações → E-mail → IMAP/SMTP).
2. Com 2FA ativo, **senha de app** (`mail.zoho.com` → Segurança → Senhas de app).
3. `nao-responda@vexorasuite.com.br` precisa existir no Zoho — usuário, alias do domínio ou domínio
   verificado. Endereço inexistente é recusado com `553`/`550`.
4. Publicar **SPF**, **DKIM** e **DMARC** no DNS, senão a mensagem é aceita e cai em spam.

## Erros traduzidos em ação

O sistema nunca devolve só o texto cru do provedor. Cada falha conhecida vem com a correção:

| Resposta do servidor | O que o diagnóstico diz |
|---|---|
| `535 Authentication Failed` / `Invalid login` | Gmail: 2FA ativo + **senha de app** de 16 caracteres (a senha da conta é recusada). Zoho: habilitar SMTP e usar senha de app |
| `550` / `553` / `5.7.1` / `relaying denied` | Gmail: `MAIL_FROM` precisa ser **igual** a `MAIL_USER` (ou alias verificado no Workspace). Zoho: o endereço precisa existir como usuário/alias |
| `ETIMEDOUT` / `ECONNREFUSED` | liberar saída nas portas 465 (TLS) ou 587 (STARTTLS) |
| erro de `certificate` / `ssl` | `MAIL_SECURE=true` na 465, `false`/vazio na 587 |
| `quota` / `limit exceeded` | cota do provedor (~500/dia no Gmail gratuito) |

Esses textos aparecem em `POST /api/mail/verify`, em `POST /api/mail/test` e no `mail-check`.

## Armadilhas de colagem (tratadas em código)

| O que costuma acontecer | O que o sistema faz agora |
|---|---|
| colar a linha com comentário: `smtp.gmail.com   # host` | descarta o comentário e usa só o endereço |
| colar `<senha de app>` em vez da senha | trata como **não configurada**, avisa e não tenta autenticar |
| escrever `smtp.gmail.com:465` no host | separa host e porta |
| escrever `smtp://smtp.gmail.com/` | normaliza e avisa |
| `MAIL_FROM` diferente de `MAIL_USER` | avisa que o Gmail/Zoho envia como a conta autenticada |
| `MAIL_SECURE=false` na 465 | avisa que essa porta espera TLS implícito |

## Confirmação pelo log do deploy

No boot, a API registra **uma linha** com o transporte efetivo — é a primeira evidência de que o
ambiente chegou ao processo, sem precisar de shell nem login:

```
[MailService] E-mail: SMTP smtp.zoho.com:465 (TLS) como na**********@vexorasuite.com.br — remetente nao-responda@vexorasuite.com.br.
```

Sem configuração a linha é explícita (`E-mail: somente log (nada é enviado) — SMTP incompleto: defina ...`),
e cada aviso de normalização aparece como `WARN` logo abaixo. Senha nunca aparece.

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
