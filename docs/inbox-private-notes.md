# Chat interno e contexto de transferência

O Atendimento oferece um ícone de chat interno junto às ações da mensagem. Digitar ## no início da resposta abre o campo interno e move o texto para ele. O rascunho interno é independente do rascunho da resposta ao cliente e é descartado ao trocar de conversa, evitando envio ao contato errado.

As notas são mensagens INTERNAL persistidas no mesmo atendimento, com autor, data e auditoria. Somente usuários com acesso ao atendimento podem consultá-las ou escrevê-las. A consulta retorna as últimas 100 notas, em ordem cronológica; o painel se atualiza a cada cinco segundos. O cliente não recebe notas: a operação não chama WAHA, Zernio nem fila de saída. O histórico de atendimento identifica todas as mensagens internas explicitamente. A IA de atendimento continua usando apenas INBOUND/OUTBOUND, sem incorporar notas privadas ao prompt.

A transferência aceita um contexto opcional e grava o novo responsável/departamento, a nota e a auditoria na mesma transação, antes do evento de atribuição. A nota acompanha o histórico para quem recebe o atendimento. O acesso é reconferido sob bloqueio da conversa para evitar escrita após perder acesso. Transferências e notas respeitam o escopo de empresa e as regras de visibilidade humana existentes.

Quando o setor usa outro número, o atendente pode informar esse WhatsApp na transferência e preparar uma mensagem com link wa.me para revisar e enviar pelo campo público. Essa ação não envia automaticamente, não troca o canal da conversa e não inicia outra conversa com o cliente. O telefone é informado pelo operador; não há associação automática entre número e departamento nesta entrega.

Este chat é vinculado ao atendimento: não é um mensageiro independente entre funcionários As menções @ oferecem uma lista de atendentes e mostram quem será incluído antes do envio. Ao enviar, o servidor valida IDs, vínculo ativo na mesma empresa e acesso atual do autor; grava os participantes INVITED, a nota e a auditoria na mesma transação. A pessoa passa a ver o atendimento em Participando, sem trocar o responsável. Menções não concedem acesso ao módulo e são recusadas enquanto o atendimento está em BOT.

Validação: testes de privacidade (nenhuma chamada externa), autoria/auditoria, autorização por empresa/atribuição, conversas arquivadas/excluídas, contexto inválido e persistência transacional da transferência. Executar CI de API/web antes de mesclar. Implantação e envio real a clientes não são comprovados apenas por estes testes.
