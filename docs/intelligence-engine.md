# Véxora Intelligence Engine

Execução operacional por regras e Skills antes de modelos. Esta entrega conecta o editor ao runtime e adiciona pesquisa, carrosséis, publicação/agendamento e relatórios à assistente. A implementação exige testes de ponta a ponta com as contas autorizadas antes de habilitar canais de produção.

## Caminhos de execução

| Pedido / evento | Executor | Tokens de LLM |
|---|---|---|
| Menu, escolhas, entrada de texto, condição, variável | Runtime determinístico | 0 |
| Aplicação de etiqueta no contato da conversa | Skill CRM | 0 |
| Transferência para equipe ativa da mesma empresa | Skill atendimento | 0 |
| Consulta e envio de boleto/PIX de cobrança existente | Diálogo Asaas já implementado, com verificação de telefone | 0 |
| Resumo de desempenho, PDF com gráfico e CSV | Módulo Inteligência Operacional + exportador | 0 |
| Relatório financeiro PDF/CSV | Módulo Financeiro; Asaas quando configurado, dados locais quando indisponível por configuração | 0 |
| Pesquisa web | Brave Search API, cache de 15 minutos por empresa | 0 |
| Roteiro, título e legenda de carrossel | Modelo configurado mais econômico | Limitados pelo contexto e teto de saída |
| Artes PNG de carrossel | Template SVG + Sharp | 0 |
| Publicar agora ou agendar | Zernio | 0 |
| Conversa livre em bloco Agente de IA | Agente configurado + histórico limitado da própria conversa | Limitados |

Zero tokens de LLM não significa que serviços externos não tenham cobrança própria.

## Publicação do chatbot

`PUT /chatbot/draft` salva modelagem. `POST /chatbot/runtime/publish` valida o último rascunho e cria um snapshot com revisão. Alterações no rascunho não modificam o publicado. Apenas OWNER e ADMIN publicam/pausam; os canais devem pertencer ao tenant e estar ativos. `POST /chatbot/runtime/stop` pausa o motor inclusive o menu legado nos canais vinculados. Respostas já em trânsito podem terminar.

Blocos executáveis: `text`, `buttons`, `input.text`, `variable`, `condition`, `tag`, `human.handoff`, `assignment`, `asaas.payment.lookup`, `agent`. Blocos de API genérica, espera, conclusão, mídias e ações financeiras individuais ainda não implementados impedem publicação. Eles não são interpretados silenciosamente como operações concluídas.

Configurações JSON nos blocos:

- Entrada: `{"variable":"solicitacao"}`; exatamente uma saída de continuação.
- Variável: `{"variable":"setor","value":"FINANCEIRO"}`; uma saída.
- Condição de igualdade exata: `{"variable":"setor","value":"FINANCEIRO"}`; saídas `Sim` e `Não`.
- Etiqueta: `{"name":"Novo Lead","color":"#5865da"}`; uma saída.
- Transferência: `{"departmentKey":"FINANCEIRO_CEEB_VISION"}`. A equipe precisa existir e estar ativa. Sem destino explícito, usa contexto disponível ou fila geral; nunca busca equipes de outra empresa.
- Agente: `{"agentId":"1"}`; deve estar habilitado na configuração da empresa com modelo suportado. O agente responde, sem ferramentas arbitrárias; operações continuam nas Skills.

O modelo Rastreabem separa plataformas e equipes. Não cria equipes fictícias. Comercial/Administrativo exigem destinos configurados; contatos externos comerciais específicos precisam ser definidos conforme a operação, e não são inventados pelo modelo.

## Estado, concorrência e entrega

Estado na conversa, auditoria e respostas QUEUED são persistidos na mesma transação, com lock de banco por conversa. Eventos repetidos não repetem decisões. Mensagens ainda não reivindicadas podem ser retomadas pelo replay do evento. Cada entrega tem reivindicação exclusiva em banco. Transferência para humano, operador atribuído, arquivo/lixeira e finalização são respeitados antes de enviar.

Falhas de transporte ficam FAILED. Se o processo cair depois de reivindicar uma mensagem ou durante o envio, a entrega fica pendente de verificação; não existe retentativa cega de WhatsApp nem garantia de entrega exatamente uma vez. Um worker de reconciliação e testes com múltiplas réplicas continuam necessários para uma operação de grande escala.

## Assistente por texto e ditado

O painel oferece ditado por clique via API de reconhecimento de voz do navegador, quando disponível; não há escuta contínua. A transcrição preenche o campo para revisão/envio. Compatibilidade e processamento dependem do navegador.

Exemplos:

