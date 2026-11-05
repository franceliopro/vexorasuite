# Véxora Suite — Status de implementação e aceite

Este arquivo é o painel de acompanhamento do produto. Ele separa código existente, testes executados, deployment observado e itens ainda não validados em produção.

## Legenda

- [x] **Implementado e validado:** há implementação e evidência de teste ou inspeção objetiva.
- [~] **Implementado, aguardando aceite real:** existe no código, mas ainda depende de teste no Dokploy, provedor ou conversa real.
- [ ] **Planejado:** está no escopo/blueprint, mas ainda não foi implementado ou não há evidência suficiente.
- **Evidência:** teste, arquivo, log ou commit que sustenta o status.

## Resumo atual

| Área | Status | Evidência principal |
|---|---|---|
| Build do Compose | [x] | Deployment do Dokploy concluiu com `Docker Compose Deployed: ✅` |
| Migration antes da API | [x] | Log mostrou PostgreSQL saudável, migration concluída e API saudável |
| Frontend | [x] | 100 testes do frontend e TypeScript passaram |
| Atendimento e Inbox | [x] | Testes de realtime, filas, datas, recibos e acessibilidade passaram |
| Chatbot/Flow Studio | [x] | Testes de canvas, clipping, opções e estados de carregamento passaram |
| Transbordo e Kanban | [x] | 14 testes críticos do backend passaram |
| Identidade de contatos | [x] | Testes para `@lid`, `@g.us`, `@broadcast` e número `@c.us` passaram |
| Atendimento real no Dokploy | [~] | Infraestrutura está saudável; falta conversa ponta a ponta real |
| Integrações oficiais e provedores reais | [~] | Adaptadores e contratos existem; credenciais/provedores ainda exigem validação individual |
| Verticais Rastreabem e FAETER | [ ] | Blueprint registrado; implantação ainda não iniciada |

### Correções encontradas nos logs de 05/11/2026

- [x] Proteção contra `ERR_HTTP_HEADERS_SENT` no `RateLimitInterceptor`.
- [x] Teste de regressão para respostas que já iniciaram o envio dos headers.
- [x] Remoção da consulta frontend obsoleta `marketing/prepared`, responsável por 404 repetitivos.
- [x] 14 testes do rate limit passaram após a correção.
- [x] 100 testes do frontend passaram após a correção.
- [x] Erro de build do Dokploy corrigido: `ContactProfileData.metadata` agora aceita `null`.
- [x] Normalização de telefone corrigida para números formatados e identificadores `@c.us`.
- [x] TypeScript passou após a correção do build.
- [~] Novo deployment no Dokploy ainda necessário para validar a correção no ambiente publicado.

## 1. Fundação e deploy

- [x] Branch oficial definido: `foundation/bootstrap-monorepo`.
- [x] Compose com `web`, `api`, `migration`, `webhook-worker`, `scheduler-worker`, PostgreSQL, Redis, WAHA e SearXNG.
- [x] Healthcheck da API com banco.
- [x] Healthcheck de liveness separado da prontidão.
- [x] Healthcheck de PostgreSQL e Redis.
- [x] Migration executada antes da API e dos workers.
- [x] `WEBHOOK_ENCRYPTION_KEY` exigida em produção.
- [x] `INTEGRATION_ENCRYPTION_KEY` prevista para credenciais IMAP/SMTP.
- [x] Deployment observado no Dokploy concluído sem erro no log enviado.
- [~] Confirmar o SHA exato exibido pelo deployment ativo no Dokploy.
- [~] Confirmar domínio, TLS, cookies e sessão no ambiente publicado.

## 2. Qualidade e segurança

- [x] Isolamento de tenant coberto por testes do backend.
- [x] Rate limit com Redis e fallback controlado.
- [x] Sessão com cookies protegidos e refresh rotativo coberta por testes.
- [x] CORS e origem pública protegidos contra host encaminhado arbitrário.
- [x] Limitação de corpo de requisição e request ID cobertos por testes.
- [x] Conteúdo rico sanitizado contra scripts e links executáveis.
- [x] Estados de carregamento, erro e retry visíveis em módulos críticos.
- [~] Suíte completa do backend depende de ambiente de integração com banco/Redis; os testes críticos isolados passaram.
- [ ] Teste de restauração de backup em um segundo ambiente Dokploy.
- [ ] Teste de rotação de chaves com recriptografia controlada.

## 3. Inbox e atendimento omnichannel

