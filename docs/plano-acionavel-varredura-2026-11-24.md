# Varredura e plano priorizado — 2026-11-24

Este documento consolida a varredura rápida pedida pelo proprietário e transforma o mapeamento de sites/artes, HUB, orçamento/documentos e escolas em um plano priorizado. Ele **não** autoriza deploy, DNS, TLS, publicação, migração em produção, envio a clientes nem integração externa.

Linha de base verificada: `foundation/bootstrap-monorepo` em `77c8a813acfdfbb4d02461244b5ad719a96a9f36` e `main` em `6b3b77a65db26acbe72c5b6cf4ea9036f0e479c1` (PRs #1274, #1275, #1276 e #1277 mesclados; `foundation` é ancestral de `main`).

## 1. Varredura visual

Verificado na sessão autenticada da Rastreabem, nas telas **Visão geral, Atendimento, CRM, Documentos, Sites, Financeiro e Configurações**:

- sem imagens quebradas;
- sem overflow horizontal;
- sem `undefined`, `NaN` ou `[object Object]` visível;
- sem erros de script ou stylesheet no carregamento.

Limite: é uma inspeção rápida da sessão autenticada, não um teste visual automatizado nem uma auditoria de acessibilidade.

## 2. Erros de processo

| Item | Evidência | Classificação | Ação |
| --- | --- | --- | --- |
| `GET /api/backend/documents/recent` | `500` antes de #1276; agora `200` com `{"documents":[]}` em 2026-11-24T05:52Z | Corrigido e confirmado em produção | Nenhuma. Manter monitoramento. |
| `GET /api/backend/finance/executive?months=6` | `503`: “Integração Asaas não está configurada para esta empresa.” | Dependência de configuração por tenant, não defeito de código | Configurar Asaas na empresa; não afirmar dados financeiros antes disso. |
| `/api/backend/users`, `/api/backend/agents`, `/api/backend/operations/settings` | `404` em sondagem direta; registros antigos no console. Após recarregamento limpo, nenhuma requisição `4xx` para `/api/backend` foi capturada e o código atual não contém essas chamadas | Rastro de bundle/console antigo, não rota quebrada confirmada | Registrar e reavaliar se reaparecer em sessão nova. |
| `SSE /api/backend/events` | `ERR_HTTP2_PROTOCOL_ERROR`, `ERR_ABORTED` e `502` em momentos distintos; outras rotas estáveis | Transporte intermitente, não falha funcional confirmada | Observar; só abrir correção com reprodutibilidade. |
| `Guardar cópia do fluxo atual` | `Error: prompt() is not supported.` no navegador integrado | Falha real de UI em ambiente incorporado | PR de robustez: usar o nome sugerido quando `prompt()` não existir e não excluir sem confirmação utilizável. |

## 3. Priorização

### P0 — HUB de Sites (preparação, não publicação)

**Estado:** existe como contrato, intake, preview e decisão; **não** gera HTML, não hospeda e não publica.

**Próximo passo:** receber os insumos do proprietário e transforming a solicitação aprovada em versão rastreável, com auditoria por tenant.

**Critérios de aceite:** pedido registrado com slug/domínio/origem definidos; aprovação registrada; preview versionado; nenhuma publicação afirmada sem HTTP 2xx no domínio final.

### P1 — CMS piloto (conteúdo editável)

**Estado:** planejado. Decisão de 2026-11-23: Alto Araguaia Imóveis usa Puck + Payload/Strapi; Directus fica superado.

**Critérios de aceite:** API tenant-scoped; collections por preset (`conteudo`, `imoveis`, `produtos`); seed replicável; nenhuma credencial copiada entre empresas; preview aprovado antes de qualquer publicação.

### P2 — Orçamento e documentos

**Estado:** módulo implementado com `DocumentTemplate`, `GeneratedDocument`, `QUOTE`, `CONTRACT`, `WORK_ORDER`, `RECEIPT` e PDF via `pdfkit`. O `500` de documentos recentes foi corrigido e confirmado com `200`.

**Pendências:** numeração sequencial atômica e assinatura digital.

**Critérios de aceite:** teste de concorrência para numeração; envio registrado como enviado/confirmado/ambíguo/falhou conforme resposta real; assinatura só com evidência do provedor; nenhum envio afirmado por configuração.

### P3 — Escolas (Música → Teologia com notas e provas)

**Estado:** planejado. Os presets `escola_musica`, `escola_teologia` e `escola_cursos` são visuais. Não há módulo acadêmico nem papel `STUDENT` no schema.

**Dependência:** decisão de escopo (matrícula, turmas, disciplinas, notas, provas, recuperação, frequência, responsáveis, relatórios) antes de implementar.

**Critérios de aceite:** papéis e matrículas tenant-scoped; notas e provas com histórico e auditoria; migration + testes no CI; sem copiar alunos/contatos de outra empresa.

### HUB de integrações externas (Claude, ChatGPT, Gemini, OpenBot, OpenCode, Codex)

**Estado:** provedores de modelo configuráveis incluem Claude/Anthropic, Gemini, OpenAI e OpenRouter. Produtos como ChatGPT, Codex, OpenCode e OpenBot são proposta/roadmap, não integração ativa comprovada.

**Critérios de aceite:** credenciais por tenant; teste privado; evidência no destino final. Nenhuma integração é chamada de ativa apenas por flag ou configuração.

## 4. Insumos que destravam as frentes

O formulário pronto está em `docs/modelo-insumos-sites-artes.md`. Para cada site/peça: slug definitivo, domínio real, origem, mídias com direito de uso, redirecionamentos, formulários, credenciais antigas, GitHub/Cloudflare e Stripe/InfinitePay.

Também faltam:

- números wa.me distintos para Pessoa Física, Pessoa Jurídica e donos (hoje o fluxo usa os contatos oficiais publicados);
- configuração do Asaas na empresa para o financeiro executivo;
- decisão de escopo do módulo escolar.

## 5. Regras de evidência

- “Entregue” exige HTTP 2xx no destino final e inspeção objetiva.
- Configuração, rascunho, preview, flag e merge de CI não provam publicação, pagamento, envio ou conexão viva.
- Toda operação é tenant-scoped; credenciais, contatos e sessões nunca são copiados entre empresas.
- A Rastreabem é empresa cliente e referência de segmento; o fluxo salvo é um teste dela, não identidade global nem padrão obrigatório.

## 6. Estado de publicação

Este documento e os PRs relacionados apenas registram plano e corrigem código. Nenhum domínio, DNS, TLS, deploy manual, publicação de site ou integração externa foi executado ou afirmado por eles. A evidência de produção consultada foi HTTP 2xx/503/404 direto nas rotas indicadas.
