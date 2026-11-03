# Rate limiting

## O que existe

Um interceptor global (`RateLimitInterceptor`) conta **todas** as requisições da API. A chave é o
usuário autenticado (`user:<id>`) e, para chamadas anônimas, o IP do cliente. Endpoints de
credencial são sempre contados por IP, porque ainda não existe usuário.

| Balde | Rotas | Padrão | Variável |
|---|---|---|---|
| `auth` | `POST /auth/login`, `/auth/register`, `/auth/change-password` | 10/min por IP | `RATE_LIMIT_AUTH_PER_MIN` |
| `auth-aux` | demais `/auth/*` | 60/min | `RATE_LIMIT_AUTH_AUX_PER_MIN` |
| `read` | GET/HEAD | 900/min por usuário | `RATE_LIMIT_READ_PER_MIN` |
| `write` | POST/PATCH/PUT/DELETE | 240/min por usuário | `RATE_LIMIT_WRITE_PER_MIN` |

Cada balde tem janela fixa de 60 s. Ao estourar, a API responde **429** com mensagem em português,
`Retry-After` e `X-RateLimit-Limit`/`X-RateLimit-Remaining`.

## Onde o contador vive

- **Com `REDIS_URL`** (já presente no Compose): contador compartilhado, correto com várias réplicas.
  A janela é criada uma vez (`PEXPIRE ... NX`) e não é estendida a cada requisição.
- **Sem `REDIS_URL`, ou se o Redis não responder**: contador local do processo, com aviso no log.
  Nesse modo o limite vale por réplica, não globalmente.
- `RATE_LIMIT_ENABLED=false` desliga tudo (a suíte de testes já roda com o limitador desligado).

## IP real atrás do proxy

`main.ts` define `trust proxy` (`TRUST_PROXY`, padrão `1` em produção) para ler `X-Forwarded-For`.
Sem isso todo mundo cairia no mesmo balde, o do IP do Traefik/Dokploy. Se a API for exposta
diretamente, use `TRUST_PROXY=0`.

## Por que não `@nestjs/throttler`

O comportamento precisava ser: por usuário depois da autenticação, por IP antes dela, com
contador compartilhado e degradação previsível. São ~150 linhas com testes, sem dependência
extra além do cliente Redis que o rate limit já usa.

## Upload

Requisições `multipart/form-data` têm balde próprio (`RATE_LIMIT_UPLOAD_PER_MIN`, padrão 60/min por
usuário), porque cada envio é caro e não deve consumir a cota de escrita comum.
