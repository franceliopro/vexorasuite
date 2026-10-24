# Véxora — Captura e atribuição de leads

## Objetivo

Criar uma fundação única, multi-tenant e auditável para identificar como um prospect conheceu a empresa, por qual ação converteu e quais campanhas influenciaram oportunidades e vendas. A captura deve ser reaproveitável por CRM, WhatsApp, SMS, áudio, chamadas de IA, Landing Pages, Google Ads e Social Media.

## Princípios de produto e dados

1. **Não confundir aquisição com canal de atendimento.** WhatsApp é o canal da conversa; só é a origem de aquisição quando existe evidência ou declaração identificada.
2. **Primeiro toque imutável.** A primeira origem confiável não pode ser sobrescrita por contatos futuros. Correções administrativas devem ser auditadas.
3. **Toques subsequentes são eventos.** Cada conversão, clique rastreável ou campanha interativa pode formar um novo touchpoint com timestamp e proveniência.
4. **Separar observação, inferência e declaração.** Todo atributo de atribuição carrega método/proveniência, nível de confiança e momento de captura. Nunca transformar ausência de dado em origem presumida.
5. **Campanha interna é identidade canônica.** UTM, click IDs, plataforma, conta externa, campanha, conjunto e criativo são dimensões complementares; armazenar IDs externos quando disponíveis.
6. **Isolamento por tenant e privacidade.** APIs, chaves de link, eventos, relatórios e credenciais são tenant-scoped. Consentimento, retenção, controle de acesso, minimização de PII e LGPD são requisitos de projeto.
7. **Idempotência e deduplicação.** Reentregas de webhooks e eventos não podem criar eventos/leads duplicados. Deduplicação de contato usa regras explícitas e auditáveis; nunca fuzzy-match para associar atribuição financeira.
8. **Métricas honestas.** Não mostrar CAC/ROAS/ROI como fatos sem custo, receita e regra de atribuição suficientes.

## Vocabulário e modelo conceitual

- **Lead/Contato:** entidade CRM já existente, evoluída sem criar um cadastro paralelo concorrente.
- **Campaign:** ação de marketing da Véxora; pode conter plataforma e referências externas.
- **CampaignLink:** destino/link curto rastreável com campanha, variante e token não adivinhável. Token não deve conter PII.
- **AttributionTouchpoint:** ocorrência de origem/engajamento (primeira visita, conversão, entrada de canal, clique rastreado ou evento de mídia); armazenar tenant, contact quando identificado, campanha, timestamp, source/medium/campaign/content/term, landing/referrer normalizados, click IDs suportados, canal, recurso, IDs externos e provenance.
- **ConversionEvent:** eventos de funil como lead_created, qualified, opportunity_created, won, lost, appointment, reply/click/call outcomes; ligados a entidade, campanha e touchpoint quando evidência permitir.
- **CampaignSpend/Performance:** custos e métricas importados de plataformas, com janela, moeda, fonte e timestamp; não inventar gastos a partir de envios.

Campos UTMs padrão: utm_source, utm_medium, utm_campaign, utm_content, utm_term, utm_id, utm_source_platform. Armazenar gclid, gbraid, wbraid, fbclid e IDs equivalentes em campos apropriados, sujeitos a política de privacidade e necessidade.

## Fluxos de captura

### Landing Page/formulário
1. Capturar parâmetros permitidos na entrada e preservá-los em navegação/redirects próprios.
2. Emitir um identificador first-party de sessão/captura com expiração e consentimento aplicáveis; não usar fingerprinting.
3. No envio, associar metadados, página, formulário e timestamp ao evento de conversão e ao contato criado/identificado.
4. Persistir o primeiro toque apenas se ainda ausente; criar touchpoint adicional para conversões subsequentes.
5. Oferecer API pública protegida por rate limit, validação de origem/domínio e proteção contra abuso.

### WhatsApp e mensageria
- Link de campanha pode redirecionar por endpoint próprio e abrir destino WhatsApp com mensagem de referência/código opaco quando permitido.
- Capturar referência de anúncio e IDs disponibilizados pelo provider/webhook.
- Associar a referência ao primeiro inbound somente quando token/ref for validado e compatível com tenant.
- A mensagem pré-preenchida é fallback, não prova forte por si só: usuários podem editar/remover.
- Quando não houver evidência, registrar canal de entrada e atribuição desconhecida; permitir declaração assistida separada.

### SMS, áudio e chamadas de IA
- Toda execução de campanha registra campaign_id, delivery/action ID, audience segment, variante e estado de entrega/execução.
- Links individuais usam token opaco, sem telefone ou PII na URL.
- Chamadas armazenam estados distintos (solicitada, iniciada, atendida, concluída, falha) e resultado qualificado quando disponível, com políticas específicas para consentimento e gravação.
- Reconciliar respostas, cliques, chamadas e conversões com regras explícitas e janela configurável.

