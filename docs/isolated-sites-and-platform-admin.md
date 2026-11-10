# Ambientes isolados e Administração da Véxora (planos, preços e clientes)

Arquitetura proposta para os itens 5 (Marketing/Sites/Landing Pages/Formulários isolados e ambientes por módulo) e 6 (planos, preços, pacotes e gestão dos clientes da Véxora). Baseada no que existe no repositório em novembro/2026 — nada aqui promete prazo; as fases são ordem de dependência, não promessa de data.

## O que já existe e precisa ser aproveitado

- **Página pública do robô** (`/p/<token>`): renderizador real, isolado, sem qualquer moldura da Véxora; fluxo publicado, tema por empresa, /p/ atendido pelo mesmo app em `app.vexorasuite.com.br`.
- **Marketing** (`marketing.web-assets`): cadastro de ativos `SITE`, `LANDING`, `FORM` com rascunho de IA — hoje é um registro de projetos/rascunhos, não uma edição de páginas nem um renderizador público.
- **Endereços reservados**: `bot-<empresa>.vexorasuite.com.br` (bot2-, bot3- para múltiplos robôs; `-2`, `-3` para colisão de nome de empresa) já é calculado pela `/api/backend/auth/bot-host`.
- **Automação por empresa**: pacotes provisionam departamentos, pipelines, agentes e rotinas mesmo em empresas novas; a criação de empresa já tem `kind: PLATFORM | CLIENT` e `isPlatformAdmin` para a administração Véxora.
- **Financeiro Asaas**: sincronização de clientes/cobranças por empresa e cofres — a metade "cobrança" já existe; falta "assinatura SaaS da Véxora".

## Item 5 — A fórmula que recomendo: "isolado por link primeiro, isolado por shell depois"

Construir isolamento total de app agora (app separada, deploy separado, sessões separadas) multiplicaria X vezes a superfície de erros operacionais para um produto que ainda não tem o seu primeiro cliente. A ordem correta:

### Fase 5.1 — Renderer público dos web-assets (réplica do /p/<token> para páginas)
Novo endpoint público `/s/<token>` servindo o SITE/LANDING/FORM como página real (estatástica, sem painel). Esta é a mesma mecânica do robô em tela cheia, com outro tipo de conteúdo: cabeçalho da empresa, seções/blocos do ativo, formulário para FORM com gravação em `marketing.web-asset-submission` (+ opcional criação de lead no pipeline/origem "Site/Formulário", respeitando LGPD e o consentimento do formulário).
- O chat no site = snippet de embed (iframe `/p/<token>` sem moldura ou a página `/s/` com botão WhatsApp). Um único "código de instalação" no painel Sites.
- Conteúdo: reaproveitar `marketing/web-assets` existente + campos `blocks` por tipo. Upload de imagens/post/imóveis continua no Marketing, e o renderer apenas resolve o que foi publicado.

### Fase 5.2 — Tenants em modo produto único (entitlements, não isolamento de infra)
Adicionar `tenants.entitlements: { modules: ["SITES"] }` (ou enum estreito no `organization`/`integrations` raiz) e escopo de navegação por entitlement. Um cliente "só site" logando vê: páginas, posts, imagens e ajustes do seu site — nada de CRM, atendimento, financeiro, IA.
- Administração isolada = **micro-shell** no mesmo app: rota `/sites/*` com layout dedicado (topbar da empresa, sem sidebar da Véxora), guardas de entitlement no servidor e na UI, papel novo `SITE_ADMIN` (o cliente administra o próprio site; não vê nada além).
- O delta é de navegação e deautorização, não de infraestrutura: mesmos serviços, mesmos dados, mesmos backups — menos superfície, não menos segurança.

### Fase 5.3 — Subdomínios `s-<empresa>` / `bot-<empresa>`
Ativação do wildcard `*.vexorasuite.com.br` no Dokploy + Traefik (router para o app, HostRegexp). A Véxora Cloud passa a servir `s-clinicaexemplo.vexorasuite.com.br` (sites/lpegage/formulário) e `bot-*` (robôs). Sem o wildcard nada disso resolve — esta fase é de infraestrutura, não de código, e deve ser feita na mesma janela em que a Fase 5.1 entrar em produção.

