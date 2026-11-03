# Sessões: token curto, sessão longa

## Antes e depois

| | Antes | Agora |
|---|---|---|
| Token de acesso | 8 h, sem renovação | **30 min** (`AUTH_ACCESS_TTL_SECONDS`) |
| Renovação | nenhuma (novo login) | `POST /auth/refresh`, transparente no proxy |
| Sessão | morre quando o token expira | **30 dias** rolando (`AUTH_REFRESH_TTL_DAYS`) |
| Revogação | global (`authVersion`) | por dispositivo (família do refresh) **e** global |
| Logout na web | só apagava o cookie | revoga o refresh no servidor |

## Como funciona

1. Login/`switch` devolvem **dois** tokens: `accessToken` (minutos) e `refreshToken` (dias).
2. Na web, ambos viram cookies `httpOnly` (`vexora_session`, `vexora_refresh`). O JavaScript da página
   nunca os lê.
3. Quando a API responde **401** por token expirado, o proxy (`/api/backend/*`) troca o refresh,
   grava os cookies novos e **repete a requisição uma única vez**. O usuário não percebe.
4. Se a troca falhar, os dois cookies são apagados e a tela cai no login.

## Segurança

| Regra | Por quê |
|---|---|
| Só o **SHA-256** do refresh é guardado | vazamento do banco não permite reutilizar a sessão |
| Rotação a cada uso | cada refresh vale uma vez; o anterior é marcado como usado |
| **Reuso revoga a família inteira** | se um token já usado reaparece, duas partes têm o mesmo segredo |
| Token de acesso curto | um token vazado vale minutos, não horas |
| `sessionVersion` na linha | qualquer aumento de `authVersion` (logout, troca/reset de senha, reset administrativo) invalida todas as sessões sem precisar lembrar de limpar esta tabela |
| Tenancy relida a cada troca | usuário removido da empresa, conta desativada ou painel PLATFORM sem administrador Véxora não renovam |
| `userAgent` registrado | permite reconhecer de qual dispositivo veio a sessão |
| Logout por refresh token | funciona mesmo com o token de acesso já expirado, que é o caso comum |

## Endpoints

```http
POST /api/auth/login      → { accessToken, expiresIn, refreshToken, refreshExpiresIn, user, tenant, role }
POST /api/auth/refresh    → { refreshToken } → mesmo formato
POST /api/auth/logout     → { refreshToken? } → { ok: true }
```

`/auth/refresh` e `/auth/logout` são públicos **de propósito**: eles rodam justamente quando o token
de acesso não vale mais. A credencial é o próprio refresh token. Respostas nunca revelam se um token
existe (`logout` responde `{ ok: true }` sempre).

## Ajuste fino

```
AUTH_ACCESS_TTL_SECONDS=1800   # 5 min – 8 h
AUTH_REFRESH_TTL_DAYS=30       # 1 – 180 dias
```

Encurtar o acesso reduz a janela de abuso; alongar demais volta ao problema anterior. Abaixo de
5 minutos a renovação passa a acontecer durante o uso normal (e no SSE, que reconecta).

## O que fica fora da tabela

`refresh_tokens` cresce com logins e mortes de sessão. As linhas expiradas não são apagadas
automaticamente: exclusão é política de retenção, não default. O índice `(user_id, expires_at)`
mantém a limpeza barata quando ela for decidida. Um `DELETE ... WHERE expires_at < now() - interval
'90 days'` no `scheduler-worker` resolve.

## Testes

- `apps/api/src/auth/refresh-session.spec.ts` — hash em vez do token, rotação na mesma família, reuso,
  expiração, senha trocada, usuário desativado, corrida perdida.
- `apps/api/src/auth/session-refresh.spec.ts` — refresh devolvendo par novo, 401 em reuso/expiração,
  empresa revogada, painel PLATFORM, logout por refresh com acesso expirado.
- `apps/web/test/session-refresh.test.mjs` — cookies httpOnly, TTLs, decisão de renovar uma única vez.
