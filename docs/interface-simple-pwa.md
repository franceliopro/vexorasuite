# Interface simples e instalação da Véxora

## Navegação e hierarquia

Postagens abre na lista de publicações, reunindo criações com IA e envios de mídias prontas. Busca e filtros ajudam a localizar rascunhos, agendadas, publicadas e itens para revisão. O botão Nova publicação abre uma tarefa de cada vez: enviar arquivo ou criar com IA. A revisão substitui a lista até ser fechada.

Automações reúne pastas prontas/novidades e rotinas de IA. A configuração da pasta só abre ao criar ou editar uma rotina. Atividade reúne os resultados; cada execução revela seus detalhes sob demanda. O envio continua exigindo as contas e a confirmação já previstas. A mudança de interface não publica arquivos, ativa rotinas nem altera preferências existentes.

Referências criativas abre na biblioteca visual. Adicionar referência mostra um único formulário, com escolha entre arquivo local e link do Drive. Conta Google só é pedida quando há mais de uma. Finalidade e orientações são opcionais e ficam recolhidas. Cada referência mostra prévia, nome e estado; os controles aparecem em Editar referência. A configuração da pasta utilizada pela IA permanece disponível ao final da biblioteca.

Os títulos, controles e formulários usam uma camada visual compartilhada: título de página 24 px (22 no celular), título de seção 17 px (16 no celular), corpo 14 px e rótulo 13 px. Campos no celular mantêm 16 px e alvos de toque de 44 px. As cores seguem o tema da empresa. Os avisos globais são agrupados em uma faixa; o resumo mantém visível quando o WhatsApp requer atenção. Os testes avançados de Agentes de IA ficam recolhidos.

## PWA

A base já existente foi mantida e aprimorada. O menu oferece Instalar Véxora e abre o painel de instalação. No Chrome/Edge compatível, o botão usa a oferta nativa quando disponível. No iPhone/iPad, Compartilhar → Adicionar à Tela de Início. No Safari do Mac, Arquivo → Adicionar ao Dock. A decisão final de instalação pertence ao usuário no navegador/aparelho.

O manifesto define identidade estável, janela standalone, ícones de 192/512 px e atalhos para Conversas, CRM e Postagens. O ícone Apple tem 180 px. O service worker permanece sem armazenar páginas privadas, conversas, credenciais ou respostas da API. Apenas a página pública de indisponibilidade e os ícones públicos podem ser atendidos pelo cache. Recursos operacionais precisam de conexão. Não foi criada distribuição pela App Store/Google Play.

O pipeline do container web verifica o manifesto, dimensões reais dos PNGs, cabeçalhos de atualização do service worker e página de indisponibilidade. Há regressão para impedir que URLs privadas, externas ou com parâmetros assinados sejam interceptadas como ícones públicos.

## Referências consultadas

- Buffer: organização de publicações por estado e visão de várias contas — https://support.buffer.com/articles/how-to-use-the-all-channels-view-in-buffer-oqqE4Sdf3T
- Microsoft Fluent: hierarquia tipográfica — https://fluent2.microsoft.design/typography
- Material Design: papéis da tipografia — https://m3.material.io/styles/typography/applying-type
- Google web.dev: instalação de PWA e diferenças entre plataformas — https://web.dev/learn/pwa/installation
- Apple: aplicações web no Mac — https://support.apple.com/en-gb/104996

Essas referências orientam a organização e a consistência; a interface mantém a identidade da Véxora.
