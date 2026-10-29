# Assistente de escrita e editores de contexto

Referência de produto: https://www.chatwoot.com/captain e https://www.chatwoot.com/features/auto-translate (consultadas em 28/10/2026, horário de São Paulo). As imagens fornecidas pelo proprietário orientam a hierarquia, a barra de formatação, as bordas, o espaçamento e os estados das janelas; a interface utiliza identidade e temas da Véxora.

## Capacidades adaptadas

| Referência Captain | Véxora |
| --- | --- |
| Assistente com conhecimento e transferência humana | Motor e agentes existentes; exige fluxo publicado e canal real vinculado. A prévia não ativa o canal. |
| Melhorar e traduzir respostas | Copilot no Atendimento, por clique, usando a configuração e política de custo da empresa. |
| Tradução de mensagens recebidas | Botão Traduzir na mensagem pública. O original é preservado. |
| Sugestão contextual | Até 12 mensagens públicas recentes do atendimento e conhecimento da própria empresa. |
| Memórias e resumos | Resumo proposto para revisão e salvamento explícito como nota interna; não cria memória automática global. |
| FAQs inteligentes, busca semântica, monitoramento | Não são declarados implementados por esta entrega. Exigem indexação, revisão editorial e escopo de acesso próprios; são candidatos para evolução. |
| Tradução automática contínua | Não habilitada globalmente. Cada ação é solicitada pelo atendente para manter controle de cota e revisão. |

## Fluxo de escrita

O ícone da assistente junto ao compositor abre uma janela com ações Melhorar texto, Traduzir rascunho, Sugerir resposta e Resumir atendimento. A equipe escolhe o idioma e o tom. O resultado é uma prévia: Usar no rascunho substitui o texto apenas por ação explícita; Enviar esta versão usa o envio normal do atendimento e seu status real. Se o rascunho foi alterado após a geração, o envio direto fica desabilitado até revisar/gerar novamente. A tradução de mensagem recebida é somente para leitura. Resumos são salvos somente como notas internas por botão próprio.

Não há envio causado pela geração de texto. As chamadas usam o modelo global e as contingências configuradas, respeitam a política de modelos gratuitos/locais e reservam uma execução do limite diário. A IA precisa estar habilitada na empresa. Há auditoria de operação, modelo, provedor e tokens, sem copiar textos ou credenciais para a auditoria.

A API confere empresa, acesso humano/departamental/participante e reconfere o acesso após gerar. Só usa mensagens INBOUND/OUTBOUND; notas internas não são lidas nem oferecidas como contexto de resposta externa. IDs de mensagens são resolvidos dentro do atendimento e da empresa. Mensagens maiores que 4 mil caracteres são recusadas para tradução integral em vez de silenciosamente truncadas.

## Editor rico

Prompts, regras, restrições, conhecimento da empresa e instruções de Skills usam um editor rico com títulos, negrito, itálico, listas, citação, código, links, desfazer/refazer e edição ampliada. O texto continua armazenado como Markdown nos campos existentes. A opção Texto de origem permite preservar/inspecionar a origem, sem migração destrutiva dos prompts. Contagem e limites seguem os limites da API.

O componente usa Tiptap e a extensão oficial Markdown. As janelas compartilham cabeçalho, ícone, hierarquia, espaçamento, rolagem, foco contido, Escape, retorno de foco e layout responsivo. A camada visual também é aplicada às janelas internas existentes de transferência, ações rápidas, perfil e notificações.

## Validação

Testes de geração sem envio, isolamento por atendimento e empresa, notas privadas fora do contexto, acesso revogado, idioma/ação inválidos e limite diário. O editor tem testes reais de reabertura do conteúdo com variáveis, formatação e rejeição de script/link executável. CI de API/web, migrações, regressões PostgreSQL e imagens de implantação antes de mesclar.

A mesclagem da PR anterior #196 não comprova implantação desta nova entrega.
