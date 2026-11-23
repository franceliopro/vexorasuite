# Checklist de entrega — sites e artes

**Status:** aguardando o proprietário. **Não autoriza `apply`, DNS, TLS público, publicação, migração nem qualquer operação externa.**  
**Data:** 2026-11-22. Complementa `docs/plano-transicao-presenca-criativos.md`.

A Véxora registra o pedido, a aprovação, a publicação e a auditoria. A execução de sites e criativos fica fora da Véxora e depende de acesso e insumos que o proprietário ainda não enviou. Enquanto isso, o provisionador continua em `simulation`; nenhum recurso real foi criado.

## 1. Sites — um bloco por site

Preencher para cada um dos quatro sites (Alto Araguaia Imóveis, Rastreabem, SOS Alto Araguaia, Morbeck x Carvalhinho):

Estado real informado pelo proprietário: Rastreabem já tem HTML completo; Morbeck x Carvalhinho ainda é WordPress com ~40 páginas; Alto Araguaia Imóveis é PHP com CMS próprio e está fora do ar; SOS Alto Araguaia está sob avaliação e fora do ciclo inicial.

- [ ] **Slug definitivo** usado em pasta, banco e vhost.
- [ ] **Domínio real** no qual o site deve responder.
- [x] **Tipo de destino resolvido:** Next.js para Rastreabem, Morbeck x Carvalhinho e Alto Araguaia Imóveis; sem opção `php-mysql` neste ciclo. SOS Alto Araguaia segue sob avaliação.
- [x] **Versão do PHP:** não se aplica aos três sites do ciclo inicial.
- [ ] **Origem por site:** HTML de Rastreabem; export/dump do WordPress de Morbeck; dump/export do CMS PHP do Alto Araguaia. Somente conteúdo saneado é reaproveitado — nenhum tema, plugin, upload executável ou credencial antiga é implantado.
- [ ] **Mídia e documentos** necessários, com direitos de uso confirmados.
- [ ] **Redirecionamentos** antigos que precisam ser preservados.
- [ ] **Formulários e integrações** atuais, incluindo o destino dos e-mails (Zoho Mail fica fora da migração).
- [ ] **Credenciais antigas** que precisam ser invalidadas ou substituídas.

## 1.1 HUB de Sites — insumos e credenciais pendentes

- [ ] **Domínio definitivo por site** e aprovador nomeado para cada pedido/publicação.
- [ ] **Repositório GitHub por tenant/site** (ou autorização para criá-lo a partir do template) e token com escopo mínimo para o fluxo operacional externo.
- [ ] **Conta/token Cloudflare Pages** e acesso DNS/TLS quando a publicação for executada; sem isso, o HUB só registra pedido/preview/aprovação.
- [ ] **Briefing de artes por peça:** objetivo, canal/formato, identidade visual, texto/matéria-prima aprovados, prazo, aprovador e destino/publicador.
- [ ] **Credenciais Stripe e InfinitePay** (chaves, webhook secret/handle e ambiente sandbox/produção). Adaptadores já implementados no PR #1183; sem credenciais, webhook registrado e evidência do provedor, não validar cobrança real.
- [ ] **Evidência no ar** para qualquer afirmação de publicação, domínio ativo, TLS, pagamento ou integração funcionando.

## 2. Infraestrutura do provisionador

- [ ] Contrato real dos endpoints internos de administração do **MariaDB 11** (criação de banco/usuário, escopo e remoção).
- [ ] Contrato real dos endpoints internos do **Filebrowser** (criação de usuário, escopo e remoção).
- [ ] Formato efetivo e política de rotação dos **Docker secrets**, incluindo quem provisiona a senha de cada site.
- [ ] Chave e escopo do **webhook assinado** (global do provisionador ou por tenant).
- [ ] Identidade do **aprovador** enviada pela Véxora antes de cada `apply`.
- [ ] Validação no servidor da disponibilidade das **17 imagens PHP** e da compatibilidade com MariaDB 11.
- [ ] Confirmação de que o socket do Docker e a rede isolada estão configurados com as mitigações do §11.4 do plano de transição.

## 3. Artes e criativos

A Véxora governa o pedido e a aprovação; a produção acontece em software externo. Para cada peça:

- [ ] **Objetivo** da peça (ex.: divulgação de imóvel, campanha, post, vídeo de boas-vindas).
- [ ] **Canal e formato** finais (tamanho, proporção, duração, legenda/áudio).
- [ ] **Identidade visual** aplicável: cores, logo, tipografia e tom de voz do cliente.
- [ ] **Texto e matéria-prima** aprovados (fotos, vídeos, dados do imóvel ou da campanha).
- [ ] **Prazo e aprovador** nomeado.
- [ ] **Destino da publicação** (site, rede social ou outro canal) e quem executa a publicação.

Nenhuma peça é considerada criada, aprovada, publicada ou entregue apenas porque existe configuração ou rascunho no sistema.

## 4. Sequência segura

1. O proprietário envia os itens acima e autoriza explicitamente o primeiro `dry-run`.
2. O provisionador gera o plano em `dry-run`; nada é criado.
3. A Véxora registra a aprovação humana com a identidade do aprovador.
4. Somente então o `apply` é habilitado para o job específico, com `requestId` de idempotência.
5. `status` consulta o estado real; `published: true` e `tls: configured` aparecem apenas após health-check 2xx no domínio final.
6. rollback permanece disponível e o ambiente anterior é preservado até a validação.

Nenhuma alteração de DNS é feita pelo provisionador: o proprietário controla o DNS na Valuehost e executa a troca.
