# Plano de transição — Véxora como gestora de presença e criativos

**Status:** proposta para aceite do proprietário. **Não executa remoção de código.**  
**Data:** 2026-11-22. **Head de referência:** `foundation/bootstrap-monorepo` em `9c2350a4`.

## 1. Objetivo

Transformar a Véxora em **gestora** dos processos de presença e criação, sem continuar competindo com estúdio, agência, page builder ou orquestrador de IA.

A Véxora continua sendo o **sistema de registro**: pedido, aprovação, publicação, histórico, tenant, usuário, permissão e auditoria. A **execução** — gerar arte, renderizar vídeo, montar landing page, compilar site — passa para software externo governado.

> Frase-guia: **a IA cria; a Véxora autoriza, publica e prova.**

Este documento **revisa** a decisão anterior registrada em `docs/product-focus.md`, que mantinha Marketing/Criações/Sites no núcleo, e complementa `docs/isolated-sites-and-platform-admin.md`. A mudança só entra em vigor com aceite explícito do proprietário.

## 2. Inventário do que existe hoje

### Navegação e interface (`apps/web/src/app/page.tsx`)

| Rótulo                                                        | Destino atual                                                                                          |
| ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| `Sites`                                                       | `sites-workspace.tsx` + `sites-domain-config.tsx`                                                      |
| `Criações`, `Postagens`, `Marketing`, `Referências criativas` | `creative-library-workspace.tsx`                                                                       |
| `Google Drive`                                                | `creative-library-workspace.tsx` (a integração de anexos é separada e está em `docs/ESCOPO-ENXUTO.md`) |

Arquivos relacionados: `file-image-picker.tsx`, `post-body-editor.tsx`, `brand-glyph.tsx`.

### Backend e documentação

- `SiteDocument` (JSONB) + `apps/api/src/modules/sites-deploy/site-html.ts` são a fonte atual do criador (`docs/implementation-register.md`, estado em 2026-11-20).
- Publicação em Cloudflare e domínio próprio dependem de credenciais e evidência de deploy; `docs/implementation-register.md` e `docs/production-readiness.md` não confirmam publicação real.
- `docs/marketing-workflows-drive.md` descreve o worker atual de Criações (roteiro, PNG determinístico, FFmpeg opcional).
- `docs/isolated-sites-and-platform-admin.md` propõe entitlements e produto único; deve ser preservado como histórico de arquitetura.

**Ressalva:** `docs/production-readiness.md` aponta que o endpoint público `/sites/<slug>` e `public/sites/resolve` não existem no checkout atual. Não afirmar que site público está no ar sem evidência.

## 3. Destino de cada capacidade

### Nativo da Véxora (não negociável)

- Empresas/tenants, usuários, papéis, negativas individuais.
- Departamentos, segmentos e **vocabulário próprio por segmento** (termos, rótulos, campos, templates).
- CRM, pipelines e atendimento humano, com WhatsApp/Google.
- **Financeiro** (já consolidado).
- **Documentos, orçamento e assinatura** como governança: pedido, aprovação, versionamento e registro. O provador criptográfico pode ser externo; a decisão e o histórico ficam na Véxora.
- **Workflows de eventos** (novo cliente, venda, felicitação, cobrança) como regra determinística + memória auditável. A execução pode chamar agentes externos.
- Relatórios e auditoria.

### App interno governado pela Véxora

- Sites e landing pages — outro app cria, outro host publica.
- Artes, flyers, posts, vídeos, referências criativas — OpenBot/Nod/Hermes/Canva/Figma conforme o caso.
- Sistemas verticais profundos: Escola (turmas/notas/diário), Advocacia (processos/prazos), E-commerce (catálogo/checkout/estoque). Conectados por API, com identidade e escopo vindos da Véxora.
- Google Drive como **integração de anexos** permanece; a aba da biblioteca criativa é desativada junto com Criações.

### Executores externos

- **OpenBot** — workspace de agentes com workflows e etapas de aprovação, plugins (Canva/Figma/Notion), self-host/VPS. É o candidato mais próximo para produção de artes e landing pages.
- **Nod** — research preview da n8n Labs; agente pessoal com permissão explícita, bom para briefing, follow-up e vigilância. Não é o motor n8n.
- **Hermes** e modelos de terceiros — avaliar quando houver documentação e caso de uso concretos.
- **n8n** — só se surgir necessidade de motor determinístico, agendado e auditável entre sistemas. Não é pré-requisito para o primeiro piloto.

**Risco de tenant:** OpenBot e Nod não são plataformas multiempresa por padrão. Usar instância por empresa ou garantir separação rígida de workspace e credencial. Nunca compartilhar sessão, credential ou dado entre clientes.

