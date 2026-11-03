# Arquitetura da Véxora Suite

## Decisão principal

Monólito modular com monorepo TypeScript. O código compartilhado reduz divergência entre produtos; cada implantação pode ter banco, segredos, domínio e ciclo de publicação próprios quando o isolamento operacional justificar.

## Aplicações

- `apps/web`: Next.js para a interface web responsiva e futura PWA.
- `apps/api`: NestJS como API HTTP, com contrato OpenAPI.
- `apps/api` também gera dois processos operacionais dedicados: `webhook-worker` e `scheduler-worker`.
- `webhook-worker`: entrega webhooks persistidos, com tentativas e isolamento da API HTTP.
- `scheduler-worker`: triagem de áudio, cadências, saúde de canais e reconciliação Asaas, fora do processo HTTP.
- O código compartilhado permanece dentro do monólito modular até existir uma necessidade comprovada de extrair pacotes.

## Dados e multi-tenancy

- PostgreSQL é a fonte de verdade.
- Entidades de negócio devem carregar tenant_id e constraints/índices compostos quando aplicável.
- O tenant é resolvido no servidor a partir de uma identidade/autorização confiável; nunca confiar em tenant_id fornecido livremente pelo cliente.
- Toda consulta e mutação de negócio exige tenant scope e autorização.
- Avaliar Row-Level Security como defesa adicional após definir o modelo de conexão/transação. O papel de runtime não pode ter bypass de RLS.
- Testes negativos devem comprovar que um tenant não consegue ler ou alterar dados de outro tenant.

## Eventos, tempo real e jobs

- Persistir a mensagem/evento antes de publicar notificações.
- Eventos de tempo real e entregas externas são persistidos antes do processamento.
- Mensagens recebidas de provedores são idempotentes por identificador externo + canal/tenant.
- WebSocket entrega atualizações; reconexão recupera eventos perdidos via cursor/sync da API.
- O trabalho periódico roda exclusivamente no `scheduler-worker` em produção, protegido por leases no PostgreSQL.
- Redis é usado para limites distribuídos e cache operacional; não é fonte de verdade de negócio.

## WhatsApp

- Integrar por uma interface de provider, começando com WAHA.
- Credenciais WAHA apenas no servidor/secret store; nunca expostas ao browser.
- Validar a relação tenant -> canal -> sessão em cada webhook e ação de envio.
- Verificar assinatura/autenticidade, deduplicar eventos, limitar retries e registrar falhas sem guardar segredos nos logs.
- Não reutilizar ou migrar sessões do ambiente atual sem plano e autorização.

## Segurança e operação

- Autenticação e autorização server-side, proteção CSRF conforme mecanismo de sessão, rate limits e validação de entrada.
- Segredos exclusivamente em variáveis protegidas ou secret manager.
- Logs estruturados com request/correlation ID; nunca registrar tokens, chaves ou conteúdo sensível desnecessário.
- Backups e teste periódico de restauração fazem parte da operação do ambiente, não do deploy da aplicação.
- CI com lint, typecheck, testes e build.
- Migrações de banco versionadas e revisadas.
- Mudanças em produção apenas após validação e aprovação explícita.

## Ambientes

- Desenvolvimento local.
- Staging inicial: `app.vexorasuite.com.br`, isolado da Véxora Matriz.
- Domínio oficial da Rastreabem só será alterado depois dos testes de aceite e autorização.
