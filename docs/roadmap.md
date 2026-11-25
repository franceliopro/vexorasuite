# Roadmap da Véxora (2026-11-23)

Este roadmap mostra direção e prioridade. O estado de cada item com evidência está em `docs/implementation-status.md`, a fonte canônica.

## Fase A — Núcleo e interface [x]

- Monorepo, autenticação tenant-scoped, permissões, auditoria, Inbox, CRM, tarefas, agenda, Financeiro e relatórios com testes e CI.
- Temas Slate, Claro e Híbrido alinhados ao mock de referência; ajustes de Agentes, Relatórios, Tarefas e relógio claros.
- Aceite externo (aparelho, provedores e ambiente publicado) continua separado do código entregue.

## Fase B — Serviço de Sites [em andamento]

- HUB da Véxora para pedido, preview, aprovação, versão, histórico e auditoria. Não gera HTML nem hospeda página.
- Template base em Next.js/MDX no GitHub, `output: 'export'` e Cloudflare Pages.
- Rastreabem (HTML → MDX) e Morbeck x Carvalhinho (WordPress → MDX) no ciclo inicial.
- Alto Araguaia Imóveis com Puck + CMS headless Payload/Strapi + Postgres, a partir do modelo e do CMS PHP do proprietário.
- SOS Alto Araguaia fora do ciclo inicial, sob avaliação de volume e custo.

## Fase C — Sistemas verticais [planejado]

1. Escola de Música: agenda, presença de aluno e professor, gráficos de aulas restantes/reposições e cobrança recorrente com aviso por WhatsApp/e-mail.
2. Escola com provas/notas: login de aluno, vídeo do YouTube por embed, notas em tempo real e mensalidade recorrente por WhatsApp/e-mail.
3. Estética e Delivery como segmentos sobre os mesmos núcleos; checkout em motor de comércio externo.

## Critério de produção

Nenhum domínio, pagamento, publicação ou integração é considerado ativo por configuração. É exigida evidência no ar e autorização explícita antes de qualquer troca de DNS ou operação externa.
