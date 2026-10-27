# Mobile e aplicativo instalável

A Véxora oferece manifesto, ícones PNG, janela standalone, atalhos e service worker. O botão de sino no cabeçalho abre **Aplicativo e notificações**. A permissão é solicitada somente ao clicar em **Ativar notificações**.

As assinaturas são persistidas por empresa, usuário e dispositivo. Chaves VAPID por empresa ficam criptografadas com `INTEGRATION_ENCRYPTION_KEY` ou, como fallback, `JWT_ACCESS_SECRET`. Preserve essa chave entre deploys; sua troca exige renovar credenciais protegidas. O transporte é Web Push com `web-push`, endpoints limitados a serviços de navegador conhecidos e payload sem conteúdo de conversas. Entrega é melhor esforço: avisos têm validade de cinco minutos e não substituem o histórico persistido de mensagens. Não há uma caixa durável de notificações nem garantia de entrega de avisos.

Mensagens novas notificam o atendente atribuído; sem atribuição, os integrantes do time; sem time, os dispositivos ativos da fila geral. Vínculo, usuário ativo e empresa ativa são reavaliados. Assinaturas expiradas são removidas. Sair cancela a assinatura do dispositivo e limpa avisos existentes. Há até dez dispositivos por usuário/empresa; testes têm intervalo mínimo de trinta segundos.

Somente página offline e ícones públicos são cacheados. Conversas, API, arquivos do Drive e credenciais não são disponibilizados offline. O aplicativo requer conexão para operar e mostra uma tela explicativa quando perde a rede.

## Verificação após implantação

1. Conferir `/manifest.webmanifest`, `/sw.js`, `/pwa/icon/192`, `/pwa/icon/512` e o cache-control do service worker.
2. Navegar em 375×812, 390×844, 412×915, 768×1024 e desktop. Conferir ausência de rolagem horizontal da página, campos legíveis, botões acessíveis, navegação inferior, composer com teclado, consulta CPF, contato, editor e Drive.
3. Confirmar que o editor recupera o servidor, salva alteração, mantém após trocar módulo/recarregar e não substitui um fluxo existente pelo exemplo.
4. Instalar no Chrome/Edge de desktop e no Android; verificar ícone e janela própria. No iPhone/iPad compatível, adicionar à Tela de Início e abrir pelo ícone antes de ativar push.
5. Autorizar notificações, enviar teste somente ao dispositivo atual, fechar o aplicativo e receber uma mensagem real autorizada. Conferir abertura da conversa, desativação, logout e remoção do vínculo.
6. Conferir permissões e Foco/Não Perturbe. Emulador de viewport não comprova instalação ou push em aparelho físico.

Referências: [guia oficial do Next.js](https://nextjs.org/docs/app/guides/progressive-web-apps), [instalação de PWAs no MDN](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Guides/Making_PWAs_installable).
