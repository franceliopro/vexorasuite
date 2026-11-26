# Véxora Suite — Alike Experience

Website institucional premium, inspirado na composição editorial da referência Alike, adaptado à identidade da Véxora Suite.

## Estrutura

- `index.html` — página completa, responsiva e interativa.
- `assets/logo-vexora.svg` — arquivo original do logotipo fornecido, preservado sem recoloração ou redesenho.
- `assets/logo-app.svg` — logotipo fornecido para os ícones dos apps nativos, preservado sem recoloração ou redesenho.
- `assets/*.webp` — capturas de tela dos módulos reais fornecidas para apresentação.
- `assets/marketing-preview.svg` — demonstração visual conceitual da área de Marketing.
- `media/crm-desktop-flow.mp4` — vídeo curto em loop simulando a movimentação de uma oportunidade no Kanban do CRM.
- `media/crm-mobile-flow.mp4` — vídeo curto em loop mostrando conversa mobile, identificação por IA e transbordo para a equipe.
- `media/*-poster.jpg` — posters dos vídeos para carregamento e fallback.
- `media/source/` — HTMLs usados para construir as duas simulações de vídeo.
- `preview/` — capturas de validação desktop e mobile.

## Como visualizar

1. Extraia o ZIP mantendo as pastas `assets` e `media` ao lado de `index.html`.
2. Abra `index.html` em um navegador moderno.
3. Use o menu sanduíche no canto superior direito.
4. Na segunda dobra, selecione os produtos para alternar a janela principal.

## Interações incluídas

- Hero em tela cheia com partículas, brilho e parallax controlado pelo ponteiro.
- Cabeçalho sobreposto ao Hero com marca à esquerda e menu sanduíche à direita.
- Menu de navegação em painel lateral.
- Vitrine de produtos com tabs que alternam capturas ou vídeo de demonstração.
- Janelas sobrepostas de desktop e mobile, com vídeos em loop e interface responsiva.
- Animações de entrada, efeitos hover e respeito à preferência `prefers-reduced-motion`.

## Observação sobre as simulações

Os vídeos de CRM desktop e mobile são demonstrações visuais criadas para explicar a jornada (entrada, triagem, CRM e transbordo). Não representam execução de dados reais nem conexão em tempo real com a plataforma.

## Antes de publicar

- Conectar o formulário de demonstração ao CRM/backend ou ao canal comercial.
- Validar valores, limites e entitlements dos planos.
- Revisar políticas de privacidade, consentimento e analytics.
- Publicar em HTTPS e testar os links finais de contato.