## 4. Arquitetura alvo

```text
Cliente (dentro da Véxora)
   → pedido tenant-scoped (brief, marca, domínio, segmento)
   → Véxora valida permissão e registra intenção
   → webhook assinado para o executor (OpenBot/Nod)
   → executor cria arte / landing / site
   → asset volta para preview na Véxora
   → humano aprova (ou ajusta / rejeita)
   → publicação no host/canal integrado
   → Véxora grava versão, URL, aprovação e auditoria
```

Regras obrigatórias:

1. Credencial por empresa; nunca credencial global compartilhada.
2. Webhook com assinatura, ID de correlação, retry e log.
3. Nenhuma publicação sem aprovação humana registrada.
4. Nenhuma afirmação de "no ar", "pago" ou "integrado" sem evidência testada.
5. Fallback manual: upload do asset gerado fora é aceito enquanto a automação não estiver validada.

## 5. Fases

### Fase 0 — Congelamento e inventário (sem remoção)

- Não adicionar funcionalidade ao criador de Sites nem ao Estúdio de Criações.
- Listar sites, domínios, bancos, credenciais Cloudflare e formulários publicados.
- Levantar CPU/RAM/disco do servidor, uso atual de Docker/Dokploy e número de sites a migrar.
- Escolher o executor do piloto (recomendação: OpenBot).
- Reduzir TTL de DNS dos domínios que serão migrados.

**Saída:** inventário aprovado + decisão do executor. Nenhuma linha de código removida.

### Fase 1 — Desativar a navegação de criação

- Remover do menu os rótulos `Sites`, `Criações`, `Postagens`, `Marketing` e `Referências criativas`.
- Manter `Google Drive` apenas como integração de anexos, fora da biblioteca criativa.
- Preservar rotas e dados legados por enquanto; desativar apenas entrada pela UI.
- Adicionar um aviso curto no lugar dos módulos: "Criação migrada para o app de IA; acompanhe pedidos e aprovações em Presença e criativos."

**Saída:** nenhum cliente novo entra no criador legado. Dados antigos intactos.

### Fase 2 — Hub nativo "Presença e criativos"

- Tela única com: pedido, preview, aprovação/rejeição, status de publicação, versão e histórico.
- Registrar cada item por tenant com `auditLog`.
- Reaproveitar aprovação por WhatsApp já existente no atendimento quando fizer sentido.
- Nenhuma geração de imagem/vídeo/HTML dentro da Véxora nesta fase.

**Saída:** fluxo completo mesmo se o asset ainda for produzido manualmente.

### Fase 3 — Integrar o executor

- Webhook tenant-scoped da Véxora → OpenBot/Nod.
- Correlação por ID de pedido, retry, timeout e registro de falha.
- Preview voltando para o hub; publicação só após aprovação.
- Teste de isolamento: pedido da empresa A não pode aparecer na B.

**Saída:** piloto com um tipo de asset (recomendação: criativo de campanha).

### Fase 4 — Migrar sites dos clientes para host isolado

- Estático: Caddy/Nginx servindo build, TLS automático.
- PHP/MySQL: container por site, banco e volume próprios.
- Next.js: processo/container por site, somente quando houver dinamismo real.
- Copiar arquivos e banco, validar em host temporário, baixar TTL, trocar DNS, confirmar HTTPS e formulários.
- Cada site com credencial de banco própria; backup por site.

**Saída:** sites fora do servidor da Véxora, mas gerenciados por ela. Publicação só confirmada após teste real.

### Fase 5 — Descomissionamento

- Remover código do criador e do estúdio somente após Fases 2–4 validadas.
- Migrar ou arquivar registros que ainda tenham valor histórico.
- Atualizar `docs/implementation-register.md`, `docs/product-focus.md` e `docs/proposta-comercial.md`.
- Manter `docs/isolated-sites-and-platform-admin.md` como histórico, com nota de supersedência.

**Saída:** core enxuto, sem gerador de site nem estúdio de criação.

## 6. Critérios de aceite

- `npm.cmd test` em `apps/web`: 559/559 (ou justificativa de mudança intencional de guard).
- CI do GitHub Actions: 5/5 antes de cada merge.
- Nenhum dado de tenant apagado nas fases 0–4.
- Nenhuma credencial compartilhada entre empresas.
- Aprovação humana obrigatória registrada antes de publicar.
- Rollback documentado por fase: reativar entrada legada sem recuperar backup.
- Nenhuma afirmação de deploy, domínio ativo, pagamento ou integração funcionando sem evidência.

## 7. Riscos e mitigação

