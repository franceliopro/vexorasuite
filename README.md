# Véxora Suite

Plataforma SaaS modular e multiempresa, reconstruída em repositório e implantação separados da Véxora Matriz.

## Objetivos da primeira fase

1. Estabelecer fundação segura, testável e reproduzível.
2. Implementar a experiência web/PWA e API com contratos explícitos.
3. Validar isolamento multi-tenant, autenticação, auditoria e observabilidade.
4. Entregar primeiro o fluxo operacional da Rastreabem, incluindo WhatsApp e atendimento em tempo real.
5. Expandir depois por módulos reutilizáveis (Escola, Clínica e outros segmentos).

## Arquitetura inicial

- Monorepo TypeScript.
- Web: Next.js + React.
- API: NestJS, modular monolith e OpenAPI.
- Banco: PostgreSQL + Drizzle ORM.
- Jobs: Redis + BullMQ, em worker separado.
- Realtime: WebSocket, persistência antes da publicação e recuperação após reconexão.
- Integrações: adapters por provedor; WAHA inicialmente para WhatsApp.
- Infraestrutura: Docker, CI, backups e observabilidade.

## Princípios de segurança e operação

- A Véxora Matriz e seu repositório/ambiente permanecem intactos.
- Nenhum segredo no frontend ou no Git; usar variáveis e secrets do ambiente.
- Toda operação de negócio deve verificar tenant, usuário e permissões no backend.
- Isolamento de dados por tenant, com testes de acesso cruzado.
- Integrações e eventos devem ser idempotentes, auditáveis e resilientes a retries.
- Não migrar o domínio oficial da Rastreabem antes da validação e autorização explícita.
- Alterações de produção devem passar por revisão e aprovação.

## Desenvolvimento

Consulte `docs/architecture.md` e `docs/roadmap.md`. Os primeiros commits estabelecem a base; a aplicação funcional será entregue em etapas pequenas e verificáveis.
