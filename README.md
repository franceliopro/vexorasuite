# Véxora Suite

Plataforma SaaS modular e multiempresa, desenvolvida em repositório e ambiente separados da Véxora Matriz.

## Onde estamos (2026-11-23)

- Núcleo de atendimento multi-tenant: Inbox, canais, CRM, tarefas, agenda, Financeiro/Asaas, relatórios e auditoria. Há implementação e testes no repositório; aceite com conversa real, aparelho e provedores externos ainda pendente.
- Interface web/PWA responsiva com temas Slate, Claro e Híbrido alinhados ao mock de referência, superfície única de fundo e navegação lateral fixa.
- Workspace de IA com agentes no topo em largura total, abas reais de configuração e execução condicionada a `enabled` e vínculos de inbox. O texto público distingue simulação de execução real.
- Serviço de Sites em transição: o criador com IA foi substituído pelo **HUB da Véxora**, que governa pedido, preview, aprovação, versão e auditoria. O HUB não gera HTML e não hospeda página.
- Sites em Next.js/MDX no GitHub, entrega via Cloudflare Pages. Nenhuma publicação, domínio ativo ou integração é afirmada sem evidência no ar.

## Onde vamos chegar

1. HUB de Sites e template base Next.js/MDX com menu gerado de `content/navigation.ts`.
2. CMS headless self-hosted (Directus + Postgres) como piloto do Alto Araguaia Imóveis.
3. Sistemas verticais nativos: Escola de Música, Escola com provas/notas, Estética e Delivery, reaproveitando CRM, agenda, Financeiro/Asaas, WhatsApp/e-mail e auditoria.
4. SOS Alto Araguaia: fora do ciclo inicial, sob avaliação de storage, banda e tráfego.

## O que não faz parte do produto

Criador de sites com IA e seu editor visual legado, Home de apresentação com papel de parede, conector WordPress, telefonia/SMS, anúncios pagos, publicação social automática, vídeo automático, FAETER como primeiro vertical e PHP por site.

## Documentação

- Estado atual e prioridades: `docs/implementation-status.md` (fonte canônica de status).
- Arquitetura do HUB de Sites e dos sistemas verticais: `docs/plano-transicao-presenca-criativos.md` (§12 e §13).
- Regras de contexto e permissões: `docs/platform-and-client-contexts.md`.
- Arquitetura do monorepo: `docs/architecture.md`.
- Registro histórico de entregas: `docs/implementation-register.md`.
- Insumos pendentes de sites e artes: `docs/checklist-entrega-sites-artes.md`.
