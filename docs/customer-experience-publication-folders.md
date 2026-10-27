# Experiência do cliente, conexões e mídias prontas

## Arquitetura e modelagem

Mantém o monólito NestJS/Next.js/PostgreSQL e os serviços privados existentes. A API normaliza campos CPF/CNPJ antes da validação e das consultas. As entradas de texto do chatbot normalizam somente variáveis de documento, preservando mensagens e zeros iniciais; Asaas continua validando o documento e a autorização financeira.

O runtime pergunta como a pessoa prefere ser chamada quando não há `novo_nome` persistido. Aceita manter o nome ou informar outro, grava no contato sob bloqueio e usa a preferência nas conversas futuras. O nome é uma preferência de tratamento, nunca uma comprovação de identidade.

`PublicationFolder` armazena origem, subpasta publicada, destinos, agenda e permissões do responsável. `PreparedPublication` registra a mídia, legenda, modelo, publicação remota e resultados por rede. A chave única empresa/conta/arquivo impede reaproveitar o mesmo arquivo do Drive, mesmo entre rotinas. Duas réplicas disputam a fila com `FOR UPDATE SKIP LOCKED`.

## Interface

- Explorer: Marketing → Google Drive. Canais e integrações também oferece acesso direto.
- Postagens: envio de mídia pronta, seleção de várias redes e rotinas das pastas prontas/novidades.
- Agentes de IA: cotas OpenRouter, prioridade de custo, pesquisa opcional para clientes e edição das instruções das Skills.
- Perfil: envio de foto própria ou sincronização Google, com o mesmo e-mail verificado. A foto Google atualiza ao recuperar foco e a cada cinco minutos enquanto a aplicação está aberta; a foto enviada manualmente permanece até nova escolha.
- CRM, ficha e conversas usam fotos do contato e iniciais quando o provedor não disponibiliza a imagem.
- Conversas usam a pilha Segoe UI/Helvetica/Arial, balões próximos e tela cheia com saída por Esc.
- Credenciais cadastradas ficam recolhidas atrás de edição explícita. Campos de arquivo recebem estilo comum.

## Rotinas

`prontas`: uma mídia por horário; recorrência de 1 a 30 dias, no horário de Brasília. `novidades`: verifica arquivos novos a cada minuto e processa um por passagem do trabalhador. Somente arquivos diretamente na pasta são lidos, até 1000 entradas; JPG, PNG, WebP e MP4 com até 20 MB. A subpasta publicada é criada ao salvar a configuração. As novas rotinas começam sem qualquer configuração ativa; o administrador escolhe contas/horário e marca a ativação.

A legenda usa um modelo com visão, respeitando a política local → gratuito → pago autorizado. Modelos locais precisam declarar a capacidade de visão; o modelo local de texto existente não é tratado como capaz de interpretar imagens. Para vídeo, a legenda considera uma amostra visual, sem transcrever áudio nem afirmar conteúdo das outras cenas. Pode-se fornecer uma legenda opcional no envio manual. O MP4 é preservado por remux, sem corte silencioso da duração. A compatibilidade final é validada pela rede/Zernio.

O envio usa uma chave idempotente estável e uma única requisição com todas as contas selecionadas. A pasta de origem só muda após a Zernio confirmar `published` em cada conta. Confirmação pendente aguarda consulta; falha parcial ou resposta incerta fica visível e não volta à fila automaticamente. Se mover o arquivo falhar depois da publicação, somente a movimentação é repetida. Falhas comprovadamente anteriores ao envio permitem nova tentativa explícita. Pausar bloqueia envios que ainda não ultrapassaram a transição de envio externo; o que já foi enviado precisa ser acompanhado na Zernio.

Avisos na aplicação mostram conexões WhatsApp indisponíveis/desatualizadas, cota de IA baixa e pastas ativas com até duas mídias restantes. Esses avisos são da aplicação; não foi adicionada entrega de alertas de marketing por e-mail ou WhatsApp.

## Conexões e limites externos

O WhatsApp é conferido periodicamente, com lease de banco, além de aceitar eventos `session.status` assinados pelo token existente. Sessões reconectadas passam a assinar esse evento; a verificação periódica também cobre sessões antigas. Falha de consulta exibe estado desconhecido e horário de conferência, em vez de manter uma conexão verde indefinidamente.

O usuário Instagram vem de username válido ou profileUrl, nunca do nome civil/da empresa. A foto Instagram pode ser recuperada dos dados de participante retornados pela Zernio; há fallback para a foto anteriormente recebida no webhook. Se a Zernio/Meta não disponibilizar esses campos, a aplicação não consegue inventá-los. A disponibilidade precisa ser validada com a conta real após implantação.

A API OpenRouter `/key` fornece cota gratuita, limite da chave e orçamento efetivo quando disponíveis. O limite da chave não é o saldo da conta. `/credits` exige chave de gerenciamento segundo a documentação atual; a aplicação não solicita essa credencial mais ampla. Quando a chave não informa saldo, mostra essa limitação e acesso ao painel do provedor. Incidentes HTTP 402/429 ficam visíveis por até uma hora na réplica que observou a falha. Os preços atuais do catálogo ordenam os modelos já autorizados quando disponíveis; não há troca para um modelo pago sem consentimento da política.

O compartilhamento de pesquisa com clientes é opcional por empresa e exige `web.research` no agente. Usa SearXNG próprio. O cadastro da chave OpenRouter continua por empresa, protegida pelo mecanismo existente. Não há assinatura ou compra automática de créditos.

## Skills e permissões

As instruções de negócio de cinco Skills são apresentadas em Agentes de IA: legenda de mídia pronta, pasta prontas, pasta novidades, nome de preferência e normalização de documento. OWNER/ADMIN/MANAGER podem ler e editar as instruções conforme as permissões já existentes; publicar mídias e configurar pastas permanece restrito a OWNER/ADMIN. As instruções de legenda são usadas na criação. Regras estruturais como autorização, normalização e antirrepetição são implementadas no código e não podem ser desativadas por texto editável. Skills arbitrárias novas continuam como rascunho, sem execução de código.

## Docker, implantação e validação

Reutiliza os Dockerfiles multi-stage, FFmpeg/sharp e volume `AUTOMATION_MEDIA_PATH` existentes. Aplica a migração aditiva `20261027180000_publication_folders_profiles` antes de iniciar a nova API. Não remove colunas nem altera segredos ou instâncias de IA.

CI: validação Prisma, testes unitários API/web, compilação, regressões PostgreSQL e containers existentes. `prepared-concurrency.cjs` usa somente banco local isolado em CI e provedores simulados: verifica dois trabalhadores, pausa durante preparação, confirmação antes da movimentação e retomada de movimentação sem repostagem. A validação visual local usa dados fictícios, sem publicar ou consultar clientes reais.

## Fontes dos contratos externos

- OpenRouter, cotas: https://openrouter.ai/docs/api/reference/limits
- OpenRouter, saldo e restrição de chave: https://openrouter.ai/docs/api/api-reference/credits/get-remaining-credits
- Zernio, contas: https://docs.zernio.com/accounts/list-accounts
- Zernio, conversa: https://docs.zernio.com/messages/get-inbox-conversation
- Zernio, postagem para várias contas e falhas parciais: https://docs.zernio.com/posts/create-post
- WAHA, eventos de sessão: https://waha.devlike.pro/docs/how-to/events/