| Risco                     | Mitigação                                                                              |
| ------------------------- | -------------------------------------------------------------------------------------- |
| Qualidade criativa ruim   | Preview + aprovação humana; nunca autopublish cego                                     |
| Mistura de tenants        | Instância/workspace por empresa; credencial por tenant                                 |
| Custo de modelos variável | Créditos por pedido, limite por empresa, modelo fallback                               |
| Vendor lock-in            | Contrato de saída: exportar asset e histórico; pelo menos um segundo executor avaliado |
| DNS/TLS na migração       | TTL baixo antes, host temporário, validação antes do switch                            |
| Suporte crescente         | Um tipo de asset por piloto; expandir só após medição                                  |
| LGPD                      | Consentimento do formulário, texto legal revisado pelo proprietário, retenção definida |

## 8. Decisões pendentes do proprietário

1. Servidor: CPU, RAM, disco, Docker/Dokploy, quantos sites migrar.
2. Executor do piloto: OpenBot, Nod, Hermes ou combinação.
3. Qual site migrar primeiro entre os citados (Rastreabem, Alto Araguaia Imóveis, SOS Alto Araguaia, Morbeck x Carvalhinho).
4. `Google Drive` continua apenas como anexos ou também como repositório de referências?
5. Assinatura mantém provider externo atual ou troca?
6. Site público pode criar lead no CRM ou apenas registrar contagem/e-mail?

**Nota de contexto:** Rastreabem é cliente/segmento de referência, não identidade global nem fluxo obrigatório (`AGENTS.md`).

## 9. Fora de escopo

- Não reintroduzir apresentação com papel de parede.
- Não mesclar o PR `#773`.
- Não prometer publicação, pagamento, entrega ou integração ativa a partir de configuração.
- Não mexer no núcleo financeiro, CRM, atendimento, documentos, orçamento, assinaturas ou workflows nesta transição.

## 10. Adendo — provisionador já existente (infraestrutura do proprietário)

**Origem:** informado pelo proprietário em 2026-11-22. **Não está neste repositório:** file manager, phpMyAdmin, MySQL e o script de criação já operam fora do checkout. Nada aqui afirma que estão publicados ou funcionando sem evidência.

### O que já existe

- File manager para arquivos dos clientes.
- phpMyAdmin para administração de banco.
- Script de provisionamento em desenvolvimento.
- Proposta de interface gráfica para receber dados e criar: pasta do usuário, banco de dados, domínio e migração do cliente desde outro provedor.

### Ajuste ao plano

A Fase 4 deixa de ser “criar host” e passa a ser **integrar o provisionador existente**:

1. Transformar o script em API idempotente com `dry-run`, `apply`, `status` e `rollback`.
2. A interface gráfica chama essa API; a Véxora chama a interface por webhook assinado, após aprovação humana.
3. Entrada: `tenantId`, slug, domínio, tipo de site (estático / PHP-MySQL / Next.js), versão do PHP, quota, plano e origem da migração.
4. Saída: pasta criada, banco/usuário (senha só em cofre), vhost escrito, pendência de DNS, status de TLS e URL de health-check.
5. Isolamento: pasta, banco, usuário de banco e credenciais por cliente; phpMyAdmin sem login global.
6. Publicação só é marcada na Véxora depois de health-check real; nunca por configuração.

### Migração do provedor de origem

Não é one-click. Checklist mínimo: dump e arquivos → ambiente temporário → URLs/caminhos/config → TLS temporário → teste de formulários/login/e-mail → TTL baixo → troca de DNS → confirmação HTTPS → monitoramento. WordPress exige search-replace serializado; PHP puro e Next.js têm checklists próprios. Cuidar também de e-mails transacionais, cron, certificados e redirecionamentos.

### Relação com o que já está no repositório

- `docs/sites-cloudflare-deploy.md` descreve publicação estática via Cloudflare Pages; `docs/isolated-hosts.md` descreve domínios isolados e verificação TXT.
- `docs/implementation-register.md` e `docs/production-readiness.md` não confirmam publicação real, TLS ou domínio ativo.
- `docs/isolated-sites-and-platform-admin.md` registra provisionamento de departamentos/pipelines por pacote — não confundir com provisionamento de host.

### Decisões pendentes — resolvidas em 2026-11-22

As seis perguntas acima foram respondidas pelo proprietário e estão consolidadas na §11.

## 11. Arquitetura concreta do provisionador

**Status:** desenho aprovado; esqueleto, GUI e camada real com configuração por ambiente já implementados em `apps/provisioner`. A camada real **não foi executada** contra a infraestrutura do proprietário. Nada aqui afirma deploy, domínio no ar ou integração pronta.

### 11.1 Decisões confirmadas

