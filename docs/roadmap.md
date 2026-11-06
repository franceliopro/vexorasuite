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
- [~] Fluxo WhatsApp -> resposta -> transferência humana -> encerramento; fallback por departamento da inbox implementado, pendente aceite real no Dokploy.
- [x] Compositor de áudio: gravação real pelo microfone, envio como mídia WAHA e leitura com waveform/progresso no histórico.

## Fase 3 — automações e operação
- [ ] Motor de automação com estados explícitos e cancelamento.
- [ ] IA opcional, com ativação/desativação respeitada no servidor.
- [ ] Painéis separados para Suporte, Comercial e Financeiro.
- [ ] Auditoria visível das ações financeiras enviadas ao cliente.

## Fase 4 — produtos reutilizáveis
- [ ] Modelos de produto e provisionamento por configuração.
- [ ] PWA instalável com UX adaptada por produto/tenant.
- [ ] Módulos Escola, Clínica e demais segmentos conforme prioridade.

## Fase 5 — experiência premium e plataforma vertical
- [ ] Consolidar tokens de design Véxora para tema escuro, híbrido e claro.
- [ ] Aplicar componentes premium reutilizáveis em Inbox, CRM, Kanban, Financeiro, Studio Visual e portais.
- [ ] Validar microinterações, cards expansíveis, estados de feedback, acessibilidade, responsividade e `prefers-reduced-motion`.
- [~] Paridade funcional do Inbox: datas, mídia ampliada, anexos, emoji, áudio, menu contextual e recibos implementados; thumbnails e confirmação com aparelho real ainda aguardam aceite.
- [ ] Registrar e validar o provisionamento por módulos, White Label, backups, restauração e migração entre servidores Dokploy.
- [ ] Implantar os modelos verticais Rastreabem e FAETER conforme os blueprints do produto.

O inventário detalhado, a direção de design premium, a FAETER e as integrações financeiras estão em [docs/product-blueprints-and-integrations.md](product-blueprints-and-integrations.md).

Para acompanhar o que já foi implementado, testado e aprovado, consulte o [painel de status de implementação](implementation-status.md). Este roadmap permanece como visão de fases e prioridades; o painel registra evidências e pendências de aceite.

## Critério de produção
Nenhum domínio oficial ou dado do sistema atual será migrado antes de testes de aceite, plano de rollback e autorização explícita.
