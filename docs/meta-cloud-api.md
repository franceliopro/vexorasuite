# WhatsApp Oficial pela Meta (Cloud API) — conexão direta no Véxora

O caminho oficial sem depender de QR code, com status de entrega (enviado/entregue/lido) e sem o risco de ban do WAHA.

## O que a empresa precisa ter

1. **App próprio** no [Meta for Developers](https://developers.facebook.com/) — tipo "Business".
2. **WhatsApp Business Account (WABA)** vinculada à sua conta empresarial no [Business Manager](https://business.facebook.com) com o número oficial já registrado.
3. **Verificação empresarial** do negócio — exigida pelo Meta para escalar o número (sem ela, o número envia em tier limitado). Isto é uma exigência do Meta, não uma limitação do Véxora: o documento da empresa (CNPJ ou equivalente) fica com o Meta, não com a Véxora.
4. **System User** (Configurações → Usuários) com permissão `whatsapp_business_messaging` e `whatsapp_business_management`, e um **token permanente** gerado a partir dele.

## Como conectar no Véxora

Em **Conexões → WhatsApp Oficial (Meta Cloud API)**:

1. Nome da conexão (livre).
2. Phone Number ID, WhatsApp Business Account ID, **token permanente** (System User) e **App Secret** (do seu app Meta).
3. Clique em **Conectar WhatsApp Oficial** — o Véxora valida número e token contra a Graph API antes de salvar. Os segredos ficam cifrados (mesma proteção das outras credenciais sociais); o token nunca volta à tela.
4. Copie a **URL do webhook** gerada (ex.: `https://app.vexorasuite.com.br/api/webhooks/meta/<id>`).
5. No app do Meta: **WhatsApp → Configuration → Webhook** → cole a URL e o **Verify Token** (o Véxora gera um exclusivo para a empresa), e assine as mudanças de **messages**.
6. Teste mandando uma mensagem para o número — ela entra na inbox, responde ao fluxo do robô e você vê entregue/lido na conversa.

## O que esta versão suporta

- Receber texto, imagem, vídeo, áudio, documento, figurinha, localização; mensagens caem na inbox com o mesmo fluxo do WAHA (protocolo, setor, IA, notas).
- Status **sent → delivered → read** atualizados ao vivo na conversa.
- Enviar texto pela inbox (o atendente aparece com etiqueta pública como nos outros canais).
- Marcar como lida (recibo azul) quando o robô/IA está no atendimento.

## Ainda não suportado (v1 honesto)

- **Enviar mídia** (imagem/áudio/arquivo) pelo canal oficial — o atendente pode receber, mas não enviar por aqui; envie pelo app oficial.
- **Templates de marketing** e o fluxo completo de "Mensagens comerciais" pelo Véxora — usa-se o painel do Meta para gerenciar templates enquanto isso.
- Delegação de leitura/escrita de grupos: a Cloud API não suporta grupos de WhatsApp — grupos continuam exclusivos do canal WAHA.

## Onde fica a segurança

- Webhook validado por assinatura **HMAC-SHA256** do corpo (`x-hub-signature-256`) contra o App Secret — requisições não assinadas são rejeitadas.
- O token de acesso é usado exclusivamente no servidor; o frontend recebe apenas o status da conexão.
- O webhook público de verificação só emite o challenge se o verify token bater — caso contrário, 403.

## Dúvidas frequentes

**"Posso usar sem CNPJ agora?"** — Para testar e demonstrar: sim. A Meta permite ter WABA e enviar em tier de teste/limitado sem verificação; para escalar e remover o selo de "não verificado", o negócio precisa ser verificado — isto vale para qualquer caminho oficial (Zernio, BSP ou API direta). O documento fica com o Meta.
