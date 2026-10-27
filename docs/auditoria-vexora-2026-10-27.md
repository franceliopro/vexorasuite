# Auditoria geral da Véxora — 27/10/2026

## Parecer

Compensa evoluir a base atual como monólito modular Next.js + NestJS + Prisma/PostgreSQL. Atendimento, CRM, financeiro, agenda, tarefas e integrações já têm implementação aproveitável. O investimento prioritário é fechar os caminhos de ponta a ponta, tornar as capacidades visíveis e confiáveis e medir a execução. A arquitetura do Intelligence Engine deve continuar usando regras/Skills antes de IA. Não há justificativa técnica demonstrada para migrar agora para microsserviços ou acrescentar frameworks pesados de editor/agentes.

Esta auditoria combina revisão do código, testes automatizados, builds e inspeção autenticada da aplicação publicada. Não equivale a certificação de segurança, teste de carga, cobertura exaustiva de todos os dados/roles ou aprovação de produção. As correções permanecem no PR até o merge. Na operação informada pelo proprietário, o merge em `foundation/bootstrap-monorepo` aciona o Dokploy.

## Evidência da versão publicada

Inspeção em viewport desktop 1363 × 936, sem enviar mensagens, criar tarefas, publicar posts, gerar cobranças ou alterar conexões:

| Área | Constatação |
|---|---|
| Híbrido | Sidebar `rgb(25,29,40)` e cards brancos; estrutura de tema coerente |
| Claro | Sidebar e cards brancos; preferência alterna corretamente |
| Escuro | Inbox/sidebar `rgb(25,29,40)` com texto claro; editor de fluxos ainda tinha texto escuro em blocos escuros |
| Contraste do branding atual | Azul `#7898F7` com branco: aproximadamente 2,75:1; com preto: 7,63:1 |
| Visão geral | Indicadores exibiam `—` e mensagens de integração pendente apesar de existirem módulos operacionais |
| Tarefas | Janela Nova tarefa abriu; Escape no campo Título não a fechou. Foi fechada por Cancelar, sem salvar |
| Google | Agenda e Drive apareciam autorizados no workspace inspecionado; não foi feita nova autorização |
| Zernio | API autenticada, uma conta Instagram vinculada e webhook verificado na tela |
| Chatbot | Rascunho efetivamente carregado tinha 6 blocos, 12 saídas sem destino e 5 blocos sem entrada configurada |
| Tela cheia do chatbot | Canvas medido com 838 px de altura e rodapé de diagnóstico ocupando parte da viewport |

O tema inicial Híbrido foi restaurado ao concluir os testes de alternância. O conteúdo do rascunho salvo não foi substituído. As contas e dados de negócio não são reproduzidos neste relatório.

## Correções implementadas nesta entrega

