# Escopo operacional aprovado — Véxora

O proprietário aprovou enxugar código, banco e serviços para concluir a plataforma de atendimento.

Manter: WhatsApp e chat no site; atendimento com bot/IA e transferência humana; empresas/equipes/permissões; CRM/pipelines; tarefas; agenda; Asaas/cobrança; relatórios operacionais; Marketing com marca, referências, rascunhos, revisão manual, planejamento editorial e download.

Retirar: telefonia, SMS, campanhas em massa/e-mail, anúncios pagos, WordPress, vídeo automático e publicação social automática/recorrente. Não retomar expansões verticais, troca de motores, integrações adicionais ou BI livre antes do aceite do núcleo.

## Limpeza autorizada
Excluídos arquivos de campanhas/e-mail, gateways, renderização de vídeo, filas de Marketing e publicação automática, juntamente com dependências exclusivas e tabelas aposentadas. Histórico de criações/pesquisas de Marketing e mídias geradas são removidos na atualização. Marcas, referências, contatos, conversas, pagamentos e permissões permanecem.

A migração é transacional. Uma limpeza única da pasta privada remove apenas arquivos com os padrões de nomes usados pelos geradores antigos; não segue links simbólicos nem toca em arquivos de origem. Não apaga arquivos no Google Drive nem cancela publicações já aceitas por provedores externos.

Ollama/Speaches ficam em perfil opcional local-ai, PgAdmin em maintenance, e FFmpeg sai da imagem da API. Isso não comprova que containers antigos já foram desligados: conferir a implantação e medir o consumo.

## Agenda no atendimento
Janela para consultar compromissos e agendar com o cliente atual, seguida de confirmação revisada na conversa. Não usar ausência de eventos em uma agenda como disponibilidade universal de toda a empresa.

## Chat no site
Mantido explicitamente no núcleo. A árvore de código consultada não comprovou um widget público completo. Exigir teste visitante → mensagem persistida → resposta → transferência humana antes de marcar como entregue.

## GOWS
Só testar isoladamente depois da estabilização, com outro número e sem alterar a sessão de produção. Medir recursos, reconexão, mídia e duplicações antes de decidir.
