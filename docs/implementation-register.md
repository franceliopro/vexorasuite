# Registro consolidado de implementação

> **Registro histórico.** A fonte canônica de estado é `docs/implementation-status.md`. Uma seção marcada como “entregue” aqui pode ter sido substituída por decisão posterior; é o caso da Home de apresentação e do criador de sites com IA.
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

> **Removida posteriormente.** A apresentação com papel de parede foi retirada a pedido do produto; a inicial é a Visão geral e o logo leva para ela. O conteúdo abaixo é histórico.- Página inicial sem título e sem indicadores, aberta pelo logo, separada de Visão geral.
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
18. ~~Implementar a integração WordPress completa usando sua permissão própria; ainda não entregue.~~ **Removida do escopo:** WordPress não será integrado; os sites são recriados em Next.js/MDX ou com CMS headless.
19. Conferir a implantação no Dokploy por evidência; aprovação de CI não prova atualização do site.

## Continuidade
A partir desta entrega o desenvolvimento ocorre diretamente no GitHub, com uma branch por conjunto coerente de alterações, CI completa e histórico de PRs. Não marcar o inventário inteiro como concluído por ter publicado um único conjunto de funcionalidades.

## Escopo reduzido aprovado
O proprietário substituiu as expansões acima pelo escopo de docs/product-focus.md. Telefonia, SMS, campanhas em massa, anúncios, WordPress, vídeo automático e publicação social automática saem da aplicação ativa. WhatsApp e chat no site permanecem prioritários; não tratar widget público como entregue sem teste real. Marketing mantém criação e organização manual. Backlog histórico acima é referência, não autorização para retomar funcionalidades retiradas.

**Reabertura aprovada em 26/11/2026 (item 13):** o proprietário autorizou retomar telefonia/SMS e chamadas ao vivo com IA em fatias reversíveis. A primeira fatia entrega apenas contrato e infraestrutura em `apps/telephony` e `infra/telephony`: webhook assinado por tenant, consentimento default-deny, idempotência, auditoria e Postgres isolado, com `TELEPHONY_MODE=simulation` por padrão. Nenhuma chamada, mensagem ou IA real foi executada. Discagem, gravação, transcrição e IA em chamadas dependem de PR próprio, consentimento por canal e APIs oficiais autorizadas — nunca scraping. O restante do escopo reduzido continua vigente.
## Entregue no PR #509+ (rodada de 2026-11-10, telão comercial + sites + planos)

- **Véxora Sites** (produto isolável): API `/api/sites` com wizard de área de negócio (12 áreas), blueprint IA de páginas completas (home/serviços/quem somos/contato/imóveis/notícias), editor visual de blocos com reordenação, publicação/despublicação com slug único, formulários arrastáveis com destinos (pré-cadastro/e-mail/WhatsApp), agendamento 1:1 no site, domínio próprio com verificação TXT via DNS, render público em `/sites/<slug>` e snippet de chatbot público.
- **Chatbot em tela cheia**: janela de teste de celular realista com status bar, dynamic island, wallpaper WhatsApp dark, bolhas/ticks, quick-replies; portal no `document.body`; novos controles de zoom com `fitCanvas` recentralizado.
- **Planos e pacotes (administração Véxora)**: catálogo completo com preços, limites, módulos, ciclo e MRR do cliente em painel próprio (`/api/backend/plans`), com criação/edição/arquivamento.
- **Catálogo de planos visível no painel do cliente** ("Planos e preços") com MRR exibido e CTA para o comercial.
- **Conexões desacopladas**: canais WhatsApp/Instagram/Facebook/et al. passam a anexar a consumidores (`INBOX | IA | CHATBOT | SITE`) por toggle — o padrão é desligado, a sequência "tela cheia ativada automaticamente" acabou; `channel_attachments` com migração e `GET /channels` expondo o estado.
- **Conexão â†’ atendimento filtrado**: `accessWhere` na fila exclui canais sem anexo INBOX; runtime de IA idem (CHATBOT/IA).
- **Relatórios executivos** (página nova, 1339 linhas): abas Visão geral/Atendimento/Equipe/CRM/Financeiro/IA & Automação com KPIs, gráfico de rosca, SVG direto, exporta CSV e PDF nativo (`window.print`) com capa institucional.
- **Sites (round 2, entrega incremental)**: catálogo de 12 áreas com textos próprios, hero/CTA/galeria/depoimentos/FAQ/posts/imóveis, editor de blocos com reordenação acima; público acessível em `/sites/<slug>` (SSR + fonte Inter não usada — sistema com `Georgia`/`system-ui`).
- **CI verde**: `tsc`, ESLint, testes de contrato (130 web, 560 api).