### Google e outras mídias
- Começar com UTMs/click IDs capturados na landing page e importação de resultados/custos por integração autorizada.
- Conexões OAuth e sincronizações devem ter escopos mínimos, credenciais seguras e trilha de auditoria.
- Conversões offline/otimizadas são fase posterior, dependem de políticas, base legal, consentimento quando necessário e identificadores elegíveis.

### Social Media
- Publicação possui post_id interno, plataforma, conta, formato, status, agendamento, URL rastreável, campaign_id e métricas nativas importadas.
- Publicação patrocinada deve poder referenciar campaign/ad identifiers sem duplicar o objeto campanha.
- Separar orgânico, mídia paga e impulsionamento.

## Atribuição e mensuração

Disponibilizar visões distintas:
- **Primeiro toque:** aquisição original conhecida.
- **Último toque não direto:** contato anterior mais recente elegível, se evidência suficiente.
- **Toques assistentes:** jornada conhecida, sem alegar causalidade.
- **Origem declarada:** resposta do contato/agente, explicitamente rotulada.
- **Canal de entrada/cadastro:** origem técnica do registro e canal de conversa.

Modelos de atribuição (first/last/multi-touch) devem ser selecionáveis e descritos, não misturados. Registrar janela, regra, versão e dados usados em cada cálculo.

Indicadores por campanha/canal: leads únicos, leads com origem confiável, taxa de cobertura, qualificados, oportunidades, ganhos, perdas e motivos, tempo de conversão, receita vinculada e custo por lead. CAC, ROAS e ROI só quando despesas e receita confiáveis estiverem integradas. Exibir volume desconhecido e cobertura do rastreamento ao lado dos indicadores.

## Configuração e experiência

- Configurações de Marketing da empresa: convenção de nomenclatura, domínio de links, parâmetros extras permitidos, janelas de atribuição, consentimento/retention e integrações.
- Criador de campanha: objetivo, canais, destino, público, calendário, parâmetros e prévia dos links; copiar/exportar links com UTM.
- Perfil do contato: bloco **Aquisição e jornada**, exibindo primeiro toque, origem recente, histórico, evidências e confiança.
- CRM: filtros por campanha/origem e relatórios de conversão sem adicionar uma coluna de funil por origem.
- Inteligência Comercial permanece dentro do CRM. Inteligência Operacional continua separada.
- Estados vazios devem explicar como configurar captura e gerar o primeiro link.

## Plano de entrega proposto

### Fase 1 — Fundação de captura
- Fechar o esquema persistente multi-tenant para campanhas, links, touchpoints e eventos.
- Captura e normalização compartilhada de UTMs/click IDs.
- Serviço de resolução de link com tokens opacos, expiração/revogação e redirecionamento seguro (allowlist para destinos).
- API de captura/formulário e atribuição em criação/atualização de contato.
- Persistir origem original, origem técnica do cadastro e histórico; testes de isolamento, abuso, idempotência e deduplicação.
- Atualizar criação/edição do contato e detalhes de atribuição; preservar legados como desconhecidos.

### Fase 2 — Adoção nos canais
- Integrar entrada WhatsApp/referral metadata e rastreio de links.
- Eventos de campanha para SMS, áudio e ligações IA.
- Importação inicial de custo/resultado Google e Meta, com reconciliação.

### Fase 3 — Ativação de marketing
- Construtor de campanhas e gestão de links.
- Landing Pages/formulários e Social Media integrados.
- Calendário, conteúdos, aprovações, métricas e promoção de publicações.

### Fase 4 — Receita e otimização
- Conversões de qualificação, ganho/perda e receita ligada à campanha.
- Importação de conversões offline conforme requisitos dos provedores.
- Modelos de atribuição, custo por lead, CAC/ROAS/ROI com cobertura explícita.

## Critérios de aceite da fundação

- UTMs e click IDs capturados e persistidos no contato/evento correto, sem serem confundidos com canal de atendimento.
- Primeiro toque preservado e eventos posteriores mantidos com timestamps.
- Origem desconhecida continua explicitamente desconhecida.
- Toda leitura/escrita isolada por tenant, com testes.
- Ingestão idempotente; token de campanha opaco, revogável, rate-limited e sem PII.
- Redirecionamento impede open redirect.
- Origem manual/declarada identificada e auditável.
- Relatório mostra leads, cobertura de origem, conversões e estados com definições documentadas.
- Build, testes e migração validados antes do merge/deploy.

## Decisões intencionais

- Nome de navegação: **Inteligência Comercial**, dentro do CRM; a área analítica pode manter o termo Origem dos Leads como conceito e relatório.
- O identificador de campanha interno é a chave canônica. UTM é mecanismo de transporte e interoperabilidade, não banco primário de relacionamento.
- Não declarar atribuição de campanha em uma conversa apenas porque chegou por WhatsApp ou outro canal.
- Não prometer tracking determinístico entre dispositivos, apps, bloqueadores, consentimentos negados ou canais sem identificadores.
