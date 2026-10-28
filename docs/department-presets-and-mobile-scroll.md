# Padrões de departamentos, atendentes e experiência mobile

## Comportamento
Um padrão pode ser aplicado a um departamento ou diretamente a um atendente. O atendente herda os padrões dos departamentos ativos aos quais pertence. Dois departamentos financeiros mantêm contextos distintos.

O motor seleciona a configuração específica do atendente naquele departamento, depois a configuração do departamento e, por último, a publicação geral. Uma pausa explícita de um departamento impede a execução da publicação geral naquele contexto. Atendimento em modo humano permanece sob controle humano.

O bloco Departamento abre o chatbot publicado do departamento mantendo o modo automático. Na ausência de automação disponível, encaminha para atendimento humano.

## Incluído
- Catálogo inicial com 14 segmentos, começando por Rastreamento veicular e Escola de músicas e instrumentos.
- Padrões Financeiro, Suporte, Comercial e Atendimento.
- Cadastro e edição de atendentes, seleção de módulos e associação a vários departamentos.
- Pipeline por departamento e permissões de módulos verificadas na API.
- Aplicação de padrões por destino, preservando configurações e evitando duplicação na reaplicação.
- Biblioteca de rascunhos e elementos dinâmicos de departamentos, atendentes e agentes de IA.
- Publicação e pausa por departamento ou por atendente no contexto escolhido.
- Instruções de padrões incorporadas ao contexto da IA, exigindo agente/provedor habilitados.
- Revalidação de publicação, revisão, canal, vínculos e contexto antes do envio de respostas pendentes.
- Workflows com filtros de departamento e atendente; sequências são canceladas após transferências ou perda de vínculo.
- Identificação de mídia sem IA e triagem de áudio, com resposta em texto quando a voz falha.
- Modelo genérico Fluxo Suporte+Financeiro no editor. O fluxo já salvo da Rastreabem não é alterado.
- Painéis recolhíveis, controles mais compactos, perfil no menu do usuário e imagens SVG/WebP.
- Controle compartilhado de bloqueio da rolagem entre diálogos e editor em tela cheia.
- Rolagem do documento nas páginas mobile, espaço acima do menu inferior e ferramentas do editor acessíveis em telas pequenas.

## Migração
Aplicar a migração 20261028010000_department_modules_crm antes de iniciar esta versão da API. Ela adiciona módulos em vínculos e departamentos, categoria/plataforma de roteamento e pipelines departamentais.

A migração preserva inicialmente INBOX para usuários operacionais existentes. Administradores mantêm acesso aos módulos para configurar as permissões. Padrões departamentais concedem módulos herdados somente aos membros dos departamentos ativos; a retirada do vínculo remove essa herança.

## Validação
Os testes automatizados cobrem publicação por contexto, isolamento de departamentos, controle humano, pausa, perda de vínculo, encaminhamento ao chatbot departamental, filtros de workflows, herança de módulos, dados financeiros e bloqueios de rolagem sobrepostos.
A prévia com os estilos reais da aplicação confirmou acesso ao fim da página e conteúdo acima do menu inferior em 360×640, 390×844 e 760×800. Essa prévia não substitui teste autenticado de todas as páginas ou teste por toque em aparelho físico.

## Limites atuais
- O catálogo contém bases de triagem; cada segmento ainda precisa de automações operacionais especializadas.
- Os padrões não criam automaticamente todas as rotinas de cobrança ou acompanhamento.
- Agentes de IA precisam ser cadastrados e conectados a provedores; instruções preparadas não substituem esse cadastro.
- Google Agenda, Drive e provisionamento das pastas Referências, Novidades e Prontas por destino ainda precisam de integração.
- Não foram introduzidas credenciais financeiras ou Google específicas por departamento.
- Assistente completo de criação e alternância de empresas e personalizações detalhadas por recurso permanecem pendentes.
- Publicação no GitHub e verificações de CI não comprovam implantação ou teste em produção.
