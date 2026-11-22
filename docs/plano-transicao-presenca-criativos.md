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
| Sites atuais       | Todos os quatro rodam WordPress na origem, mas **nenhum WordPress será trazido**: os sites serão recriados com sistema próprio                                                                   |
| Destino dos sites  | PHP puro ou Next.js, conforme avaliação de simplicidade e peso; decisão por site ainda pendente                                                                                                  |
| Migração           | O proprietário baixa arquivos e banco na Valuehost e sobe para o nosso servidor; somente conteúdo/dados são aproveitados, não o código WordPress. E-mail fica na Zoho Mail e está fora de escopo |
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

Todos os quatro serão **recriados com sistema próprio**. O download dos arquivos serve para resgatar conteúdo, imagens e dados; o código WordPress — inclusive o do site infectado — não é implantado no nosso servidor.

| Site citado                         | Estado na origem | Destino             | Estratégia                                                         |
| ----------------------------------- | ---------------- | ------------------- | ------------------------------------------------------------------ |
| Imobiliária (Alto Araguaia Imóveis) | WordPress        | PHP puro ou Next.js | Extrair imóveis, textos e mídia do banco/arquivos; recriar sem CMS |
| Rastreabem                          | WordPress        | PHP puro ou Next.js | Extrair conteúdo; recriar sem CMS                                  |
| SOS Alto Araguaia                   | WordPress        | PHP puro ou Next.js | Extrair conteúdo; recriar sem CMS                                  |
| Morbeck x Carvalhinho               | WordPress        | PHP puro ou Next.js | Extrair conteúdo; recriar sem CMS                                  |

**Site infectado:** nenhum arquivo do WordPress comprometido é reaproveitado como código. Somente dados saneados previamente revisados. Não reutilizar templates, plugins, uploads executáveis ou credenciais antigas sem inspeção.

Rastreabem permanece como referência de cliente/segmento, não como identidade global nem fluxo obrigatório.

### 11.5.1 Escolha PHP puro × Next.js

A decisão é por site, com este critério declarado pelo proprietário: **se Next.js for mais leve e mais simples, usar Next.js; se não, usar PHP puro.**

- **Next.js**: preferido para sites estáticos ou com pouco dinamismo e sem necessidade de banco por site.
- **PHP puro**: preferido quando houver lógica de banco, formulários ou integrações que o sistema próprio precise manipular diretamente.
- O provisionador deve aceitar ambos os tipos desde o início no contrato de entrada (`type: "php-mysql" | "nextjs"`), mesmo que o primeiro piloto use apenas um.

### 11.6 Sequência de migração por site

1. O proprietário baixa arquivos e dump do banco na Valuehost e sobe para o nosso servidor.
2. Inventariar o material recebido: conteúdo, mídia, redirecionamentos, formulários e credenciais antigas.
3. Reduzir TTL de DNS.
4. Extrair e sane conteúdo e dados; **descartar código, plugins e templates WordPress**.
5. Recriar o site no sistema próprio (PHP puro ou Next.js) em ambiente temporário no Dokploy.
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
- Tipo escolhido por site (PHP puro ou Next.js), após a avaliação de simplicidade.
- Contratos reais dos endpoints internos de administração do MariaDB e do Filebrowser (formato de criação de usuário, escopo e remoção).
- Formato efetivo e política de rotação dos Docker secrets, incluindo quem provisiona os secrets de senha por site.
- Chave e escopo do webhook assinado (global do provisionador ou por tenant) e a identidade do aprovador enviada pela Véxora.
- Disponibilidade real das imagens das 17 versões PHP e compatibilidade com o MariaDB 11, mesmo com todas habilitadas no contrato.
