# Home de apresentação

A página inicial não tem título ou indicadores e abre pelo logo. Visão geral permanece como módulo separado, quando permitido.

Cada empresa guarda duas imagens e duas cores de fundo independentes, desktop e celular, em tabela própria; não entram no JSON de integrações nem são copiadas ao criar empresas. Arquivos enviados pelo navegador são reduzidos e preparados como WebP; o servidor valida, redimensiona e remove metadados novamente.

Imagens novas usam Centralizar por padrão. Uma marca pequena pode ser combinada com cor sólida, sem imagem grande de fundo.

Ajustes: Ajustar (contain), Preencher (cover), Centralizar, Estender, Ampliar (cover com zoom de 25%) e Lado a lado. A prévia usa a proporção do dispositivo escolhido; o enquadramento final acompanha o espaço real da tela.

Clique no botão central quando não houver fundo. Após aplicar, clique duas vezes no fundo ou toque duas vezes no celular para editar. Há também um botão de edição acessível por teclado. Aplicar grava desktop e celular juntos; cancelar descarta a edição. Excluir afeta somente a imagem escolhida.

Leitura exige sessão válida da própria empresa. Edição exige administração Véxora ou OWNER/ADMIN com Configurações permitido. O endpoint da imagem valida o contexto e não usa cache compartilhado. Revisões concorrentes retornam conflito e exigem reabrir a edição.

A sidebar desktop é fixa no viewport. Somente sua área de navegação rola quando necessário, com barra fina chapada, cinza escuro em área clara e branca em área escura. Submenus expandem no fluxo normal e não possuem rolagem própria. A rolagem das páginas mobile continua pertencendo ao documento; o editor de fundo tem sua própria rolagem interna e o mesmo controle de foco/rolagem dos diálogos existentes.

Novos controles de automação ficam abaixo do fluxo; o título Véxora Intelligence Engine permanece no topo.

A padronização das barras de rolagem vale para todo o produto: documento, painéis, editores e campos. Sem bordas arredondadas, sombras ou relevo. A sidebar do tema híbrido usa a variação de ambiente escuro.

Na navegação, apenas um grupo de submenus permanece aberto. Selecionar outro módulo ou focar outro grupo pelo teclado recolhe o anterior; navegar entre os filhos do grupo mantém sua abertura. O logo também recolhe os grupos ao voltar à apresentação.