| Item               | Decisão                                                                                                                                                                                          |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Script             | Ainda não existe; será criado em conjunto com o proprietário                                                                                                                                     |
| Proxy              | Traefik interno do Dokploy                                                                                                                                                                       |
| Acesso ao Docker   | Socket do Docker montado no serviço provisionador                                                                                                                                                |
| Projeto Dokploy    | `Estúdio de Sites`; serviço `Base` com MariaDB 11, phpMyAdmin e Filebrowser (via Docker)                                                                                                         |
| Sites atuais       | Rastreabem: HTML pronto. Morbeck: WordPress. Alto Araguaia: PHP com CMS próprio, fora do ar. SOS: portal grande sob avaliação. Nenhum código legado será trazido                                |
| Destino dos sites  | Decisão registrada em §12: Next.js para os três do ciclo inicial; Alto Araguaia com CMS headless; SOS sob avaliação                                                                                |
| Migração           | Origem por site: HTML, export WordPress ou dump do CMS PHP. Somente conteúdo/dados saneados são aproveitados; nenhum código legado é implantado. E-mail fica na Zoho Mail e está fora de escopo |
| Provedor de origem | Valuehost; o proprietário controla tudo, inclusive DNS                                                                                                                                           |
| Cofre de senhas    | Ainda não existe; adotar Docker secrets como primeiro passo                                                                                                                                      |
| Linguagem          | Node.js + TypeScript é a recomendação do plano; confirmar antes de escrever o primeiro arquivo de código                                                                                         |

### 11.2 Topologia no Dokploy

```text
Projeto: Estúdio de Sites
├─ serviço Base
│  ├─ MariaDB 11
│  ├─ phpMyAdmin
│  └─ Filebrowser
├─ serviço provisionador (novo, Node/TS)
│  └─ /var/run/docker.sock
├─ rede interna: provisionador ↔ Base ↔ containers dos sites
└─ Traefik interno: vhost por site + TLS
```

O provisionador é um **app interno de operação**, fora do core da Véxora. A Véxora continua sendo a porta de entrada: pedido, aprovação, registro e auditoria.

### 11.3 API do provisionador

```text
POST /provision/dry-run            → plano de ações; não cria nada
POST /provision/apply              → cria pasta, banco, usuário, vhost
GET  /provision/:requestId/status  → estado real: pasta, banco, TLS, health
POST /provision/:requestId/rollback→ desfaz apenas o criado pelo job
```

Contratos:

- `requestId` enviado pela Véxora é a chave de idempotência; repetir `apply` não duplica recurso.
- Estado persistido em tabela própria `provisioning_jobs`, separada dos bancos dos clientes.
- Log estruturado **sem senha, token ou string de conexão**.
- Webhook assinado entre Véxora e provisionador, com ID de correlação, retry e log.
- Nenhum `apply` sem aprovação humana registrada na Véxora.
- Publicação só é marcada na Véxora após health-check real no domínio final.

Entrada típica:

```json
{
  "requestId": "vx-123",
  "tenantId": "...",
  "slug": "alto-araguaia-imoveis",
  "domain": "exemplo.com.br",
  "type": "php-mysql",
  "phpVersion": "8.3",
  "quotaGb": 2,
  "source": "valuehost"
}
```

Saída típica:

```json
{
  "folder": "/sites/alto-araguaia-imoveis",
  "database": "site_alto_araguaia_imoveis",
  "dbUser": "site_alto_araguaia_imoveis",
  "vhost": "aplicado",
  "dnsPending": ["CNAME → traefik"],
  "tls": "pending",
  "healthUrl": "https://exemplo.com.br/health"
}
```

### 11.4 Isolamento e segurança

- Pasta, banco, usuário de banco e credenciais **por site**.
- Senha gerada pelo provisionador e gravada como Docker secret; nunca em log, response ou variável de ambiente visível na GUI.
- phpMyAdmin sem login global; acesso restrito à rede interna.
- O socket do Docker dá ao provisionador controle quase total do host. Mitigações obrigatórias antes do primeiro `apply`: allowlist de imagens e comandos, container sem privilégios adicionais além do socket, rede isolada, backup prévio e rollback testado.
- `dry-run` é sempre o primeiro passo de qualquer job; `apply` só aceita um plano gerado por `dry-run`.

### 11.5 Plano dos quatro sites

Três sites entram no ciclo inicial de recriação com sistema próprio. O download dos arquivos serve para resgatar conteúdo, imagens e dados; o código WordPress — inclusive o do site infectado — não é implantado no nosso servidor. O SOS Alto Araguaia fica **sob avaliação** e fora deste ciclo.

