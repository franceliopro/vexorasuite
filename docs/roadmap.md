# Roadmap inicial

## Fase 0 — fundação
- [x] Criar repositório separado.
- [x] Registrar decisões arquiteturais e regras de segurança.
- [ ] Confirmar configuração de deploy e secrets no Dokploy.
- [ ] Instalar dependências e validar build na CI.
- [ ] Adicionar health checks e testes mínimos.

## Fase 1 — identidade e multi-tenant
- [ ] Configuração de banco e migrações versionadas.
- [ ] Organizações/tenants, membros, papéis e permissões.
- [ ] Autenticação segura e recuperação de sessão.
- [ ] Testes de isolamento entre tenants e trilha de auditoria.

## Fase 2 — atendimento Rastreabem
- [ ] Inbox e conversas persistidas.
- [ ] Integração WAHA por adapter.
- [ ] Webhooks autenticados, idempotência e logs de diagnóstico.
- [ ] Entrega em tempo real com recuperação após reconexão.
- [ ] Atribuição de atendente, status, etiquetas e histórico.
- [ ] Fluxo WhatsApp -> resposta -> transferência humana -> encerramento.

## Fase 3 — automações e operação
- [ ] Motor de automação com estados explícitos e cancelamento.
- [ ] IA opcional, com ativação/desativação respeitada no servidor.
- [ ] Painéis separados para Suporte, Comercial e Financeiro.
- [ ] Auditoria visível das ações financeiras enviadas ao cliente.

## Fase 4 — produtos reutilizáveis
- [ ] Modelos de produto e provisionamento por configuração.
- [ ] PWA instalável com UX adaptada por produto/tenant.
- [ ] Módulos Escola, Clínica e demais segmentos conforme prioridade.

## Critério de produção
Nenhum domínio oficial ou dado do sistema atual será migrado antes de testes de aceite, plano de rollback e autorização explícita.
