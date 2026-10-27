# Comunicações, Workflows e experiência da Véxora

## 🏗️ Arquitetura e Modelagem da Solução

O módulo nativo de comunicações integra o atendimento ao CRM existente. Cada conta, modelo, campanha, destinatário, rotina e execução pertence a uma empresa. A administração prepara as campanhas como rascunho e confirma o início dos envios. As rotinas são criadas pausadas.

As esperas ficam no PostgreSQL. Dois processos podem trabalhar simultaneamente usando bloqueios de linha e SKIP LOCKED. Envios externos sem confirmação ficam para revisão e não são repetidos automaticamente. A aceitação SMTP/SMS não significa entrega ou leitura.

## 🛠️ Stack Tecnológica Recomendada

A aplicação mantém Next.js/React, NestJS, Prisma e PostgreSQL. SMTP usa Nodemailer, IMAP usa ImapFlow e Mailparser. As credenciais de e-mail são cifradas com AES-GCM, vinculadas à empresa e à conta. O servidor valida e fixa o endereço público dos servidores SMTP/IMAP e exige TLS. O HTML é limpo com sanitize-html 2.18.1; scripts e CSS executável não são aceitos. O editor oferece texto visual, imagens HTTPS e edição do HTML com estilos permitidos.

## 💻 Implementação do Código (Pronto para Produção)

### Onde encontrar

- **Marketing → E-mails**: caixa de entrada, sincronização IMAP manual, respostas em rascunho, modelos, campanhas e felicitações.
- **E-mails → Felicitações**: consultar aniversariantes ou aniversários de parceria por mês. As datas são preenchidas no perfil do contato. Selecionar um público não inicia envios.
- **Automação → Workflows**: rotinas, publicações e execuções. Gatilhos: horário, nova conversa, fila sem responsável ou etapa do CRM. Etapas: espera, tarefa, nota, etiqueta e mensagem WhatsApp na própria conversa. Rotinas por horário criam tarefas internas; mensagens exigem um gatilho de conversa.
- **Configurações → Atendimento**: saudações e despedidas por faixa de horário, usadas nas respostas rápidas através de {{saudacao}} e {{despedida}}.
- **Atendimento**: “Continuar no WhatsApp” recebe o telefone internacional fornecido pelo cliente, abre o atendimento WhatsApp no mesmo painel e registra vínculos internos para o histórico. A primeira mensagem é revisada e enviada pelo atendente. Informar um telefone não comprova identidade financeira.
- **Google Drive**: grade com miniaturas reais, ícones pequenos e lista; as permissões existentes controlam as alterações.
- **Referência Criativa**: remover da biblioteca e desfazer a remoção. O arquivo original do Drive não é apagado por essa ação. A restauração mantém a referência pausada para revisão.

### Limites explícitos

O IMAP importa até 20 mensagens recentes por sincronização manual, de até 2 MB cada, sem anexos. Campanhas permitem até 500 destinatários selecionados e enviam individualmente. Não há rastreamento de abertura, tratamento automático de bounces ou busca de caixas IMAP além da INBOX nesta etapa.

Cada conversa entra uma vez por rotina. A sequência pode parar quando o cliente responde ou quando a conversa é encerrada, arquivada ou excluída. O início e a repetição usam o fuso escolhido; esperas são durações. Janelas comerciais por dia da semana, editor visual de condições com ramificações e conectores genéricos MCP não foram implementados nesta entrega.

A fonte das conversas usa a família da interface (DM Sans), sem forçar Segoe. O menu lateral foi ampliado, o espaço vertical da busca mobile do CRM reduzido e a criação/publicação passou a priorizar resultado, estado e ações. Prompts internos, identificadores e detalhes técnicos não aparecem nas listas de resultados.

A PWA já dispõe de instalação, ícones, página sem conexão e atualização do service worker. Dados privados e respostas da API não são armazenados no cache offline. A instalação efetiva depende do navegador e do aparelho.

## 🐳 Infraestrutura, Docker & Deploy (Foco Dokploy)

A implantação utiliza os Dockerfiles multi-stage existentes. A migração `20261027220000_communications_workflows` é aditiva. O processo de inicialização aplica as migrações antes de iniciar a API.

É necessário manter `INTEGRATION_ENCRYPTION_KEY` estável, com o fallback atual em `JWT_ACCESS_SECRET`, e `PUBLIC_APP_URL` com a origem HTTPS pública. A rotação da chave de cifra exige reconectar as contas. SMTP/IMAP são conectados na interface por empresa com senha de aplicativo; nenhum serviço de e-mail foi contratado automaticamente.

### SMS e telefonia econômica

Jasmin é o adaptador de SMS; Asterisk ARI origina uma chamada que toca primeiro no ramal do atendente e depois disca o contato. Os gateways são provisionados pelo operador, com rotas distintas por empresa. A interface não permite escolher URLs arbitrárias nem mostra senhas. Solicitações possuem chave de idempotência e auditoria.

Configuração do operador, sem valores reais no repositório:

- `JASMIN_BASE_URL`: origem do gateway privado. `JASMIN_TENANT_ROUTES`: JSON indexado pelo UUID da empresa, com `username`, `password` e `from` opcional.
- `ASTERISK_ARI_URL`: URL base do ARI, incluindo `/ari`. `ASTERISK_ARI_USERNAME` e `ASTERISK_ARI_PASSWORD`: credenciais do gateway. `ASTERISK_TENANT_ROUTES`: JSON por UUID da empresa, com `agentEndpoint` autorizado e `context` restrito de saída.

O operador deve isolar os gateways na rede privada e provisionar os ramais/rotas por empresa. O software aberto não elimina tarifas de operadora. Sem rotas configuradas, SMS e ligações permanecem indisponíveis. Não houve chamadas nem SMS reais nos testes.

Chamadas ao vivo pelo WhatsApp, gravação e agente de voz por IA permanecem pendentes de implementação e configuração de mídia/telefonia. O conector WhatsApp pronto do LiveKit é exclusivo do LiveKit Cloud; o SIP/Agents pode ter outra arquitetura. WAHA e whatsmeow não tornam esse recurso automaticamente disponível.

## ⚡ Automação e Otimizações Futuras

Comparação com HelenaCRM: a Véxora passa a separar automação interna de criação e publicação de marketing, com espera persistida, filas, etapas do CRM e acompanhamento de execuções. Permanecem como evolução: canvas visual com condições/ramificações, calendário de janelas úteis e ferramentas MCP. A interface evita apresentar essas possibilidades como recursos ativos.

Prioridade definida pelo usuário: concluir este escopo antes de experimentar o motor GOWS. O teste posterior deve ocorrer separado da sessão de produção, comparando consumo, reconexão, mídias e recebimento sem duplicar disparos.

### Fontes consultadas

- [HelenaCRM — Chatbot](https://www.helenacrm.com/chatbot-white-label)
- [n8n — Wait](https://docs.n8n.io/integrations/builtin/core-nodes/n8n-nodes-base.wait/)
- [Listmonk — modelos](https://listmonk.app/docs/templating/)
- [Nodemailer — licença](https://nodemailer.com/license)
- [ImapFlow — instalação](https://imapflow.com/docs/getting-started/installation/)
- [Jasmin — HTTP API](https://docs.jasminsms.com/en/latest/apis/http/index.html)
- [Asterisk — ARI](https://docs.asterisk.org/Configuration/Interfaces/Asterisk-REST-Interface-ARI/)
- [LiveKit — WhatsApp](https://docs.livekit.io/telephony/connectors/whatsapp/)
- [Gammu — SMSD](https://docs.gammu.org/smsd/overview.html)