| Site citado                         | Estado na origem | Destino             | Estratégia                                                         |
| ----------------------------------- | ---------------- | ------------------- | ------------------------------------------------------------------ |
| Rastreabem                          | HTML completo já pronto | Next.js/MDX   | Converter o HTML em MDX como piloto de aprendizado e do template base |
| Morbeck x Carvalhinho               | WordPress, ~40 páginas | Next.js/MDX     | Exportar páginas e mídia; converter em MDX com menu automático    |
| Imobiliária (Alto Araguaia Imóveis) | PHP com CMS próprio do proprietário (antes WordPress), hoje fora do ar | Next.js + Puck + Payload/Strapi (preset `imoveis`) | Recuperar dump/export do CMS, mapear campos e importar para API; modelo do proprietário é a base visual |
| SOS Alto Araguaia                   | Portal de notícias, 2–5 GB de arquivos | Sob avaliação | Manter fora do ciclo inicial; medir storage, banda e tráfego antes de decidir |

**Nota:** MDX vale para Rastreabem e Morbeck x Carvalhinho. O Alto Araguaia Imóveis é dinâmico e usa CMS headless (§12.5); o SOS Alto Araguaia está sob avaliação, sem decisão de migração.

**Site infectado:** nenhum arquivo do WordPress comprometido é reaproveitado como código. Somente dados saneados previamente revisados. Não reutilizar templates, plugins, uploads executáveis ou credenciais antigas sem inspeção.

Rastreabem permanece como referência de cliente/segmento, não como identidade global nem fluxo obrigatório.

### 11.5.1 Escolha PHP puro × Next.js

Critério histórico declarado pelo proprietário: **se Next.js for mais leve e mais simples, usar Next.js; se não, usar PHP puro.** A decisão final registrada em §12 é **Next.js para Rastreabem, Morbeck x Carvalhinho e Alto Araguaia Imóveis**; o SOS Alto Araguaia segue sob avaliação. O texto abaixo permanece como registro do racional da avaliação.

- **Next.js**: preferido para sites estáticos ou com pouco dinamismo e sem necessidade de banco por site.
- **PHP puro**: preferido quando houver lógica de banco, formulários ou integrações que o sistema próprio precise manipular diretamente.
- O provisionador deve aceitar ambos os tipos desde o início no contrato de entrada (`type: "php-mysql" | "nextjs"`), mesmo que o primeiro piloto use apenas um.

### 11.6 Sequência de migração por site

1. O proprietário baixa arquivos e dump do banco na Valuehost e sobe para o nosso servidor.
2. Inventariar o material recebido: conteúdo, mídia, redirecionamentos, formulários e credenciais antigas.
3. Reduzir TTL de DNS.
4. Extrair e sane conteúdo e dados; **descartar código, plugins e templates WordPress**.
5. Recriar o site no sistema próprio (Next.js/MDX, conforme §12) em ambiente temporário no Dokploy.
6. Emitir TLS temporário e testar páginas, formulários e login no host temporário.
7. Registrar aprovação humana na Véxora.
8. Trocar DNS na Valuehost (o proprietário autoriza e executa).
9. Health-check real no domínio final; só então a Véxora marca “no ar”.
10. Manter rollback documentado: voltar DNS e preservar o ambiente anterior até a validação.

E-mails transacionais ficam na Zoho Mail e não entram nesta migração.

### 11.7 Critérios de aceite do primeiro esqueleto (sem domínio real)

- `dry-run` não cria nenhum recurso.
- `apply` cria pasta, banco e usuário em ambiente de teste.
- `status` devolve o estado real consultado, não um valor assumido.
- `rollback` desfaz apenas recursos criados pelo mesmo `requestId`.
- Testes automatizados cobrem idempotência, isolamento entre sites e ausência de segredos em log.
- Nenhuma alteração de DNS, TLS público ou domínio de cliente nesta etapa.

### 11.8 Matriz de versões do PHP

O provisionador deve oferecer explicitamente a escolha da versão do PHP por site. Lista solicitada pelo proprietário:

`5.2`, `5.3`, `5.4`, `5.5`, `5.6`, `7.0`, `7.1`, `7.2`, `7.3`, `7.4`, `8.0`, `8.1`, `8.2`, `8.3`, `8.4`, `8.5`, `8.6`.

Implementação:

- Cada versão corresponde a uma **imagem Docker fixada por tag**, nunca `latest`.
- A versão escolhida fica registrada no job e em `dry-run`; `apply` usa exatamente a mesma versão.
- **Ressalva de segurança:** versões 5.x e 7.x estão fora de suporte e não devem ser padrão para sites recém-criados. Selecioná-las exige confirmação explícita do operador e aviso no `dry-run`. Como os quatro sites serão recriados do zero, a recomendação é iniciar na linha 8.x.
- A lista acima é o contrato de UI solicitado; disponibilidade real de cada imagem e compatibilidade com o MariaDB 11 devem ser validadas antes de habilitar o `apply`.

