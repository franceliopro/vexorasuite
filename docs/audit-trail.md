# Trilha de auditoria

## Duas camadas

1. **Auditoria semântica** — as operações mais sensíveis gravam a própria entrada, com ação nomeada
e detalhe do negócio (`team.access.updated`, `conversation.assigned`...). Eram **24 chamadas em
12 controllers** antes desta mudança; continuam como estão, agora marcadas com `@AuditCovered()`.
2. **Auditoria de requisição** — `AuditInterceptor` registra **toda** requisição que muda estado
(POST/PATCH/PUT/DELETE) que não esteja em um controller marcado com `@AuditCovered()`.

Sem essa segunda camada, 225 das 249 rotas gravavam alteração sem nenhum registro de quem fez.

## O que é gravado

| Campo | Conteúdo |
|---|---|
| `tenantId` / `userId` | empresa e usuário autenticados (obrigatórios; sem eles não há registro) |
| `action` | `api.post`, `api.patch`, `api.put`, `api.delete` |
| `entityType` | primeiro segmento da rota (`contacts`, `conversations`, `finance`...) |
| `entityId` | `:id` da rota, quando é UUID |
| `details` | `method`, `route` (padrão com `:id`, não a URL crua), `status`, `durationMs`, `error` em falha |

**O corpo da requisição nunca é gravado.** Ele carrega senha, conteúdo de conversa e dado pessoal.
Um teste garante que senha, e-mail e mensagem não aparecem em `details`.

## Garantias

- A escrita é assíncrona: não atrasa nem falha a resposta. Se o banco recusar, fica um `warn` no log.
- Falha de negócio (4xx/5xx) também é registrada, com o status e a mensagem — tentativa negada é
evidência, não ruído.
- `GET`/`HEAD` não geram registro: em um inbox movimentado, isso significaria uma linha por poll de SSE.
- Requisições anônimas (login, cadastro) ficam fora, porque não há empresa a que associar.

## Retenção

A tabela `audit_logs` **não** tem expiração automática, e isso é intencional: retenção de auditoria é
decisão de política (e de LGPD), não de código. Índices existentes: `(tenantId, createdAt)` para
extrato por período e `(tenantId, entityType, entityId)` para histórico de um registro.

## Consulta

```sql
-- o que o usuário fez na última semana
SELECT created_at, action, entity_type, entity_id, details
FROM audit_logs
WHERE tenant_id = $1 AND user_id = $2 AND created_at > now() - interval '7 days'
ORDER BY created_at DESC;
```