| Prioridade | Problema | Correção |
|---|---|---|
| P1 | Respostas rápidas e rascunho em cache global de navegador | Chaves por tenant; descarte do cache legado sem origem comprovada; remount dos workspaces por empresa |
| P1 | Escritas concorrentes no JSON de integrações sobrescreviam outros módulos | Mutação de chave sob lock do tenant para branding, respostas rápidas, etiquetas/campos CRM e configuração Asaas; Engine/assistente já usam lock |
| P1 | Google renovava token a cada chamada após expiração | Serviço compartilhado Agenda/Drive com validação de tenant/escopo, refresh serializado e persistência criptografada |
| P1 | Autorização Google podia terminar após revogação do acesso administrativo | Callback revalida vínculo, empresa/usuário ativos e papel antes de concluir a autorização |
| P1 | Chamadas de IA sem limite diário por empresa | Limite configurável de execuções/dia, padrão 100; zero bloqueia modelos. Cada execução admite até três tentativas configuradas; regras/Skills continuam disponíveis |
| P1 | Novas ficava inacessível para operadores sem atribuição/equipe | Filtro específico permite a fila geral ainda sem responsável, sem abrir conversas já atribuídas por essa rota |
| P2 | Badges dependiam de listas limitadas a 100 conversas | Endpoint de contagem com filtros de tenant/permissão; reduz três downloads de listas a uma consulta de contadores |
| P2 | Visão geral era estática | Indicadores e atividade recente conectados ao banco e ao escopo de acesso do usuário |
| P2 | Escape, Tab e retorno de foco inconsistentes | Hook compartilhado nas janelas de finalização CRM/inbox, agenda e tarefas; bloqueio de scroll e restauração do foco |
| P2 | Enter durante composição de texto podia enviar a mensagem | Composer respeita composição de texto/IME |
| P2 | Contraste do botão calculado por aproximação | Escolha entre preto/branco por luminância relativa e maior contraste |
| P2 | Texto dos blocos escuros ilegível | Nós, cabeçalhos, saídas e biblioteca passam a usar tokens de texto do tema |
| P2 | Editor com zoom/scroll e botão Ajustar pouco confiáveis | Listener de wheel não passivo, ajuste ao bounding box, Escape em tela cheia, remoção do rodapé e scrollbar visual do canvas |
| P2 | Tela inicial carregava todos os módulos | Imports dinâmicos por workspace; First Load JS local caiu de aproximadamente 215 KB para 115 KB (~46%) |
| P2 | Busca do cabeçalho sem execução | Enter encaminha a busca ao CRM, na visão de contatos, usando a consulta já existente |
| P2 | Prompt WhatsApp mesmo com rede social conectada | Prompt de conexão inicial não aparece quando já há canal conectado |
| P2 | Anexos selecionáveis sem transporte habilitado | Seleção de envio sinalizada como indisponível; implementação de mídia real segue prioritária |
| P2 | Entradas de anúncios/resultados vazias no marketing | Navegação concentra Postagens/criações e Referências, com funcionalidade real |
| P2 | Upload proxy sem limite real para streaming | Limite de leitura inclusive sem Content-Length, validação de origem com suporte a reverse proxy e cabeçalhos de segurança |
| P2 | Imagens Docker completas, dependência de comando de build no runtime | Multi-stage, processo sem root, web standalone com static/public e migração Prisma preservada na API |

A carga inicial medida pelo Next não representa o tamanho final de todos os módulos, nem uma medição de latência de usuários reais. Os módulos passam a baixar quando utilizados.

## Biblioteca de referências no Google Drive

Implementada em Marketing → Referências, com:

- Conexões Google já autorizadas do próprio tenant, mantendo o escopo `drive.file` existente.
- Importação por ID/link acessível à aplicação e upload privado via sessão resumível do Drive.
- PNG, JPEG, WebP, MP4 e PDF até 20 MB; imagens raster e resolução validadas.
- Finalidades: todas, artes, carrosséis ou vídeos/roteiros; orientações editáveis e ativação/desativação.
- Prévia/download autenticados por tenant; desativação do Drive interrompe o uso nas novas criações.
- Extração de paleta por processamento local, sem modelo e sem tokens.
- Briefing de carrossel inclui orientações limitadas e paletas de referências ativas; a arte usa paleta analisada como cor secundária e preserva branding do tenant.
- Arquivos originais não são tornados públicos nem enviados a um modelo de visão. Nome/orientações/paleta fazem parte do contexto textual da criação.
- Histórico de criações recuperável em Marketing → Postagens, com rascunhos e status real da Zernio.

Limites explícitos: a integração atual interpreta orientações textuais e paletas, não copia automaticamente a composição visual de uma imagem. PDF/vídeo têm cadastro, prévia e briefing; não há análise de vídeo, extração de frames ou renderizador de vídeo nesta entrega. Um modelo multimodal ou renderizador especializado exigirá provedor configurado, permissão de uso dos arquivos e controle de custo separado. Os originais permanecem no Drive; desativar uma referência não exclui o arquivo.

`drive.file` não autoriza a leitura arbitrária de toda uma pasta pelo link. Arquivos criados pela aplicação podem ser usados; arquivos existentes precisam estar previamente autorizados para ela. Se a API negar o link, o upload pela biblioteca é o caminho implementado. Picker para arquivos/pastas existentes é uma evolução adequada, sem ampliar indiscriminadamente o escopo de Drive.

## O que manter, reduzir e acrescentar