### Fase 5.4 — Marketing que publica (o que do Tomik vale adaptar)
Estudado em tomik.com.br (novembro/2026): promessa de "poste todo dia sem virar escravo do Instagram", IA escreve/agenda/publica, aprovação pelo WhatsApp (ou piloto automático), DNA de voz, ~5 min de setup, plano grátis + Pro 14 dias, 4.9/5 (1.783 avaliações). O dinheiro deles está em Instagram↔WhatsApp↔IA, não em sites.
O que faz sentido na Véxora — nesta ordem:
1. **Aprovação de posts pelo WhatsApp** (interação via canal já existente, como aprovação de disparo): a IA cria o rascunho, manda imagem+legenda para o WhatsApp do responsável com botões "Aprovar / Ajustar / Rejeitar". Zero painel necessário para cliente ocupado — e é só reutilizar o canal e os fluxos de aprovação já usados no atendimento.
2. **Fila inteligente com horário ótimo** por perfil de engajamento da conta (Zernio já publica; falta apenas agendamento por sugestão).
3. **Banco de ideias por nicho** (os mesmos segmentos de Rastreamento veicular → Escola de músicas e instrumentos que o Marketing já conhece).
4. **Métricas de conteúdo** por publicação no painel Marketing (hoje a pasta "Publicadas" diz "está no ar" mas não "deu resultado").
O que do Tomik NÃO recomendo copiar: autopilot total cego (publica sem revisão) — a Véxora perde a confiança do cliente na primeira legenda ridícula; e "DNA de voz" por crawling sem consentimento explícito — risco de direito autoral e de reputação.

### O que decido eu, por empresa, na hora de criar
Campo na criação de empresa (como a escolha de segmento hoje): **Produto** → `Véxora completa` | `Véxora Sites (site + posts + imóveis + ajustes)` | `Robô em tela cheia para o site` (só chat/bot — caso mais estreito). Isso define entitlements, papel máximo e o link de administração inicial que vai no e-mail de boas-vindas: `app.vexorasuite.com.br/sites` com sessão limitada.

## Item 6 — Administração Véxora: planos, preços, pacotes e clientes

Problema: hoje existe apenas o painel PLATFORM (empresas, usuários, chaves) e CRM de contatos de clientes — nada que responda "quem contrata a Véxora, em qual plano, por quanto, com quais limites, e quem está devendo". Proposta em quatro blocos:

### 6.1 Catálogo (a fonte de verdade é o Postgres, não a reunião da sexta)
Tabela `plans` editável pela administração Véxora: nome, descrição comercial, preço/ciclo, módulos e limites (robôs, atendentes, IA tier, sites, unidades, volume). `tenants.planId` + `tenants.limits` materializados na contratação (como os pacotes já materializam agentes/pipelines hoje). Pacotes (combinados de plano) = mesma tabela com `kind: PACKAGE`. Não é motor de precificação universal — é catálogo com limite por empresa.

### 6.2 Clientes (empresas que contratam)
Lista/busca/filtro na administração Véxora: status (trial/ativa/inadimplente/suspensa), plano, MRR, último acesso, saúde e uso real (chamadas IA, conversas, robôs, storage). Página do cliente: assinatura, faturas (Asaas), módulos, suporte (impersonação com trilha de auditoria — padrão já existente de `auditLog.action='admin.impersonate'`), suspender/reativar, upgrade/downgrade de plano com recálculo.

### 6.3 Cobrança — Asaas como sistema financeiro, Véxora como registro
Autoridade de cobrança = Asaas (já integrado e com cofres): assinaturas com cobrança recorrente, webhooks de confirmação → `subscriptions.status`, régua de inadimplência (D+1 aviso interno, D+7 e-mail, D+15 downgrade automático de limites ou suspensão somente com copy aprovada juridicamente — não bloquear sem aviso). Véxora não implementa motor de cobrança; só reage ao que o Asaas confirma (mesmo princípio de não afirmar publicação/pagamento sem evidência).

### 6.4 Onboarding e vida útil do plano
Criação de empresa passa por: escolha do plano (catálogo) → confirmação → provisionamento (já existe) + rascunho de assinatura no Asaas → e-mail de boas-vindas + link `app.vexorasuite.com.br/sites` (produto único) ou painel completo. Troca de plano: diff de entitlements, aviso de downgrade (o que será desligado: ex., "este plano não inclui Robô 2"), nunca deletar dados. Cancelamento: exportação completa dos dados do cliente (LGPD) + retenção conforme política definida.

## Decisões que preciso do produto antes de codar (resposta neste documento aceita)

1. Fase 5.1 pode virar PR com `/s/<token>` e snippet já? 2. Produto único na criação de empresa entra no próximo ciclo? 3. O Wildcard `*.vexorasuite.com.br` tem dono e janela para ativar? 4. Site público pode criar lead no CRM (`Site/Formulário`) ou deve ser nunca (contagem/e-mail apenas)? 5. Quem define preços e limites iniciais dos planos? 6. Catálogo de planos fica no PLATFORM ou visível no painel do cliente (upgrade/self-service)?

## Faseamento honesto

5.1 e 6.1+6.2 são "semanas, não meses" e cabem num ciclo sem colisão. 5.2 e 6.3 tocam autorização e dinheiro — exigem revisão. 5.3 depende de DNS e de edge routing que hoje está fora do repositório. 5.4 é contínuo e depende do 5.1 existir.
