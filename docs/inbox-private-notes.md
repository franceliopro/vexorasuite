# Chat interno e contexto de transferência

O Atendimento oferece um ícone de chat interno junto às ações da mensagem. Digitar ## no início da resposta abre o campo interno e move o texto para ele. O rascunho interno é independente do rascunho da resposta ao cliente e é descartado ao trocar de conversa, evitando envio ao contato errado.

As notas são mensagens INTERNAL persistidas no mesmo atendimento, com autor, data e auditoria. Somente usuários com acesso ao atendimento podem consultá-las ou escrevê-las. A consulta retorna as últimas 100 notas, em ordem cronológica; o painel se atualiza a cada cinco segundos. O cliente não recebe notas: a operação não chama WAHA, Zernio nem fila de saída. O histórico de atendimento identifica todas as mensagens internas explicitamente. A IA de atendimento continua usando apenas INBOUND/OUTBOUND, sem incorporar notas privadas ao prompt.

A transferência aceita um contexto opcional e grava o novo responsável/departamento, a nota e a auditoria na mesma transação, antes do evento de atribuição. A nota acompanha o histórico para quem recebe o atendimento. O acesso é reconferido sob bloqueio da conversa para evitar escrita após perder acesso. Transferências e notas respeitam o escopo de empresa e as regras de visibilidade humana existentes.

Quando o setor usa outro número, o atendente pode informar esse WhatsApp na transferência e preparar uma mensagem com link wa.me para revisar e enviar pelo campo público. Essa ação não envia automaticamente, não troca o canal da conversa e não inicia outra conversa com o cliente. O telefone é informado pelo operador; não há associação automática entre número e departamento nesta entrega.

Este chat é vinculado ao atendimento: não é um mensageiro independente entre funcionários As menções @ oferecem uma lista de atendentes e mostram quem será incluído antes do envio. Ao enviar, o servidor valida IDs, vínculo ativo na mesma empresa e acesso atual do autor; grava os participantes INVITED, a nota e a auditoria na mesma transação. A pessoa passa a ver o atendimento em Participando, sem trocar o responsável. Menções não concedem acesso ao módulo e são recusadas enquanto o atendimento está em BOT.

Validação: testes de privacidade (nenhuma chamada externa), autoria/auditoria, autorização por empresa/atribuição, conversas arquivadas/excluídas, contexto inválido e persistência transacional da transferência. Executar CI de API/web antes de mesclar. Implantação e envio real a clientes não são comprovados apenas por estes testes.

## Menções e identidade da equipe

Cada menção cria um recibo persistente por usuário, empresa, mensagem e conversa. O ícone @ no topo da aplicação lista as menções e conta as não lidas; um aviso na tela oferece abrir o atendimento com o chat interno aberto. Eventos atualizam o painel e há consulta periódica como contingência. Ao abrir, o recibo é marcado como lido. O servidor filtra novamente os atendimentos acessíveis; perder o acesso remove a menção da lista. A entrega de push ao sistema operacional não faz parte deste aviso dentro da aplicação.

O cadastro de atendentes inclui Conhecido por, editável também na lista. O valor fica no vínculo da empresa (Membership), preservando o nome completo da conta e permitindo identidades independentes em empresas distintas. O nome de atendimento é utilizado na sessão, equipe, seleção de atendentes, responsável da conversa, autoria das novas mensagens e notas, e na variável {{atendente}} tanto nas respostas rápidas quanto no motor. O cabeçalho e as mensagens mostram o nome e o departamento em negrito menor. Autoria/departamento são preservados nas novas mensagens para não reescrever o histórico ao transferir.

A migração adiciona memberships.known_by e internal_mentions com índices por destinatário/empresa e unicidade por mensagem/destinatário. Nenhum canal externo é chamado para notificações de menção na tela.
