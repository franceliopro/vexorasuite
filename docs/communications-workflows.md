# Rotinas operacionais da Véxora

A versão atual mantém Workflows internos com espera persistida, tarefas, notas, etiquetas e mensagens na própria conversa. Filas, atribuição e cancelamento após resposta continuam parte do atendimento.

Campanhas/e-mail, SMS, telefonia, publicação social e vídeo automático foram retirados a pedido do proprietário. Os respectivos controllers, workers, dependências e tabelas foram excluídos. O histórico de criações de Marketing e as mídias geradas também são removidos na atualização autorizada. Referências e arquivos originais no Drive permanecem.

Marketing atual: marca, referências, criação manual de arte/carrossel, revisão/aprovação, planejamento editorial e download. Não há envio automático às redes. Mensagens de atendimento continuam independentes da retirada das publicações.

A implantação aplica a migração transacional e executa uma limpeza única dos arquivos de Marketing gerados conhecidos. A limpeza não segue links simbólicos nem remove arquivos de nome desconhecido. Validar os registros da implantação antes de declarar que o banco e o volume de produção foram limpos.

As rotinas operacionais usam a infraestrutura e os containers existentes. Não há contratação ou cancelamento automático de serviços externos.