## Entregue na rodada de 2026-11-16 (custom domains + atendimento WhatsApp + widgets)

- **Domínios próprios de cliente (Caminho B, Cloudflare for SaaS)**: endpoint público `GET /api/public/sites/resolve?host=` (site publicado + TXT ativo), middleware web `apps/web/src/middleware.ts` que resolve Host → `/sites/<slug>` para qualquer domínio externo (hosts `*.vexorasuite.com.br` e localhost passam direto), roteador catch-all do Traefik no serviço `web` via labels no `docker-compose.yml` (rotas explícitas prevalecem). Mensagens de verificação de DNS sem promessas externas; instruções do criador atualizadas (CNAME/ANAME → `static.vexorasuite.com.br`).
- **Atendimento (WhatsApp-like)**: mensagem em Roboto 14.2px/19px peso 400 mais escura; balões com definição (entrada sólida, saída tinta primary); fundo do corpo da conversa com papel sutil; composer com trilha de ferramentas rolável (mic e avião sempre visíveis); ícones do composer em traço mais grosso e cor escura; popovers ancorados sob a própria ferramenta (emoji, anexar, respostas rápidas); menu de contexto por clique (botão direito) parte do ponto do clique (`position: fixed`); "Inserir variável" em chips livres lado a lado; janelas de transferência e de convite refeitas (flyout ancorado, ícones por setor com cor determinística, avatares, footer com destino e CTA primário).
- **Assumir conversa do setor**: atendente assume conversa HUMAN atribuída a colega do próprio setor, conversas em que participa e (admin) qualquer HUMAN; antes só sem dono. **Permissões de transferência por atendente** em `integrations.teamTransferScope`: próprio setor / outros setores / atendente direto; editável em Equipe → Setores e permissões → Permissões de transferência; `/departments` expõe `isMine` e respeita o escopo; bloqueio no `handoff` com mensagem clara.
- **Alarmes pessoais**: `GET/PUT /reminders/alarms` (mapa por atendente); painel em Configurações → Atendimento → Alarmes pessoais (nome, horário, data única ou recorrência semanal); overlay em tela cheia com sirene e nome do compromisso falado; alarme de uma vez se desativa após parar.
- **Dashboard**: saudação com primeiro nome e data completa por extenso; widgets coloridos de Relógio (ao vivo), Clima (Open-Meteo, cidade dos Dados da empresa, sem chave) e Calendário do mês.
- **Flow Studio**: régua de comandos só com ícones e tooltip (Ajuda, Desfazer, Refazer, Novo fluxo, Criar com IA, Exportar/Importar, Elementos, Testar, Organizar, Tela cheia, Salvar); propriedades do bloco em cards (O bloco / Conteúdo / Conexões de saída) com textos trocados por ícones de ajuda; largura ajustável 280–520px com persistência; portas de entrada/saída sempre visíveis.
- **Mobile**: composer com botão "+" (Atalhos, Cobranças, Agendamentos, Respostas rápidas, Emojis); alvos de toque maiores.
- **Sites e Agentes de IA**: assistente Criar site em 3 etapas (O site / Conteúdo e IA / Contato), diálogo maior; agentes em grid de cards graúdos com rosto de robô, nome, papel, tom e status.

## Entregue na rodada de 2026-11-17/18 (pendências, documentos, billing e onboarding)

