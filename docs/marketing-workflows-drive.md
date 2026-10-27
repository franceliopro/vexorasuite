# Marketing, workflows, voz e Google Drive

## Caminho operacional

Em Marketing → Criações, o Estúdio recebe tema, formato (post, carrossel ou vídeo), destino e horário. A assistente Véxora usa a mesma fila ao receber pedidos de criação. O worker revalida o acesso do usuário, sincroniza a pasta, pesquisa pelo Brave, gera o roteiro com os modelos configurados e renderiza as artes sem modelo de imagem. Vídeos são apresentações verticais MP4 H.264/AAC de 12 a 42 segundos, renderizadas com FFmpeg; narração é opcional e exige TTS configurado.

Referências são arquivos diretamente dentro da pasta selecionada. A leitura das imagens extrai paletas e utiliza as orientações cadastradas no briefing; isso não equivale a redesenhar automaticamente a composição ou a gerar cenas cinematográficas. Não há cópia automática dos originais para publicações. Subpastas não são percorridas. São aceitas até 100 referências de 20 MB; falhas de leitura impedem a publicação automática daquele trabalho.

Uma solicitação pode produzir rascunho, publicação imediata ou agendamento na Zernio. A preferência por publicar automaticamente é explícita, por empresa. Se houver mais de uma conta elegível, é preciso indicar um destino único. Um pedido de rascunho prevalece sobre a preferência automática. Nenhum modelo pode escolher outra conta ou ultrapassar as permissões do usuário.

Exemplos para a assistente:

- “Crie um carrossel sobre segurança veicular e publique.”
- “Crie um post sobre manutenção preventiva como rascunho.”
- “Crie um vídeo curto sobre atendimento amanhã às 14:30.”
- “Crie um workflow semanal de carrossel sobre segurança amanhã às 14:30.”

O horário dos comandos e da interface é Brasília. Para datas diferentes, o pedido aceita uma data ISO com fuso explícito. No workflow, o horário dispara a pesquisa/criação; a publicação ocorre ao concluir. Recorrência diária, semanal ou de até 30 dias, sem reposição automática de todos os horários perdidos durante uma indisponibilidade.

## Fila e recuperação

`marketing_jobs` e `marketing_workflows` têm vínculo à empresa. Pedidos com a mesma chave geram um só trabalho. Claims usam bloqueio PostgreSQL e SKIP LOCKED; duas instâncias não devem executar o mesmo trabalho. Cada instância processa um trabalho por vez, com heartbeat durante a execução. Trabalhos sem heartbeat há dez minutos ficam NEEDS_REVIEW; não são reenviados automaticamente. Submissões ambíguas da Zernio ficam NEEDS_RECONCILIATION na criação. Conferir o provedor antes de repetir.

Os vídeos ficam no volume `automation_media`, em caminhos derivados de UUIDs. A mídia disponibilizada ao provedor é uma criação assinada com prazo de validade. Originais do Drive e tokens OAuth não são tornados públicos. Todos os processos que servem mídia precisam compartilhar o mesmo volume; uma implantação em múltiplos hosts exigirá armazenamento compartilhado/objetos. Não há política automática de exclusão de vídeos nesta entrega; monitorar o volume.

## Gerenciador do Drive

Em Marketing → Google Drive: navegar por pastas, ver compartilhados, pesquisar na localização atual, criar pastas, upload/download até 20 MB, renomear, mover, lixeira e restauração. Documentos nativos são exportados como PDF. Há paginação e validação de permissões por conexão e empresa. Alterações são auditadas. Não existe endpoint de exclusão permanente.

O acesso `drive.file` anterior só permite arquivos autorizados para a aplicação. A autorização “biblioteca” solicita `drive.readonly` além de `drive.file`, para leitura da pasta. A autorização “gerenciamento” solicita `drive`, para operar arquivos já existentes. Essas ampliações requerem consentimento Google. O administrador deve escolher a conta correta. Não é necessário alterar credenciais OAuth ou tornar a pasta pública.

## Agentes e voz

Novos agentes partem de modelos de Atendimento, Marketing ou Financeiro, com Skills explícitas. Herança do modelo principal e configuração STT/TTS aparecem na interface. LLMs implementados: OpenRouter e OpenAI. Voz: navegador por clique ou OpenAI no servidor. Não se deve preencher chaves em campos de endpoint ou de prompt.

STT por arquivo retorna o texto para revisão e envio; não executa silenciosamente a transcrição como comando. TTS é acionado por “Ouvir resposta”, identificado como voz sintética. Chamadas cloud de voz reservam orçamento diário antes do transporte; o limite zero bloqueia modelos. Não há escuta contínua. O runtime de atendimento continua distinguindo automações determinísticas dos blocos de agente; isso não habilita ferramentas arbitrárias por um prompt personalizado.

## Transferência humana e editor

Os blocos de transferência exibem o destino: fila geral, time, atendente ou roteamento por setor/plataforma. Destinos individuais são validados na publicação e na execução, incluindo vínculo ao time quando selecionado. Se o destino for revogado, a conversa vai para fila geral com indicação explícita no texto e na auditoria. O envio da confirmação usa a atribuição capturada; uma tomada posterior por outra pessoa bloqueia respostas atrasadas.

O campo “Opções de saída” preserva todas as quebras durante a digitação. A normalização de linhas vazias ocorre ao perder foco, sem interromper o Enter. Uma opção continua correspondendo a uma linha.

## Implantação e validação

Migração aditiva `20261027060000_marketing_jobs`; volume novo e FFmpeg no container não-root existente. Reverter a aplicação não exige apagar as tabelas ou o volume. Não remover mídia enquanto existir publicação agendada que a utilize.

CI: testes API/interface; migrações; regressões PostgreSQL com duas instâncias do worker; typechecks/builds; containers e renderização real de MP4 dentro do container. Credenciais e operações externas continuam exigindo validação autenticada após deploy. O código não cria uma publicação real apenas para testar sua instalação.

Referências técnicas: [Google Drive — pastas](https://developers.google.com/workspace/drive/api/guides/folder), [pesquisa de arquivos](https://developers.google.com/workspace/drive/api/guides/search-files), [OpenAI — transcrição](https://developers.openai.com/api/docs/guides/speech-to-text), [síntese de voz](https://developers.openai.com/api/docs/guides/text-to-speech), [Zernio — API](https://docs.zernio.com/).