### 11.9 Decisões registradas e pontos ainda pendentes

**Confirmados:**

- Node.js + TypeScript para o provisionador.
- A GUI web faz parte do escopo e é servida pelo próprio processo.
- Todas as 17 versões PHP (5.2 a 8.6) ficam habilitadas no contrato; 5.x/7.x exigem aviso no `dry-run` e confirmação explícita no `apply`, e nunca são padrão na GUI.
- A camada real é configurada por variáveis de ambiente; senhas e tokens entram somente como caminhos de Docker secrets. O modo padrão continua sendo simulação e o `apply` real exige uma chave adicional de habilitação.
- Estado dos jobs persistido em arquivo próprio, separado dos bancos dos clientes; a tabela `provisioning_jobs` no MariaDB segue como evolução prevista.

**Ainda pendentes (bloqueiam o primeiro `apply` real):**

- Slugs e domínios reais dos quatro sites.
- Tipo escolhido por site: resolvido em §12 — Next.js para os quatro sites.
- Contratos reais dos endpoints internos de administração do MariaDB e do Filebrowser (formato de criação de usuário, escopo e remoção).
- Formato efetivo e política de rotação dos Docker secrets, incluindo quem provisiona os secrets de senha por site.
- Chave e escopo do webhook assinado (global do provisionador ou por tenant) e a identidade do aprovador enviada pela Véxora.
- Disponibilidade real das imagens das 17 versões PHP e compatibilidade com o MariaDB 11, mesmo com todas habilitadas no contrato.

## 12. Novo serviço de sites da Véxora — HUB (decisão de 2026-11-23)

**Status:** decisão do proprietário. Substitui o criador de sites com IA descrito nas fases iniciais deste documento. Nada aqui afirma publicação, domínio ativo ou integração funcionando sem evidência.

A Véxora deixa de gerar sites por prompt e passa a ser **gestora** do processo: pedido, preview, aprovação, publicação, versão, histórico e auditoria. A execução — esqueleto Next.js, conteúdo e hospedagem — fica fora do core.

### 12.1 Topologia adotada

```text
HUB Véxora (tenant, pedido, aprovação, auditoria)
        → GitHub (template + MDX + imagens por tenant)
        → Cloudflare Pages (build estático)
        → Domínio do cliente (DNS/TLS na Cloudflare)
        → Formulários → API tenant-scoped da Véxora
```

- O HUB não renderiza HTML do site e não hospeda página.
- Um repositório por empresa, derivado de um template base Next.js + MDX.
- `output: 'export'` como padrão: a saída é uma pasta estática, replicável em qualquer host.
- Cloudflare Images/R2 são evolução opcional; a versão inicial mantém imagens em `public/images/` no repositório.
- Nenhuma credencial ou sessão de produção é copiada entre empresas.

### 12.2 Edição e menu

O esqueleto (header, sidebar, footer) vive em componentes do template. O conteúdo vive em arquivos `.mdx`. O menu é gerado de uma fonte única (`content/navigation.ts`), com `label`, `slug`, `ordem` e `pai`. Trocar o nome de um item do menu exige **uma** edição; nenhuma página HTML precisa ser aberta.

Exemplo mínimo:

```ts
export const navigation = [
  { label: "Início", slug: "/" },
  { label: "Serviços", slug: "/servicos" },
  { label: "Contato", slug: "/contato" },
];
```

Cada página contém só o miolo:

```mdx
---
title: Serviços
---

Conteúdo da página...
```

### 12.3 Sites dinâmicos

"Dinâmico" não significa voltar a WordPress/PHP. Significa que o conteúdo muda sem edição manual de HTML. A arquitetura divide em três níveis:

| Nível | Exemplos | Como é entregue |
| ----- | -------- | --------------- |
| A — conteúdo | blog, portal de notícias, institucional | Next.js estático/ISR + MDX ou CMS externo; busca e filtros no cliente ou via API |
| B — consulta a dados | imobiliária com busca e filtros | Next.js + API externa por tenant; sem banco no site; filtros por query params |
| C — transação | e-commerce, área autenticada | Next.js + backend de comércio externo (catálogo, estoque, pedidos, pagamentos); a Véxora registra pedido, aprovação, versão e auditoria, não executa pagamento |

Regras comuns:

- Nenhum MySQL por site; dados ficam em serviço externo tenant-scoped.
- Busca com índice próprio quando o volume justificar; filtros pequenos resolvem no cliente.
- Preços, estoque e disponibilidade vêm da API, nunca de arquivo estático.
- Publicação só é marcada como concluída após health-check 2xx no domínio final.
- O HUB distingue `configurado`, `executado`, `confirmado` e `falhou`; não afirma venda, pagamento ou publicação por flag de configuração.

