# Modelo de insumos — sites e artes

**Uso:** copie os blocos abaixo, preencha e envie de uma vez. Cada bloco corresponde a um campo que a Véxora já valida no sistema; nenhum pode ficar em branco.

**Importante:** enviar este formulário **não** publica site, não cria arte, não cobra cliente e não altera DNS. Ele apenas fornece os insumos para que o trabalho possa começar. A publicação real continua dependendo de credenciais, acesso e evidência 2xx no domínio final. SOS Alto Araguaia permanece adiado por decisão do proprietário.

---

## 1. Sites — um bloco por site

> Repita para: Alto Araguaia Imóveis, Rastreabem, Morbeck x Carvalhinho.
> SOS Alto Araguaia: não preencher nesta rodada.

```
Site:
Slug definitivo:
Domínio real onde deve responder:
Origem do conteúdo (HTML / export WordPress / dump CMS PHP):
Como obter a origem (link, arquivo ou quem envia):
Mídias e documentos necessários (com direito de uso confirmado? sim/não):
Redirecionamentos antigos a preservar (de → para):
Formulários e integrações atuais (incluir destino dos e-mails):
Credenciais antigas que precisam ser invalidadas/substituídas:
Aprovador nomeado para pedido/publicação:
Repositório GitHub pretendido (ou "criar a partir do template"):
Token GitHub com escopo mínimo (enviar por canal seguro, não neste documento):
Conta/token Cloudflare Pages + acesso DNS/TLS (enviar por canal seguro):
```

**Situação conhecida (não precisa repetir):**
- Rastreabem: HTML completo; já convertido em piloto Next.js/MDX, build estático e auditoria de links passaram. Falta domínio/credenciais para publicar.
- Morbeck x Carvalhinho: WordPress com ~40 páginas; falta export.
- Alto Araguaia Imóveis: PHP com CMS próprio e fora do ar; falta dump/export e campos.

---

## 2. Artes — um bloco por peça

> Repita para cada peça. Estes são exatamente os oito campos exigidos pelo intake em Marketing → Briefings.

```
Título da peça:
1. Objetivo (o que a peça deve conseguir):
2. Canal e formato (ex.: Instagram feed 1080x1080, 30s, legenda/áudio):
3. Identidade visual (cores, logo, tipografia, tom de voz):
4. Texto e matéria-prima aprovados (fotos, vídeos, dados, fonte):
5. Prazo (AAAA-MM-DD):
6. Aprovador responsável (nome e função):
7. Destino da publicação (site/rede/canal) e quem executa:
```

**Regra:** sem os oito campos preenchidos, o briefing não é aceito. Nenhuma peça é considerada criada, aprovada, publicada ou entregue apenas por existir rascunho ou configuração.

---

## 3. Pagamentos — somente se houver cobrança real

> Não preencher para teste interno. Necessário apenas para validar cobrança com Stripe/InfinitePay.

```
Provedor (Stripe / InfinitePay):
Ambiente (sandbox / produção):
Chaves de API (enviar por canal seguro, não neste documento):
Webhook secret/handle (Stripe: whsec_...; InfinitePay: handle da URL):
Webhook registrado no provedor? (sim/não + URL):
Valor de teste em centavos:
```

Sem credenciais, webhook registrado e evidência do provedor, nenhuma cobrança é considerada aprovada ou realizada.

---

## 4. O que acontece depois do envio

1. Os campos são registrados no HUB de Sites e no intake de Briefings, com aprovador e tenant.
2. Cada pedido recebe número, versão e histórico de auditoria.
3. A execução fica fora da Véxora: repositório GitHub, Cloudflare Pages, ferramenta de design.
4. `PUBLISHED`, `TLS ativo`, `pago` e `entregue` só aparecem após evidência real (2xx no domínio final, confirmação do provedor ou registro de entrega). Até lá, o estado permanece como pedido/preview/recebido.