- [x] Inbox com filas, seleção de conversa, histórico e atualização em tempo real.
- [x] Paginação de mensagens antigas preservando a posição de rolagem.
- [x] Datas agrupadas na conversa.
- [x] Status visual de mensagem enviada, entregue, lida, enviando e falha.
- [x] Ficha do contato acessível a partir da conversa.
- [x] Histórico do contato preservado no CRM/Contatos.
- [x] Anexos com seleção múltipla e limite de tamanho no frontend.
- [x] Emoji, respostas rápidas, localização, contato e gravação de áudio previstos no compositor.
- [x] Menu contextual e atalhos de atendimento.
- [x] Identificadores técnicos ocultados na exibição do contato.
- [x] Números WhatsApp com sufixo técnico normalizados para telefone legível.
- [x] Regressão pós-correção: 100 testes do frontend passaram, incluindo identidade de contatos.
- [~] Envio e recebimento real de imagem, áudio, vídeo, documento e thumbnail via WAHA.
- [~] Confirmação real dos três estados de recibo com um aparelho WhatsApp.
- [~] Validação de troca de número e recuperação histórica em conversa real.
- [ ] Integração oficial Meta para Instagram/Facebook em produção.
- [ ] Telegram, TikTok, LinkedIn, Threads, X e Google com conexão real de produção.

## 4. Chatbot, Workflows e IA

- [x] Editor visual com blocos, conexões, zoom, organização e reposicionamento.
- [x] Estados de carregamento, erro e retry no editor.
- [x] Persistência do rascunho por tenant e recuperação local.
- [x] Biblioteca de fluxos reutilizáveis.
- [x] Destinos de departamento, atendente e agente de IA filtrados por tenant.
- [x] Validação de departamento e atendente ativo no backend.
- [x] Ações de etapa, etiqueta, prioridade, CRM e tarefa cobertas por código/testes.
- [x] Cancelamento de automação quando a conversa muda de departamento ou atendente.
- [x] Testes locais do Flow Studio e opções passaram.
- [~] Publicação de um fluxo real em canal WAHA e execução com conversa real.
- [~] Transbordo real com resumo de contexto para equipe ou atendente.
- [~] Validação de agentes de IA com credencial de modelo configurada.
- [ ] Templates completos de triagem para clínica, imobiliária e rastreamento.

## 5. CRM, Kanban e tarefas

- [x] Etapas de CRM e movimentação por workflow.
- [x] Finalização com ganho/perda e motivo.
- [x] Histórico mantido após finalização.
- [x] Tarefas internas separadas do contexto da conversa.
- [~] Procedimentos personalizados por cliente com checklist e progresso percentual.
- [~] Aceite visual do Kanban durante o atendimento real.
- [ ] Modelos de operação Rastreabem com Comercial, Financeiro e Suporte.

## 6. Financeiro, e-mail e integrações

- [x] Contrato e fluxo atual do Asaas com validações de ambiente.
- [x] Variáveis SMTP documentadas: `MAIL_SERVICE`, `MAIL_HOST`, `MAIL_USER`, `MAIL_PASSWORD`, `MAIL_FROM`.
- [x] Chave de integração documentada para proteger credenciais IMAP/SMTP.
- [~] Teste real de envio SMTP no Dokploy.
- [~] Cadastro e leitura de caixa IMAP com credencial configurada.
- [~] Cobranças e consulta financeira dentro da conversa com destinatário confirmado.
- [ ] Adaptador Stripe.
- [ ] Adaptador Mercado Pago.
- [ ] Adaptador InfinitePay.
- [ ] Conciliação financeira multi-provedor validada em produção.

## 7. Design premium e experiência

- [x] Tokens e regras de design documentados.
- [x] Tema escuro/híbrido e direção visual premium registrados no blueprint.
- [x] Ícones Lucide e fontes locais validados por testes.
- [x] Contraste de etiquetas e controles acessíveis validado.
- [x] Responsividade mobile/tablet e navegação PWA cobertas por testes.
- [~] Auditoria visual manual no ambiente publicado.
- [ ] Cards expansíveis, setas e navegação animada da apresentação aplicados globalmente.
- [ ] Studio Visual completo para páginas, formulários, galerias e conteúdo dinâmico.

## 8. Produtos verticais e plataforma

- [x] Blueprint de módulos por segmento publicado.
- [x] Blueprint FAETER registrado com curso, módulos, provas, portal e InfinitePay.
- [ ] Provisionamento guiado de tenant com seleção de módulos e branding.
- [ ] White Label completo por domínio e identidade.
- [ ] Backup e restauração seletiva de tenant, arquivos e banco.
- [ ] Replicação em novo servidor Dokploy.
- [ ] Produto Rastreabem provisionado e validado.
- [ ] Produto FAETER provisionado e validado.
- [ ] Portais de aluno, professor e secretaria.
- [ ] Provas online/presenciais com tentativa única e reteste autorizado.

## Próximo aceite objetivo

1. No Dokploy, confirmar o SHA do deployment ativo.
2. Abrir o Inbox e validar uma conversa real pelo WAHA.
3. Enviar texto, imagem, áudio e anexo.
4. Executar um fluxo simples do chatbot.
5. Transferir para Comercial, Financeiro ou Suporte.
6. Confirmar protocolo, contexto, responsável, Kanban e encerramento.
7. Registrar neste arquivo o resultado e o horário do teste.

Este painel não declara que um item está pronto apenas porque existe uma tela ou uma função no código. O aceite exige a evidência indicada em cada seção.