| Decisão | Recomendação |
|---|---|
| Manter | Inbox unificado, CRM simples, Asaas, Agenda/Tarefas, Zernio, temas por tokens, composer leve e editor visual com blocos tipados |
| Reduzir | Menus de capacidades inexistentes, textos introdutórios repetidos, consultas completas usadas apenas como contadores, dependência de IA para consultas previsíveis |
| Consolidar | Serviços de domínio extraídos de controllers grandes; mutações de metadata dos contatos com controle de concorrência; CSS acumulado com seletores repetidos e `!important` |
| Acrescentar primeiro | Teste integral do piloto, mídia real no atendimento, observabilidade/reconciliação, limites de integrações, dados operacionais e critérios de aceite por papel |
| Acrescentar depois | Picker/coleções Drive, templates de marca versionados, análise visual opcional, renderização de vídeo, atribuição de campanhas e canais adicionais |
| Evitar agora | Troca de stack, microsserviços sem necessidade medida, execução de Skills por prompts arbitrários ou instalação de muitos módulos sem caminho operacional completo |

## Pendências prioritárias e critérios de aceite

1. **Piloto Rastreabem:** corrigir ou substituir conscientemente o rascunho incompleto, mapear destinos reais, validar nome preferido/cliente Asaas/protocolo e Financeiro/Suporte nas três plataformas. Não ativar o rascunho atual. O cadastro de equipes só deve ser orientado como pronto após sua validação funcional.
2. **Atendimento com mídia:** finalizar upload, armazenamento, transporte e visualização de arquivos/áudio, status de entrega e fallback. Ditado do navegador não equivale a gravar/enviar áudio WhatsApp. Uma interface de seleção de arquivo não comprova envio.
3. **Confiabilidade do Engine:** worker/outbox com reconciliação, retries limitados e idempotência, testes com múltiplas réplicas. Estados ambíguos de WhatsApp/Zernio não devem gerar repostagem cega.
4. **Financeiro:** validar identidade correta/incorreta e cobrança existente em sandbox; testar PDF/CSV com dados conciliados; separar ambiente sandbox/produção. Não criar cobrança nova apenas para testar o painel.
5. **Permissões:** testar matriz OWNER/ADMIN/MANAGER/AGENT e política de visibilidade de Todos abertos; esse filtro já permite compartilhamento de conversas abertas na empresa. A política deve corresponder à privacidade desejada por departamento.
6. **Google/referências:** testar upload/import de arquivo permitido e negado, reconexão, token expirado, download em outro tenant e recuperação após falha parcial. Os testes automatizados usam mocks; a autorização observada na UI não comprova todas as operações da nova biblioteca.
7. **Segurança operacional:** rate limiting distribuído de login/upload, limites de requisição no proxy de entrada, revisão de dependências, backups/restauração e retenção de logs. HTTPS e segredos continuam sob configuração do Dokploy.
8. **Acessibilidade/mobile:** sessão desktop inspecionada; executar testes em dispositivos móveis, leitor de tela, zoom 200%, contraste de todos os estados e navegação por teclado após deploy. O hook de foco foi testado em DOM, não equivale a aprovação completa em todos os navegadores.
9. **Cobertura de funções:** criação de cobranças novas, ferramentas arbitrárias de agentes, automação genérica de workflows e geração de vídeos permanecem fora das capacidades implementadas. Catálogo e UI precisam continuar distinguindo configuração, execução e validação.

## Verificação e rollout

Validação local desta etapa: 76 testes backend + 6 testes de interface/DOM; typecheck API/web; build API/web; montagem do AppModule com dependências mockadas. CI foi ampliada para build de containers e smoke de runtime Prisma/Sharp e aplicação web standalone com arquivo estático HTTP 200. O resultado efetivo da CI deve ser consultado no PR.

Há uma migração aditiva para `creative_references`, com vínculo ao tenant e conexão Google. Excluir uma conexão limpa o vínculo da referência e impede seu uso, preservando os metadados. Não há migração automática do rascunho de chatbot salvo nem exclusão de arquivos do Drive.

Antes do merge: CI verde, revisão da migração e dos comandos de startup, backup e plano de retorno. Após o autodeploy: health da API, login, carregar arquivo estático, navegar pelos três temas, abrir/fechar janelas, verificar contadores e executar um teste controlado da biblioteca. Publicação real só com destino e conteúdo autorizados. Não confundir build/teste com funcionamento comprovado de todas as integrações externas.