### 12.4 Conversão dos quatro sites

- **Rastreabem:** o proprietário já tem o HTML completo; a conversão para MDX é o piloto de aprendizado e do template base.
- **Morbeck x Carvalhinho:** origem WordPress, ~40 páginas convertidas em MDX com menu automático.
- **Alto Araguaia Imóveis:** nível B. Já foi WordPress, hoje é PHP com CMS próprio do proprietário e está fora do ar. A fonte dos imóveis é o que for recuperável desse CMS (dump ou export); o modelo feito pelo proprietário é a base visual. Destino: Next.js + Puck + Payload/Strapi com preset `imoveis`, busca e filtros via API — não é site somente em MDX.
- **SOS Alto Araguaia:** portal de notícias grande, com 2–5 GB de arquivos, em grande parte mídia. Migrar não é simples conversão: exige plano de storage/CDN, redirecionamentos e import incremental. Decisão: **sob avaliação**, fora do ciclo inicial; manter o site atual com backup até medir espaço, banda e tráfego.

A decisão "PHP puro ou Next.js, por site" registrada em §11.1 e §11.9 fica assim resolvida: **Next.js para Rastreabem, Morbeck x Carvalhinho e Alto Araguaia Imóveis**; o SOS Alto Araguaia fica sob avaliação, sem mudança de hospedagem decidida.

### 12.5 Template de CMS para sites dinâmicos

Não criar um CMS artesanal por site. Criar **um template versionado no GitHub**, com presets por vertical e instância por empresa.

- Base: CMS headless self-hosted de código aberto (Payload — padrão — ou Strapi) + Postgres.
- Edição visual: Puck para montar páginas em Next.js/React; o CMS continua responsável pelas collections e pela API tenant-scoped.
- Decisão de 2026-11-23: Alto Araguaia Imóveis usa Puck + Payload/Strapi. Decisão de 2026-11-24 (proprietário): **Payload CMS**, instância única com papéis e usuários ilimitados; Directus fica removido do plano conforme `docs/payload-substitui-directus.md`.
- Presets: `conteudo` (posts/páginas), `imoveis` (imóveis, fotos, filtros) e `produtos` (catálogo editorial).
- Cada instância expõe API tenant-scoped; o site Next.js consome essa API e o HUB registra pedido, aprovação, versão e auditoria.
- Novo site = escolher preset, subir instância a partir do mesmo template e apontar o front para a API.
- E-commerce: o CMS fornece conteúdo e catálogo editorial; carrinho, estoque, pedidos e pagamentos ficam em motor de comércio externo. O CMS não vira checkout.
- O template é replicável com `docker compose` + dump/seed, sem copiar credenciais entre empresas.

## 13. Sistemas verticais — separação do serviço de Sites (decisão de 2026-11-23)

Os projetos de operação **não fazem parte do HUB de Sites**. Sites tratam de presença digital (conteúdo, busca, transação editoriais); sistemas verticais tratam de operação do negócio (agenda, presença, alunos, notas, pedidos, cobrança). A fronteira evita que o HUB vire CMS ou sistema de gestão, e evita que cada cliente receba um sistema artesanal novo.

### 13.1 Mapa dos projetos

| Projeto | Onde fica | Núcleos reaproveitados |
| ------- | --------- | ---------------------- |
| 4 sites (Rastreabem, Morbeck x Carvalhinho, SOS Alto Araguaia, Alto Araguaia Imóveis) | HUB de Sites + Next.js/MDX + Cloudflare (§12) | template base, menu centralizado, CMS headless opcional |
| Escola de música | módulo vertical nativo | agenda, CRM (aluno como contato), professores/departamentos, Financeiro/Asaas, WhatsApp/e-mail, auditoria |
| Escola com provas e notas | módulo vertical nativo | autenticação tenant-scoped, papéis, conteúdo em vídeo, notas em tempo real, cobrança recorrente |
| Estética | configuração/segmento sobre os núcleos | agenda, profissional, cliente, pacote de sessões, cobrança |
| Delivery | configuração/segmento sobre os núcleos | CRM, pedidos, Financeiro; checkout em motor de comércio externo |

### 13.2 Escola de música

