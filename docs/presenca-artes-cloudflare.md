# Presença Véxora — sites externos e artes publicadas na Cloudflare

Guia curto de uso. **Estado: implementado no código, sem publicação executada nesta rodada.** Nada aqui afirma deploy, domínio, TLS ou envio sem evidência de HTTP 2xx na URL final.

## 1. Onde fica

No produto: **Sites** → seção **“Presença Véxora — sites e artes”**. O módulo continua no menu Sites porque ele é a área de presença digital da empresa: o HUB governua pedidos de site, e a Presença registra o que já existe e produz peças.

Ações disponíveis apenas para `OWNER`, `ADMIN` e `MANAGER` da empresa atual. Toda leitura e escrita usa `req.user.tenantId`; nenhuma credencial ou sessão é copiada entre empresas.

## 2. Site externo (referência informativa)

1. Em “Sites externos desta empresa”, informe título, URL `https://...` e descrição curta.
2. Clique em **Cadastrar referência**.
3. O cartão aparece com o link e o rótulo “fora da Véxora”.

**O que isso faz:** registra que o site já está no ar fora da plataforma. **O que não faz:** não gera HTML, não hospeda, não publica, não configura DNS/TLS e não altera o status `PUBLISHED` do HUB. O Rastreabem pode ser cadastrado aqui como `https://rastreabem.com.br` sem transformar uma observação externa em afirmação de publicação pela Véxora.

## 3. Arte — criar, pré-visualizar e publicar

1. No “Estúdio de artes Véxora”, preencha título, manchete, subtítulo, chamada e cores.
2. Clique em **Criar arte**. A Véxora gera um SVG determinístico, escapa o texto, calcula SHA-256 e salva a peça como rascunho (`READY`) na empresa.
3. Clique em **Ver arte** para conferir a prévia antes de publicar.
4. Clique em **Publicar via Cloudflare**. O backend:
   - cria/localiza o projeto `vexora-presenca-<tenant>` na conta Cloudflare configurada;
   - envia `index.html`, o SVG e uma página por arte;
   - faz `fetch` na URL final e **só grava `PUBLISHED` se a resposta for 2xx**;
   - se o envio falhar ou a URL não responder 2xx, grava `FAILED` com mensagem explícita e mantém o rascunho preservado.

Se `CLOUDFLARE_API_TOKEN` ou `CLOUDFLARE_ACCOUNT_ID` não estiverem configurados, a tela avisa “Cloudflare não configurada” e o botão de publicar fica desabilitado. A arte ainda pode ser criada e visualizada — sem fingimento de publicação.

## 4. Resultado esperado

- Cartão com **“Publicada e verificada”**, link clicável para a URL final e data de verificação — somente após 2xx real.
- Sem 2xx: **“Publicação não confirmada”**, erro visível e arte mantida como rascunho/falha, sem link de publicação.
- Referência externa: link útil em Sites, sem afirmar autoria ou hospedagem pela Véxora.

## 5. Evidência e limites

- Testes locais: `presence.service.spec.ts` (6/6) e `sites-hub-workspace.test.mjs` (3/3); `tsc --noEmit` limpo em API e Web.
- Nenhuma credencial Cloudflare foi usada, nenhum deploy foi disparado e nenhuma URL foi verificada nesta rodada. Para publicar de verdade, configure as variáveis de ambiente e clique em publicar no tenant correto.
- O comando de fluxo `No bloco Menu principal Acrescente a opção 2ª Via Boleto (Rastreabem)` continua sendo executado no Assistente/Chatbot como rascunho; salvar/publicar o fluxo permanece manual.