- `Resumo do desempenho dos atendentes deste mês em PDF e CSV`
- `Relatório financeiro de 2026-10-01 a 2026-10-27 em PDF`
- `Pesquise na internet sobre manutenção preventiva de rastreadores`
- `Crie um carrossel sobre manutenção preventiva de rastreadores`
- `Crie um carrossel sobre manutenção preventiva e publique agora`
- `Crie um carrossel sobre manutenção preventiva e publique amanhã às 15:00`

Pedidos explícitos de publicação executam automaticamente quando existe uma única conta elegível ou o nome identifica uma única conta. Horários simples `hoje/amanhã às HH:MM` usam Brasília. Com múltiplas contas ou horários ambíguos, o painel permite selecionar conta e horário. Datas agendadas são validadas: mínimo de 1 minuto, máximo de 90 dias; datas passadas não viram publicação imediata.

As artes são templates, não ilustrações geradas por modelo. A última lâmina de CTA é determinística. O conteúdo usa trechos de pesquisa com fontes; a pesquisa não equivale à leitura integral ou verificação editorial de todos os artigos.

## Relatórios e permissões

Relatórios gerenciais e publicação são restritos a OWNER/ADMIN. PDF e CSV derivam do mesmo snapshot persistido no banco e exigem autenticação e tenant correto no download. PDF inclui gráfico vetorial e tabela. CSV tem BOM UTF-8, separador `;`, escaping e neutralização de fórmulas em campos de texto.

Períodos: hoje, ontem, últimos 7/30/90 dias, mês atual, mês passado ou duas datas ISO. Padrão: últimos 30 dias. O relatório declara fonte, período, ambiente sandbox/produção e limitações. Atendimento usa responsável atual e conversas criadas no período, não uma medição histórica de produtividade individual. Financeiro local não representa a carteira completa Asaas. Falha numa consulta Asaas ao vivo não é silenciosamente substituída por dados locais.

## Configuração e custos

- `BRAVE_SEARCH_API_KEY`: pesquisa web direta. Sem chave, a pesquisa/carrossel informa indisponibilidade; não simula resultados.
- `OPENROUTER_API_KEY` e/ou `OPENAI_API_KEY`: geração de texto nos provedores atualmente suportados.
- Modelo econômico e até dois modelos de contingência na configuração da assistente. A ordem respeita os perfis configurados; não estima automaticamente o preço real ou a qualidade de um modelo. Os seguintes só executam se o anterior falhar, retornar vazio ou violar o formato validado. Máximo de três tentativas, contexto limitado e teto de saída de até 2 mil tokens por chamada.
- `ZERNIO_API_KEY`: conexão já existente. Contas Instagram/Facebook devem estar vinculadas ao tenant e conectadas.
- `API_PUBLIC_URL`: origem HTTPS pública da API, sem `/api` final. A Zernio precisa acessar as artes nessa origem.
- `INTEGRATION_ENCRYPTION_KEY` ou `JWT_ACCESS_SECRET`: assinatura das URLs de mídia. URLs assinadas por tenant, automação, índice e validade; sete dias após o horário agendado. Não há endpoint público de arquivos arbitrários.
- Docker instala fontes DejaVu para rasterização consistente das artes.

O scheduler da Zernio é usado diretamente; não é preciso manter timers do frontend nem chamar LLM no horário da postagem. A API usa a mesma chave de idempotência por publicação e claim em banco. Resultado externo conserva o status real, inclusive falha/parcial. Timeout ou resposta ambígua muda para NEEDS_RECONCILIATION; não permite repostagem automática. O operador deve consultar a Zernio antes de nova tentativa. Uma interface de reconciliação/listagem completa ainda é necessária.

## Validação e limites atuais

Testes automatizados cobrem validação de publicação, isolamento/roles, duplicação, transferência humana, estado de input, geração PDF/CSV/PNG, formato do modelo, ordem econômica, agendamento, idempotência e falhas ambíguas. Build e checagem de tipos de API/web são verificações locais; não comprovam entrega real em WhatsApp, Meta/Zernio ou consulta Asaas de produção.

Antes do rollout: validar destinos reais Rastreabem, cadastrar segredos no servidor, testar uma conta social autorizada, testar cobrança sandbox com identidade correta/incorreta, confirmar download dos arquivos na sessão e verificar métricas de tokens/custos do provedor. Limites diários por tenant, scheduler interno genérico, worker de reconciliação, criação de cobrança nova, ferramentas arbitrárias de agentes, publicação em outras redes e agendamentos empresariais com escrita ainda não fazem parte desta entrega.

Referências de integração: https://docs.zernio.com/posts/create-post · https://docs.zernio.com/platforms/instagram/posts · https://api-dashboard.search.brave.com/api-reference/web/search/get