- **Agendamento:** agenda da Véxora, com professor como atendente/departamento e aluno como contato do CRM. Recorrência por regra determinística; sem IA para decidir horário.
- **Presença:** registro separado de aluno e professor, com histórico por turma/aula.
- **Aulas restantes e reposições:** cálculo determinístico a partir do pacote contratado e dos registros de presença. Gráficos mostram saldo e reposições pendentes; não inferem pagamento.
- **Cobrança recorrente:** Financeiro/Asaas com agendamento; avisos por WhatsApp/e-mail respeitam consentimento e registro. Estados explícitos: `agendado`, `enviado`, `confirmado`, `falhou`. Nunca marcar `pago` sem confirmação do provedor.
- **Isolamento:** alunos, professores, turmas, mensagens e cobranças por empresa; nenhuma credencial ou sessão copiada da Véxora Matriz.

### 13.3 Escola com provas, notas e vídeo

- **Acesso:** login tenant-scoped, papel `STUDENT`, separado do administrador da plataforma e do OWNER da empresa.
- **Conteúdo:** vídeo do YouTube por embed; o conteúdo permanece no YouTube, sem cópia ou redistribuição.
- **Notas:** registro em tempo real pela API do módulo, com atualização ao vivo restrita à turma/empresa do aluno.
- **Mensalidade:** mesma base de cobrança recorrente do Asaas, com aviso programável por WhatsApp e e-mail. A Véxora registra agendamento e envio; confirmação de pagamento só com evidência do provedor.

### 13.4 Estética e Delivery como segmentos

Não criar um sistema novo por segmento. Usar os mesmos núcleos com vocabulário e configuração próprios:

- **Estética:** profissional substitui professor; cliente substitui aluno; sessões substituem aulas. Agenda, presença, pacote e cobrança reaproveitados; apenas os rótulos e templates de negócio mudam.
- **Delivery:** pedido, cliente e cobrança reaproveitam CRM e Financeiro. Cardápio, carrinho e checkout, quando existirem, ficam em motor de comércio externo — o mesmo limite registrado para e-commerce em §12.5.

### 13.5 Regras de fronteira

- O HUB de Sites continua sem renderizar HTML, sem hospedar página e sem virar CMS; ele registra pedido, aprovação, versão, histórico e auditoria.
- O template de CMS de §12.5 serve conteúdo dos sites dinâmicos. Sistemas verticais usam os núcleos transacionais da Véxora; não são alimentados por MDX nem por esse CMS.
- Cada conexão, credencial, consulta e operação é tenant-scoped.
- O sistema distingue `configurado`, `executado`, `confirmado`, `ambíguo` e `falhou`. Configurar uma cobrança não é afirmar pagamento; configurar integração não é afirmar envio.
- Nenhuma afirmação de deploy, domínio ativo, pagamento, publicação ou integração funcionando no ar sem evidência.

### 13.6 Ordem de implantação proposta

1. HUB de Sites e template base Next.js/MDX (em andamento).
2. Piloto do CMS headless para o Alto Araguaia Imóveis: recuperar o que for possível do CMS PHP do proprietário e usar o modelo dele como base visual. O site já foi WordPress, mas a fonte atual é PHP.
3. Módulo Escola de Música (agenda, presença, saldo de aulas e cobrança recorrente) — fatia inicial em implementação nesta data; ver §13.7.
4. Módulo Escola com provas/notas/vídeo/login de aluno.
5. Segmentos Estética e Delivery por cima dos mesmos núcleos.
6. SOS Alto Araguaia: fora do ciclo inicial; reavaliar com medição de storage, banda e tráfego antes de qualquer migração.

### 13.7 Estado da fatia inicial da Escola de Música (2026-11-27)

**Implementado em código (PR de integração, sujeito ao CI):** turmas com professor vindo de Departamento ativo do mesmo tenant, matrículas de alunos existentes no CRM, registro de presença por data com trava transacional por empresa, e saldo de aulas/reposições calculado de forma determinística no servidor. A interface do módulo fica em `Escola de Música` na navegação e herda `CALENDAR`, respeitando negativas individuais. Os modelos da fatia (`MusicClass`, `MusicEnrollment`, `MusicAttendance`) ficam no banco principal da Suite, tenant-scoped; `infra/schools` continua sendo uma stack separada e não é alterada por esta fatia.

**Não executado e não afirmado:** nenhum envio de WhatsApp/e-mail, nenhuma cobrança criada no Asaas ou em outro provedor, nenhum pagamento confirmado, nenhum agente RBM/SMS/RCS ativo e nenhum deploy em produção. A cobrança registrada fica apenas `SCHEDULED`, com `executed: false` e `confirmed: false`; os estados `SENT`, `CONFIRMED` e `FAILED` exigem evidência do provedor antes de aparecerem como fatos. SMS/RCS fica adiado e registrado apenas como opção de escopo por empresa.

**Próximo vertice após validação:** provas/notas/vídeo com papel `STUDENT`, mantendo a mesma fronteira de isolamento e as mesmas regras de evidência.
