# Pausa e sincronização dos workflows de marketing

Pausar uma rotina cancela seus trabalhos na fila e solicita cancelamento aos que ainda criam conteúdo. Esses trabalhos podem terminar a etapa já iniciada, mas verificam o cancelamento antes de iniciar outra etapa e antes do envio à rede social. O conteúdo já produzido permanece como rascunho no histórico.

`PUBLISHING` identifica o início de um envio externo. A mudança de estado é atômica: cancelamento e envio disputam a mesma linha do trabalho. Depois dessa etapa, a interface orienta conferir a Zernio. Pausar não desfaz publicações ou agendamentos que já foram aceitos pela rede. Uma resposta incerta do provedor exige revisão, sem repetição automática.

O agendador e a pausa usam o mesmo bloqueio de workflow para impedir uma execução nova após a confirmação da pausa. Todas as alterações e contagens são limitadas à empresa e ao workflow. Vínculo do responsável e permissões do agente são verificados novamente antes de publicar. A criação de uma rotina já rejeita um agente que não tenha as Skills necessárias.

O padrão de publicação da empresa é separado da escolha de rascunho/publicação de cada pedido. Atualizar o histórico não deve alterar um formulário em edição.

A sincronização do Drive compara identificação, tipo, tamanho, nome, data de modificação e checksum quando disponíveis. Imagens que não mudaram reaproveitam a análise de paleta. Mudar de pasta/conta invalida o índice. Uma sincronização lenta de uma pasta antiga não pode substituir a pasta atual, desativar suas referências ou sobrescrever a preferência de publicação.

Regressões: cancelamento durante criação, envio já iniciado, retorno incerto do provedor, pausa com filas concorrentes, isolamento por empresa, revogação do agente, workflow sem permissão, imagem inalterada/modificada, falha de análise e mudança de pasta durante a leitura. O CI também exercita a pausa contra PostgreSQL real com dois workers.

## Criação somente com a identidade da empresa

Quando solicitado explicitamente, `useBrandOnly: true` permite criar um post, carrossel ou vídeo com a identidade visual configurada sem consultar o Drive ou usar referências de outras pastas. A interface oferece uma escolha por pedido; a assistente reconhece “sem referências”, “sem imagens do Drive” e “somente/apenas a identidade visual”. Isso não altera a pasta configurada nem a publicação padrão. Pedidos comuns continuam exigindo as referências; uma falha do Drive nunca ativa essa opção silenciosamente. Pesquisa, orçamento, permissão de publicação e renderização continuam sendo verificados.
