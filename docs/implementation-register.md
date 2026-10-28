# Registro consolidado de implementação

Fontes consultadas: histórico acessível das conversas Auditar e integrar chatbot Véxora (01a17e53-3451-7200-8d42-75c478349ff7 e 01a17bc4-f7e4-7033-8d95-13c71de9af3b), esta conversa, 22 documentos em docs/ e issues abertas #17, #30, #32, #34, #35, #36 e #37.

Este registro substitui checklists antigos como fonte de estado, sem apagar os documentos históricos. Um documento antigo pode descrever uma limitação que já foi resolvida em commits posteriores.

## Entregue até o PR #178
- Autenticação, empresas isoladas, papéis, canais WAHA/Zernio, inbox persistido e eventos em tempo real.
- CRM, protocolos, cadastro financeiro Asaas sincronizado e proteção contra exclusão.
- Normalização de CPF/CNPJ, nome preferido, avatares, saudações e respostas rápidas compartilhadas.
- PWA, notificações, temas, controles compactos e correção de rolagem mobile.
- Cadastro de atendentes, módulos por departamento e pessoa, pipelines departamentais e herança de módulos.
- Biblioteca de modelos iniciais para 14 segmentos; publicação de chatbot por departamento e atendente.
- Triagem de áudio por identificação de mídia, transcrição e retorno por voz com fallback para texto.
- Configurações de agentes/Skills, provedores por empresa e prioridade econômica de modelos.
- SMTP/IMAP, e-mails, editor rico sanitizado, aniversariantes e workflows internos com horários, filas, etapas e cancelamento.
- Drive Explorer, referências, paletas, geração de conteúdo e rotinas sociais com Zernio, pastas de prontas/novidades e múltiplas contas.
- Renderização de vídeos e recuperação de publicações com resultado externo incerto.

Esses itens têm implementação no repositório; isso não substitui testes operacionais de contas externas e aparelhos reais.

## Entregue no PR #179
- Administração da plataforma separada dos proprietários de empresas clientes; criação exclusiva pela administração Véxora, com nome, segmento e plataformas internas opcionais.
- Estrutura inicial isolada com departamentos, pipelines, rascunhos, agentes de IA e rotinas de acompanhamento.
- Alternância real de empresa no servidor e renovação da sessão HTTP-only.
- Google Drive e Agenda vinculados à empresa, departamento ou atendente naquele contexto.
- Provisionamento retomável de Referências, Novidades, Prontas e Publicadas, sem cópia de credenciais ou arquivos existentes.
- Abertura dos recursos corretos no Explorer e na Agenda.
- Senha temporária com troca obrigatória, redefinição administrativa, revogação de sessões e negativas individuais de módulo.
- Bot silencioso, filas e eventos restritos à atribuição humana e notificações por destino configuráveis.
- Testes de isolamento, políticas de senha, acesso por URL e criação concorrente na CI.

## Entregue no PR #180: Home de apresentação
- Página inicial sem título e sem indicadores, aberta pelo logo, separada de Visão geral.
- Imagem e cor de fundo independentes para desktop/celular; logo pequeno centralizado por padrão.
- Ajustar, preencher, centralizar, estender, ampliar e lado a lado; prévia, aplicação, edição com clique duplo/toque duplo e exclusão.
- Armazenamento privado por empresa, validação de imagem e controle de revisões concorrentes.
- Sidebar fixa no desktop com rolagem fina e chapada; submenus sem rolagem própria.
- Barras de rolagem padronizadas em todo o produto: cinza escuro em área clara, brancas em área escura.

## Pendências preservadas para as próximas alterações
1. Personalizações detalhadas por recurso: os pacotes agora materializam agentes e rotinas também nas empresas existentes e preservam edições; falta uma matriz de sobrescritas por recurso com precedência explícita.
2. Especializar os 14 segmentos além da triagem inicial, começando por Rastreamento veicular e Escola de músicas e instrumentos.
3. Vincular os recursos provisionados aos monitoramentos de publicação existentes e ao contexto efetivo da IA/chatbot.
4. Picker real do Google no Brand e seleção de arquivos/pastas; validar credenciais habilitadas e operações autorizadas.
5. Mídia no atendimento: upload, gravação, armazenamento privado, transporte por canal, prévia e status real.
6. Outbox e reconciliação: recuperar itens não enviados, separar resultados ambíguos e impedir repetição cega após crash.
7. Retirar chamadas externas de IA das transações longas, com reserva de orçamento persistente.
8. Consolidar os escritores restantes de metadata, com concorrência entre Asaas, webhooks e CRM.
9. Financeiro por carteira/plataforma, vínculos múltiplos, pessoas autorizadas e validação real de identidade.
10. Régua configurável D-5, D-3, D0, D+2 e D+5, janela de contato, opt-out, suspensão por pagamento e prévia da cobrança manual.
11. Completar a matriz de ações por papel além dos módulos; identidade/apelido do atendente e SLA de ociosidade. Visibilidade do bot, negativas individuais e redefinição de senhas estão implementadas nesta entrega.
12. API de captura e atribuição de leads, formulários e campanhas com proveniência confiável.
13. Telefonia/SMS e chamadas ao vivo com IA, incluindo mídia e gravação; não confundir eventos de ligação do WhatsApp com suporte a conversar por voz.
14. Testar GOWS em ambiente separado, conforme solicitado para depois do escopo funcional. Não trocar o motor operacional sem medir compatibilidade e reconexões.
15. Rate limiting distribuído, retenção, restauração de backup e observabilidade operacional.
16. Validar cenários reais Google, Zernio, financeiro sandbox, permissões, mobile, teclado/leitor de tela e o piloto Rastreabem.
17. Revisar a migração de configurações do repositório antigo sem alterar o sistema antigo ou copiar segredos.
18. Implementar a integração WordPress completa usando sua permissão própria; ainda não entregue.
19. Conferir a implantação no Dokploy por evidência; aprovação de CI não prova atualização do site.

## Continuidade
A partir desta entrega o desenvolvimento ocorre diretamente no GitHub, com uma branch por conjunto coerente de alterações, CI completa e histórico de PRs. Não marcar o inventário inteiro como concluído por ter publicado um único conjunto de funcionalidades.

## Escopo reduzido aprovado
O proprietário substituiu as expansões acima pelo escopo de docs/product-focus.md. Telefonia, SMS, campanhas em massa, anúncios, WordPress, vídeo automático e publicação social automática saem da aplicação ativa. WhatsApp e chat no site permanecem prioritários; não tratar widget público como entregue sem teste real. Marketing mantém criação e organização manual. Backlog histórico acima é referência, não autorização para retomar funcionalidades retiradas.
