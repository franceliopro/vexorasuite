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

## Escopo consolidado — plataforma replicável e atendimento assistido
- [ ] Separar tarefas operacionais da empresa de procedimentos personalizados por contato.
- [ ] Finalizar o atendimento Bot/Agente → equipe ou atendente, preservando um pacote interno de contexto sem expor instruções ao cliente.
- [ ] Permitir atendimento por equipe, atendente individual e múltiplos canais WhatsApp, respeitando as limitações reais de sessão e identidade de cada número.
- [ ] Criar instalação guiada por empresa com seleção de módulos, domínios, integrações e branding.
- [ ] Criar Backup Center e Restore Wizard para plataforma, tenants, bancos, sites, arquivos e mídias.
- [ ] Criar Studio Visual assistido por IA para sites, landing pages, formulários, postagens, galerias e publicação por domínio.
- [ ] Manter o código no GitHub e o deploy no Dokploy; dados, segredos, backups e certificados permanecem fora do repositório.
- [ ] Suportar White Label com uma base de código, módulos habilitáveis e identidade visual isolada por empresa.


## Escopo de produtos e integrações registrado
- [ ] Integrar Stripe, Mercado Pago e InfinitePay por adaptadores financeiros com Sandbox/Produção, idempotência e webhooks.
- [ ] Criar catálogo de produtos e clientes reutilizável por tenant.
- [ ] Criar o produto FAETER Teologia com curso de 36 matérias, módulos com pré-requisitos, modalidades presencial/online, portal do aluno, cobrança InfinitePay, provas, reteste autorizado, notas, gráficos, PDF e WhatsApp.
- [ ] Usar `docs/product-blueprints-and-integrations.md` como blueprint compartilhado entre agentes e futuras instâncias.
