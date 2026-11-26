# Contrato do normalizador puro de UTM e click IDs

**Data:** 26/11/2026. **Decisão do proprietário:** primeira fatia reversível do item 5 (prospecção) = UTM puro + contrato. Este documento descreve o que a função `normalizeAttribution` faz e, sobretudo, o que ela **não** faz. Ele não autoriza persistência, campanha, envio, IA nem integração externa.

## Função e limites

`apps/api/src/operations/lead-attribution-normalizer.ts` recebe uma URL absoluta ou relativa, um `URLSearchParams` ou um objeto simples e devolve sempre a mesma forma:

- `origin`: `utm_source` normalizado ou `"unknown"`;
- `source`, `medium`: textos aparados e em minúsculas;
- `campaign`, `term`, `content`: textos aparados, com a caixa preservada (são transporte, não identificadores canônicos);
- `clickIds`: apenas `gclid`, `fbclid`, `msclkid`, `ttclid` e `dclid`, com tokens opacos preservados;
- `campaignId: null` e `firstTouchAt: null` **sempre**;
- `hasEvidence`: indica se algum parâmetro suportado foi reconhecido.

Regras determinísticas: chaves são comparadas em minúsculas, a primeira ocorrência prevalece, valores vazios ou com mais de 200 caracteres são descartados, entradas com mais de 4096 caracteres são ignoradas, e parâmetros fora da lista fixa são descartados. A função não lê relógio, não usa aleatoriedade, não guarda estado entre chamadas e não altera a entrada.

## Não entregue nesta fatia

- **Nenhum dado é gravado.** Não há modelo novo, migração, escrita em banco, vinculação a `Contact`, `ContactIdentity`, `SiteFormSubmission` ou `CrmPipeline`, nem alteração em `source`, `campaignId` ou `leadOrigin` existentes.
- **Nenhum envio.** Não há disparo de WhatsApp, SMS, e-mail ou webhook; nenhum link é gerado, agendado ou publicado.
- **Nenhuma IA.** A função é determinística e não chama modelo, agente ou serviço de inferência.
- **Nenhum scraping.** Não há navegação, coleta de páginas, automação de navegador nem uso de API não autorizada.
- Nenhuma atribuição de campanha a partir de UTM: a **chave canônica** de campanha é interna e humana, conforme `docs/lead-attribution-foundation.md`. UTM é mecanismo de transporte.
- Nenhuma conclusão sobre **canal de atendimento**: `utm_medium=whatsapp`, por exemplo, não prova aquisição por WhatsApp nem autoriza mensagem.
- Nenhuma promessa de rastreamento entre dispositivos, apps, bloqueadores ou consentimentos negados.
- Nenhuma sobrescrita de primeiro toque; `firstTouchAt` permanece nulo até a camada de domínio decidir com evidência e auditoria.

## Contratos futuros obrigatórios antes de qualquer integração

Qualquer PR que ligue este normalizador a produto deverá preservar: escopo por `tenantId`, consentimento **default-deny** por canal, opt-out irreversível pela UI, idempotência e correlação de eventos, auditoria de origem declarada versus observada, e uso exclusivo de APIs oficiais/autorizadas. A captura em formulário público, o construtor de campanhas com aprovação humana e o relatório de cobertura são fatias separadas, cada uma com seu PR e seus testes.

## Verificação

- `apps/api/src/operations/lead-attribution-normalizer.spec.ts`: testes de URL absoluta/relativa, origem desconhecida, não inferência de campanha/primeiro toque/canal, limites e abuso de entrada, lista fixa de click IDs, `URLSearchParams` e determinismo.
- `apps/web/test/lead-attribution-normalizer-contract.test.mjs`: guardas estáticos de pureza e de presença das cláusulas acima.
- `.github/workflows/lead-attribution-contract.yml`: executa os guardas e o spec da API no GitHub Actions.

A existência desta função e destes testes **não** prova captura real, campanha ativa, atribuição persistida, envio, conversão ou integração externa.
