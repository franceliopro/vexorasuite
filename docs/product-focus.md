# Foco da Véxora — avaliação de escopo

Decisão autorizada: retirar telefonia, chamadas ao vivo WhatsApp e chamadas por IA do produto atual. Preservar áudios em mensagens, transcrição, dados e históricos. Demais cortes abaixo são recomendações, não desativações autorizadas.

## 🏗️ Arquitetura e Modelagem da Solução

O núcleo é atendimento com CRM, bot/IA supervisionada, equipes, empresas isoladas e cobrança conectada. O risco de prazo está em desenvolver simultaneamente uma central de atendimento, plataforma financeira, agência de marketing, editor de vídeo e central telefônica.

Manter os 14 modelos como configurações iniciais. Aprofundar somente Rastreamento veicular e Escola de músicas e instrumentos após validar o primeiro cliente. Segmentos não devem virar sistemas clínicos, escolares, delivery ou ERP completos.

## 🛠️ Stack Tecnológica Recomendada

Preservar Next.js, NestJS, Prisma e PostgreSQL existentes. Não trocar o motor WhatsApp, criar aplicativo nativo ou introduzir microsserviços nesta fase. Reduzir a quantidade de provedores ativos por capacidade e validar um caminho real antes de ampliar opções.

## 💻 Implementação do Código (Pronto para Produção)

Prioridade: recebimento e resposta confiáveis, mídia básica, transferência humana, fila recuperável, notificações por atribuição, isolamento, permissões e sincronização financeira.

Marketing recomendado: marca, referências, biblioteca de artes/textos, calendário editorial, preparação e aprovação manual, download/exportação. Preservar conectores existentes; congelar expansão de publicação social, campanhas em massa, anúncios pagos e vídeo automático. Nada disso é removido por esta decisão de telefonia.

Financeiro recomendado: Asaas como fonte do pagamento e a Véxora como operação de cobrança. Evitar contabilidade, conciliação bancária universal, múltiplos gateways e negociação autônoma pela IA nesta fase.

Relatórios: volume, filas, tempo de resposta, pendências e cobranças confirmadas. Adiar BI livre e atribuição multicanal sofisticada.

## 🐳 Infraestrutura, Docker & Deploy (Foco Dokploy)

Telefonia é removida da interface, endpoint e variáveis Asterisk dos arquivos de implantação. Não há remoção de tabelas ou históricos, cancelamento de serviços externos nem alteração do ambiente antigo. Usar a CI e os containers existentes. CI aprovada não confirma implantação em produção.

## ⚡ Automação e Otimizações Futuras

Congelar expansão de SMS, WordPress, IMAP completo, sincronização Google bidirecional ampla, múltiplos motores/provedores de IA, geração automática de vídeos e anúncios pagos.

Dependências continuam existindo: disponibilidade e sessões WhatsApp; confirmação e webhooks Asaas; consentimento e permissões Google; permissões e limites das redes via Zernio; custos e disponibilidade de provedores de IA. Concentrar esforço em diagnóstico, recuperação e limites, sem prometer controle sobre o provedor.

Critério de retomada: caminho do cliente real testado de ponta a ponta, falhas recuperáveis, restauração de backup exercitada e equipe usando o produto antes de ampliar escopo.