- **MCP Server oficial da Véxora** (#792): `POST /api/mcp` JSON-RPC 2.0 (initialize, ping, tools/list, tools/call). Token público por empresa (o mesmo do Public API), tenant scope estrito, trilha de auditoria própria (`mcp.tool_call`) e rate limit por token. 10 tools v1: list_conversations, get_conversation, search_contacts, list_tasks, get_pipeline_funnel, get_queue_status, add_internal_note, create_task, move_card_stage e draft_reply (rascunho — nunca envia sem aprovação humana).
- **BI de diretoria no funil do CRM** (#793): `crm/pipelines` expõe cards por etapa, ganhos e perdas por pipeline; Relatórios → CRM / Vendas mostra contagens reais, badges Ganhos/Perdas e exportação CSV com contagens.
- **Atendentes** (#795/#797): novo papel **Administrador** atribuível pelo proprietário (ou administração Véxora); edição de nome/e-mail e demais dados do atendente no card (histórico preservado — edição in-place; "Desativar" preserva, "Excluir definitivamente" libera e-mail); permissões/módulos efetivos visíveis no card; e-mail de primeiro acesso e de redefinição de senha com template amigável (link da Véxora, identificador, login, senha temporária e regras de senha, saudação pelo "Conhecido por").
- **Módulo Documentos** (#805/#813): modelos de Orçamento/Contrato/Ordem de serviço/Recibo com variáveis e seeds iniciais; geração com preenchimento automático a partir do contato (nome/telefone/e-mail/CPF·CNPJ/empresa/endereço do Asaas); download em PDF (pdfkit), impressão, envio por e-mail (MailService com anexo) e **envio direto pelo WhatsApp** (PDF via WAHA, gravado na conversa como mensagem de arquivo). Assinatura digital (ZapSign) e envio WhatsApp a partir do composer ficam para fases seguintes.
- **Self-service billing** (#808): catálogo enxuto (Essencial R$ 249 · Crescimento R$ 449 · Completa R$ 799 · Parceiro R$ 1.499; demais planos saem do catálogo público). Botão "Ativar agora" no painel do cliente cria cobrança Asaas da própria Véxora (referência `vexora:plan:<code>:<tenantId>`), e o webhook `PAYMENT_CONFIRMED/RECEIVED` ativa o plano automaticamente. Requer `PLATFORM_ASAAS_API_KEY` + `PLATFORM_ASAAS_WEBHOOK_TOKEN` (ver docs/platform-billing.md); sem eles responde 424 com instrução clara e direciona ao comercial.
- **WhatsApp Oficial pela Meta (Cloud API)** (#811, rodada 2026-11-18): conexão direta e cifrada por empresa em Conexões → WhatsApp Oficial (Phone Number ID, WABA ID, System User token e App Secret — validados contra Graph API antes de salvar; verify token gerado e exclusivo). Webhook público `/api/webhooks/meta/<id>` em `/api/webhooks/meta/<id>` com verificação GET (challenge) e POST assinado por **HMAC-SHA256** contra o App Secret (`x-hub-signature-256`); ingestão de texto/mídia no mesmo pipeline do WAHA (identidade, conversa, robô, eventos) com status **sent → delivered → read** ao vivo. Envio de texto com etiqueta do atendente. Registro e instruções em `docs/meta-cloud-api.md`.
- **Onboarding produtizado + Curso Véxora** (#811): checklist de primeiros passos na Visão geral (dados da empresa, canal, equipe, primeiro documento; dispensável para sempre via localStorage) e Curso Véxora (nav lateral, 7 aulas com duração/resumo/pontos práticos, progresso local, certificado imprimível 100% concluído; vídeos em produção — não inventados).
- **Atendimento/UX** (#771/#772, #782, #804): grid do atendimento restaurado (fix em 5 colunas), alinhamento do mic/enviar no composer, dock mobile e tela cheia corrigidos, foto do contato com retry antes de cair nas iniciais, toggle da ficha alinhado e respiro ícones↔placeholder no composer.
- **Tema** (#774/#776/#798): tema escuro em cinza (não azul); "super poder" da sidebar no híbrido por empresa (fundo/texto/ícones/hover + badge de contraste, persistido via brand-settings); remoção das transparências da sidebar; ícones de rodapé (?/instalar) seguindo a cor da fonte; botão direito na sidebar abre o popover "Cor Modo Híbrido"; ícones do calendário/relógio visíveis no widget.

## Estado histórico do criador de Sites (fatiamento 2026-11-20)

> **Substituído em 2026-11-23.** O criador de sites com IA, seu wizard e seu editor visual saíram do produto. O serviço atual é o HUB da Véxora, descrito em `docs/plano-transicao-presenca-criativos.md` §12. Todo o conteúdo desta seção é histórico.
As seções acima são inventário histórico; a fonte da verdade do criador hoje é o par `SiteDocument` (JSONB) + `apps/api/src/modules/sites-deploy/site-html.ts`. Os blocos legados `BLOCKS_META` em `apps/web/src/app/sites-shared.ts` não são o registry do editor atual.

- **Fatia 1** (#849): API `/api/sites` protegida por `SITES`, listagem/criação no workspace e entrada no wizard em tela cheia.
- **Fatia 2** (#851): editor visual integrado ao workspace (paleta, canvas, inspetor, árvore, salvar versionado), sem rota solta nem modal.
- **Fatia 3** (#853): publicação via Cloudflare Direct Upload a partir do documento salvo; domínio próprio com vínculo e verificação; `SiteDeployment` e `SiteDomain`.
- **Fatia 4** (#855): importação de URL, HTML e ZIP no backend (`htmlparser2`), com adapters antigos fora da fonte da verdade.
- **Fatia 5** (#857): IA por bloco com regras determinísticas primeiro, modelo real só quando necessário, patch validado por whitelist, cota e auditoria; o endpoint não salva sozinho.
- **Fatia 6** (#859): formulário publicado com submissão anônima, UUID determinístico `siteId + blockId`, honeypot, rate limit, `SiteFormSubmission` + `Contact` + `auditLog` na mesma transação e painel "Respostas" no editor.
- **Fatia 7** (#862/#863): `LANDING` como tipo no wizard, com template de uma página (oferta, benefícios e formulário com ID estável). A âncora do CTA passa a ser emitida pelo renderizador HTML; importações não são sobrescritas pelo template.
- **Correção de produção** (#864/#865): `SiteDomain`, `SiteDeployment` e `SiteDocument` passaram a declarar `siteId` como `@db.Uuid`, com migração que converte as colunas e cria as FKs para `sites(id)`. Até então a migração `20261119090000` havia criado essas colunas como `TEXT` sem FK, e `_count: { siteDeployments }` em `SitesService.list()` falhava com Postgres 42883 (`uuid = text`), derrubando Sites e Documentos. Teste de regressão `sites-schema.spec.ts` impede nova divergência.
- **Fatia 8** (branch `fix/sites-prompt-generation`): a descrição do wizard passa a gerar, de forma determinística, um rascunho premium com 12 seções na home e 9 páginas secundárias (`sobre`, `servicos`, `cases`, `faq`, `contato`, `privacidade`, `termos`, `cookies`, `exclusao-de-dados`). Regras por palavra-chave escolhem segmento, CTA, benefícios, serviços e etapas; a descrição é higienizada e usada como texto de apoio, sem depender de modelo externo. O wizard aceita URL HTTPS de logo; sem ela, o documento recebe uma marca "LOGO PROVISÓRIO" editável. Dados cadastrais e textos legais fictícios vêm marcados como rascunho para substituição pelo proprietário. O editor passa a selecionar a página ativa, salva o documento inteiro e aplica patches de IA em blocos de qualquer página, incluindo FAQ. O deploy renderiza `index.html` + `<slug>/index.html`, e o formulário publicado localiza blocos em páginas secundárias com `pageSlug` correto.

- **Fatia 9** (branch `fix/marketing-wizard-ready-drafts`): o fluxo "Agente Marketing" foi removido; "Criação com IA" é o único entry point assistido em Publicações e criações. O wizard passa a gerar, por regras determinísticas e sem modelo externo, quatro capas (duas escuras e duas claras), lâminas com CTA, legenda e as respectivas imagens PNG servidas pela API. A geração já salva um rascunho manual com todas as imagens, permite escolher a capa, editar legenda/data e somente publica ou agenda mediante confirmação explícita.

- **Fatia 10** (branch `fix/sites-wizard-generated-images`): o wizard de Sites passa a gerar ilustrações PNG locais e determinísticas (sem modelo externo, download ou acesso a outro tenant) a partir do nome e das cores informadas. As imagens entram no `SiteDocument` como blocos `image` editáveis, com texto alternativo e rótulos que as identificam como ilustrações de rascunho; os antigos avisos “FOTO REAL DA EQUIPE OU DO ESPAÇO” e o texto da equipe nas páginas secundárias ganharam arte, sem fingir foto, depoimento ou dado real. O renderizador HTML passa a aceitar somente PNG base64 com assinatura válida e tamanho limitado em `<img>`; SVG, `data:` genérico e links `data:` continuam bloqueados.

**Ainda não entregue/conferido:** publicação real na Cloudflare e Cloudflare for SaaS dependem de credenciais configuradas no ambiente e de evidência de deploy; não afirmar publicação, domínio ativo ou envio de formulário em site publicado sem essa confirmação. `post-list`/`product-grid` seguem como placeholders; a rota pública `/sites/<slug>` citada no histórico não existe no checkout atual (o middleware a reescreve, mas não há `page.tsx` nem endpoint `public/sites/resolve`). Textos legais publicados anteriormente precisam de revisão jurídica do proprietário (bases legais, prazos, operadores, DPO e endereço físico).

## Rodada de 2026-11-25: shell Tauri v2 (configurado, não publicado)

- **Configurado:** `apps/shell` contém um shell Tauri v2 que carrega `apps/web` (canonical) via URL remota em produção e via Next.js em `localhost:3000` no dev. Há `Cargo.toml`, `tauri.conf.json` v2, capacidade local-only sem IPC remoto, overrides para Android/iOS e ícones nativos gerados de `sites/institucional/assets/logo-app.svg` por `pnpm shell:icon`. Nenhuma regra de negócio foi movida para Rust; o web segue sendo a única interface.
- **Validado automaticamente:** testes estáticos de configuração/scripts, `tauri info`, `cargo check` e `tauri build --no-bundle --ci` no Ubuntu (Linux); instalador NSIS compilado no Windows e APKs não assinados compilados no Android, ambos anexados como artefatos de CI. O build do pacote no monorepo permanece no-op para não transformar `pnpm build` em build nativo.
- **Não executado/não afirmado:** MSI, macOS e iOS (sem macOS/Xcode), AAB, assinatura, keystore, notarização, upload para lojas, instalação, execução em dispositivo real e publicação. Artefatos de CI não são release. **Nenhum binário foi publicado.**
- Detalhes e limitações em `docs/tauri-v2-shell.md`. `apps/native` permanece como scaffold anterior, sem alterações nesta rodada.
## Rodada 2026-11-25 (branch `feat/finance-catalog-subscriptions`)

- **Financeiro → Produtos:** aba própria com grid do catálogo ativo da empresa (`GET /api/backend/catalog?category=ASAAS&limit=200`), estado vazio e atalho interno para Configurações → Catálogo. Imagem e descrição ficam na Véxora; nenhuma das duas é enviada a WhatsApp, e-mail ou outros canais externos.
- **Nova assinatura:** modal passa a usar `useModalDialog`, lista somente serviços reais do catálogo, oferece "Criar outros…" sem criar serviço fora da gestão, aceita `endDate` e envia `catalogItemId` ao servidor. O navegador não envia `service` nem `value`; nome/preço vêm do `CatalogItem`.
- **Exclusão no Asaas:** assinaturas e clientes podem ser excluídos mediante confirmação digitada `EXCLUIR`, ligada aos endpoints `DELETE /api/backend/finance/subscriptions/:id` e `DELETE /api/backend/finance/customers/:id`. A mensagem de sucesso aparece somente após resposta positiva do servidor, com auditoria; falha não é relatada como concluída.
- **Backend preservado:** filtro por categoria em `CatalogController.list`, serviços/assinaturas/exclusões em `AsaasService`, endpoints `DELETE` e specs novas/foco em `catalog-scope.spec.ts`, `asaas.service.spec.ts` e `finance.controller.spec.ts`.
- **Runtime de catálogo:** bloco `catalog.item` valida item ativo e tenant-scoped; `imageUrl` e `description` ficam em metadata interna e auditoria, nunca no texto entregue ao canal. Falha de item indisponível continua explícita, sem fallback inventado.
- **Guardas de UI/teste:** `tailwind-finance-workspace.test.mjs` cobre aba Produtos, fetch do catálogo, modal, payload por `catalogItemId`, exclusões confirmadas e a abertura de Configurações → Catálogo pelo evento `vexora:open-catalog`.

**Não afirmado:** deploy, publicação, pagamento, cobrança, assinatura eletrônica, integração real com Asaas ou envio externo. Esses estados exigem evidência da operação correspondente. Documentos, assinatura digital e composer seguem fora desta entrega.

