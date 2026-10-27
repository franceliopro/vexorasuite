# Conexões de IA por empresa

Em **Automação → Agentes de IA → Conexões de IA e pesquisa**, OWNER ou ADMIN pode cadastrar uma chave OpenRouter, OpenAI ou Brave Search. O próprio usuário insere e salva a chave no campo protegido; ela não deve ser enviada em chats, commits ou documentos de suporte.

A API autenticada `GET/PUT /assistant/provider-connections` devolve somente o estado de configuração. A presença de uma chave não confirma sua validade, permissões ou saldo; isso é confirmado pelo provedor durante a execução. Não há chamadas de validação nem consumo externo ao salvar.

As chaves ficam em `tenant.integrations.aiProviderCredentials`, cifradas com AES-256-GCM e IV aleatório. A chave de cifragem deriva, com separação de domínio, de `INTEGRATION_ENCRYPTION_KEY` ou do `JWT_ACCESS_SECRET` existente. O tenant e o provedor fazem parte dos dados autenticados: copiar o valor cifrado para outra empresa ou outro provedor não o torna utilizável. Alterar o segredo do servidor exige recadastrar as conexões afetadas. Mantenha-o estável e protegido.

Uma chave da empresa tem prioridade sobre a variável equivalente do servidor (`OPENROUTER_API_KEY`, `OPENAI_API_KEY`, `BRAVE_SEARCH_API_KEY`). As configurações antigas continuam funcionando quando não há chave específica da empresa. Se uma chave da empresa estiver corrompida ou não puder ser aberta, a execução falha, sem usar silenciosamente a chave compartilhada. No chatbot, essa situação encaminha ao humano. Os provedores e destinos de rede continuam fixos no código.

A gravação bloqueia a linha da empresa e mescla o estado atual, incluindo outras conexões e módulos. A auditoria registra apenas o nome do provedor, nunca a chave. As conexões são aplicadas à geração de roteiros/artes, pesquisa, voz e aos blocos de agentes do chatbot. Limites diários e Skills continuam sendo verificados.

O catálogo de modelos fica disponível mesmo sem agentes ou fora da aba Modelos e Voz. IDs de agentes são preservados como strings; novos agentes recebem UUIDs e IDs vazios ou duplicados são recusados. Uma falha ao carregar a configuração impede salvar valores iniciais por cima dos dados existentes.

Validação: regressões de cifragem, isolamento por empresa/provedor, estado sem exposição de segredos, autorização, persistência, escolha da chave de execução, pesquisa, voz e IDs. A regressão em PostgreSQL grava três conexões e uma configuração de outro módulo simultaneamente e verifica a preservação dos quatro resultados.
