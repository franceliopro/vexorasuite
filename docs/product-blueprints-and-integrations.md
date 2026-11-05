# Véxora Suite — Modelos de produto e integrações

Este documento é a fonte de contexto para futuras implantações da Véxora Suite. Ele registra o modelo operacional comum da plataforma, os próximos provedores financeiros e o primeiro produto vertical que será construído sobre o mesmo Core.

## 1. Modelo operacional da Véxora

Cada empresa possui um ambiente isolado, uma identidade própria e somente os módulos habilitados para sua operação. O Core compartilhado mantém autenticação, contatos, protocolos, inbox, CRM, automações, agentes de IA, tarefas, financeiro, relatórios, auditoria e integrações.

### Departamentos padrão

Toda nova empresa pode iniciar com os mesmos departamentos-base:

- **Comercial:** captação, qualificação, propostas, produtos e conversão.
- **Financeiro:** cobranças, pagamentos, inadimplência, conciliação e negociação.
- **Suporte:** dúvidas, incidentes, acompanhamento e transbordo humano.

O segmento acrescenta vocabulário e filas especializadas sem quebrar esse modelo. Uma clínica usa paciente e procedimento; uma escola usa aluno, professor e turma; uma imobiliária usa imóvel e corretor; uma empresa de rastreamento usa veículo, placa e ocorrência.

O atendimento começa em qualquer canal autorizado e segue pelo mesmo protocolo até a resolução. Chatbot, Workflow, Agente de IA e atendente humano podem movimentar o Kanban, registrar contexto e encaminhar a próxima ação.

## 2. Direção de design premium

A Véxora será construída com uma experiência premium, tecnológica e consistente, mantendo clareza operacional. O visual não deve ser apenas decorativo: cada animação, contraste e expansão precisa ajudar o usuário a entender o estado, a próxima ação e o resultado do trabalho.

### Identidade visual

- Tema escuro híbrido como referência, com superfícies em preto e azul-marinho profundo.
- Gradientes controlados em azul elétrico, ciano, violeta e magenta, derivados do branding Véxora.
- Bordas de destaque, especialmente em cards e painéis de ação, sem transformar a interface em um excesso de brilho.
- Tipografia legível, hierarquia forte, espaçamento generoso, ícones consistentes e estados de status reconhecíveis.
- Suporte a temas escuro, híbrido e claro quando a operação exigir, com tokens visuais centralizados.
- Branding por empresa e White Label sem perder as regras de acessibilidade e contraste do produto.

### Interação e movimento

- Cards e blocos expansíveis que revelam detalhes sem tirar o usuário do contexto.
- Setas, conectores e pontos de navegação com movimento sutil e contínuo quando houver significado operacional.
- Estados hover, focus, active, loading, sucesso, alerta, erro, vazio e bloqueio desenhados de forma consistente.
- Transições curtas baseadas prioritariamente em `transform` e `opacity`, com suporte a `prefers-reduced-motion`.
- Feedback visual e textual imediato para ações de envio, transferência, cobrança, conclusão, falha e mudança de Kanban.
- Layout responsivo para desktop, tablet e celular, incluindo uso em atendimento e portais móveis.

### Qualidade visual e técnica

- Contraste, foco por teclado, leitura por tecnologia assistiva e alvos de toque adequados.
- Efeitos visuais com limite de peso: lazy loading, redução de repaints e ausência de animações que prejudiquem o atendimento.
- Componentes reutilizáveis para evitar que cada módulo crie botões, tabelas, modais ou estados incompatíveis.
- Testes de regressão visual nas telas críticas antes de considerar a experiência pronta.

### Referência visual do atendimento

O Inbox deve oferecer uma experiência familiar, sem copiar identidade de terceiros: agrupamento por **Hoje**, **Ontem**, dia da semana e data completa; imagens ampliáveis; links com thumbnail quando disponível; anexos; emoji; gravação e reprodução de áudio; menu contextual; resposta, encaminhamento e ações de mensagem. O status de entrega deve ser compreensível: um indicador para enviado, dois para entregue e estado visual distinto para lido.

Identificadores técnicos de provedores, como endereços internos de sessão, não devem aparecer para o usuário. A interface deve priorizar nome, telefone formatado, empresa, avatar e contexto do contato. O histórico completo do contato ou cliente deve estar acessível a partir da lista e do atendimento.

## 3. Escopo completo da Véxora

Este é o inventário de produto que será implantado, validado ou mantido no blueprint, sempre respeitando o isolamento por empresa:

1. **Core multiempresa:** autenticação, organizações, usuários, permissões, departamentos, tenants, branding, auditoria e isolamento de dados.
2. **Atendimento omnichannel:** WhatsApp, Instagram, Facebook, TikTok, Telegram, LinkedIn, e-mail, Google, Threads, X e canais web conforme disponibilidade de cada integração.
3. **Contatos e CRM:** cadastro persistente, números alternativos, histórico, protocolos, clientes, segmentos, campos personalizados e recuperação segura após troca de número.
4. **Inbox e atendimento humano:** conversas, anexos, mídia, links, áudio, emoji, recibos, busca, histórico, equipe, atendente individual e colaboração entre canais.
5. **Chatbot, Workflow e Agentes de IA:** blocos, condições, variáveis, integrações, memória contextual, simulação, versionamento, publicação e transbordo com resumo para o setor correto.
6. **Kanban e protocolos:** filas por segmento, SLA, prioridade, tags, responsáveis, movimentação pelo bot, agente ou pessoa, encerramento e reabertura rastreáveis.
7. **Tarefas:** tarefas internas da empresa separadas de procedimentos personalizados por cliente, com checklist, progresso, responsáveis, prazos e conclusão.
8. **Financeiro e cobrança:** catálogo, clientes, produtos, assinaturas, cobranças, inadimplência, conciliação, notificações e adaptadores Asaas, InfinitePay, Stripe e Mercado Pago.
9. **Marketing e aquisição:** campanhas, mensagens de aniversário e relacionamento, formulários, landing pages, captação e jornadas de entrada na própria Véxora.
10. **Studio Visual:** criação de páginas, blocos, formulários, galerias, postagens e conteúdo dinâmico com branding por cliente, sem obrigar o uso de uma hospedagem separada para cada operação.
11. **Onboarding e White Label:** instalação guiada, escolha de módulos, domínios, integrações, permissões, identidade visual, configuração por segmento e painel dedicado.
12. **Backup, restauração e migração:** cópia de dados da Véxora, arquivos, bancos e configurações; restauração seletiva; exportação; replicação em novo servidor Dokploy e migração entre clientes com segurança.
13. **Relatórios e observabilidade:** indicadores de atendimento, vendas, financeiro, automação, erros, integrações, saúde do sistema, trilhas de auditoria e alertas operacionais.
14. **Verticais e modelos:** Rastreabem, FAETER, clínicas, estética, medicina, advocacia, imobiliárias, escolas e outras operações com vocabulário, filas, formulários e permissões próprios.

### Modelo de status

Para evitar interpretações incorretas por pessoas ou agentes futuros, cada item do inventário deve ser classificado como:

- **Implantado e validado:** existe no ambiente e passou pelos testes funcionais e de segurança previstos.
- **Em implantação:** já tem implementação em andamento, mas ainda depende de validação ou publicação.
- **Blueprint/roadmap:** está especificado neste documento e será construído posteriormente; não deve ser apresentado como disponível.

Registrar uma intenção neste documento não substitui teste, configuração de ambiente, aprovação de integração ou validação ponta a ponta.

## 4. Camada financeira multi-provedor

O Financeiro deve operar por uma interface comum de provedores, sem acoplar a operação a um único gateway.

### Provedores

| Provedor | Papel no roadmap | Requisito de operação |
|---|---|---|
| Asaas | Integração atual e referência de Sandbox | Clientes, cobranças, Pix, boleto, fatura, webhooks e conciliação |
| Stripe | Expansão para cartões, assinaturas e produtos globais | Customer, Product, Price, Subscription, PaymentIntent e webhooks idempotentes |
| Mercado Pago | Cobrança local e alternativas de pagamento | Clientes, preferências, pagamentos, assinaturas quando disponíveis e notificações |
| InfinitePay | Provedor simples para produtos, clientes e cobrança | Catálogo, cliente, cobrança, status, links/checkout e webhook |

### Contrato comum

Cada adaptador deve expor, no mínimo:

- cadastro e atualização de cliente;
- catálogo de produtos e planos;
- cobrança avulsa e recorrente;
- consulta de status e vencimento;
- cancelamento, estorno ou suspensão conforme o provedor;
- recebimento de webhook com assinatura validada;
- idempotência por provedor, evento e identificador externo;
- ambiente Sandbox e Produção claramente separados;
- reconciliação sem duplicar clientes, produtos ou pagamentos;
- auditoria, tenant e origem preservados em todas as operações.

Nenhum chatbot deve informar que cobrou, pagou, cancelou ou liberou acesso antes da confirmação do provedor. Falhas de integração devem encaminhar para o Financeiro com contexto e manter o protocolo aberto.

## 5. FAETER Teologia

### Posicionamento

A FAETER Teologia será uma operação vertical da Véxora Suite para uma escola de teologia com cursos presenciais e online. O primeiro produto de referência é o **Curso Bacharel Livre em Teologia**, com duração de dois anos e meio e 36 matérias.

O ambiente terá branding próprio da FAETER e usará os módulos da Véxora sem expor detalhes técnicos do Core.

### Estrutura acadêmica

- Cadastro de alunos, responsáveis, professores, secretaria e administradores.
- Catálogo de cursos, módulos, disciplinas, professores e turmas.
- Curso organizado em etapas com pré-requisitos.
- O aluno só acessa o módulo 2 após concluir o módulo 1, seguindo a mesma regra para as etapas seguintes.
- Disciplinas previstas, entre outras, incluem Noções de Grego Neotestamentário, Noções de Hebraico Veterotestamentário e Batalha Espiritual do Século 21.
- Modalidade presencial e modalidade online com regras de liberação próprias.

### Produtos e planos

O catálogo deve suportar:

- assinatura mensal;
- contratação modular;
- contratação completa do curso;
- descontos, bolsas, condições especiais e negociações internas;
- produtos adicionais, materiais e eventos quando forem cadastrados;
- acesso liberado ou suspenso conforme o estado financeiro e acadêmico.

O produto é cadastrado uma vez na Véxora e sincronizado com o provedor financeiro escolhido. Para a FAETER, o primeiro provedor será a InfinitePay. As integrações futuras de Asaas, Stripe e Mercado Pago devem reutilizar o mesmo catálogo interno.

### Portal do aluno

Cada aluno terá usuário e senha próprios para acessar:

- curso, módulo e disciplina liberados;
- aulas online em formato organizado, com experiência inspirada em catálogo de streaming;
- aulas e conteúdos publicados a partir de vídeos hospedados no YouTube ou fonte autorizada;
- situação financeira, pagamentos, vencimentos e atrasos;
- avisos da escola e comunicação com a secretaria;
- provas disponíveis, tentativas usadas, notas e histórico;
- PDFs e comprovantes gerados após cada avaliação.

O portal nunca deve permitir que um aluno veja dados de outro aluno, turma, pagamento ou prova.

## 6. Sistema de provas

### Regras comuns

- Cada prova possui cinco perguntas.
- Cada pergunta vale dois pontos.
- A nota máxima é dez.
- O aluno tem uma única tentativa por prova.
- Uma nova tentativa só aparece após autorização interna da secretaria ou de um responsável autorizado.
- A prova deve registrar versão, disciplina, professor, aluno, data de abertura, data de envio e correção.
- O sistema bloqueia respostas após o envio e preserva o resultado original.

### Modalidade presencial

- A secretaria controla quando a prova fica liberada.
- O professor ou responsável pode liberar e encerrar a janela de realização.
- A correção pode ser automática para questões objetivas, com possibilidade de revisão autorizada.
- O sistema registra quem liberou, quem corrigiu e quando cada ação ocorreu.

### Modalidade online

- A prova é liberada automaticamente em uma data ou janela previamente configurada.
- O pré-requisito do módulo e a situação financeira/acadêmica são verificados antes da liberação.
- O prazo de envio é aplicado pelo servidor, não apenas pela interface.
- A tentativa é registrada de forma idempotente para impedir duplicidade em recarregamentos ou perda de conexão.

### Resultado e feedback

Após o envio, o aluno recebe a nota imediatamente quando a correção estiver concluída.

- **Aprovado:** resultado visual positivo, com animação leve de comemoração e mensagem de aprovação.
- **Não aprovado:** estado visual claro e acolhedor, informando que o aluno deve procurar a Secretaria para negociar o reteste.
- O resultado mostra erros e acertos por questão.
- Cada questão exibe a alternativa escolhida e a alternativa correta, conforme a política definida pela escola.
- Um gráfico com dez gomos mostra a proporção de pontos obtidos e pontos não obtidos.
- O aluno pode gerar um PDF bonito com logotipo FAETER, cabeçalho, nome da matéria, professor, aluno, nota, erros, acertos, alternativas corretas e data.
- O PDF pode ser baixado ou encaminhado para o WhatsApp do próprio aluno mediante confirmação.

O envio por WhatsApp não deve expor o resultado a um número diferente do contato autenticado do aluno. A escola pode autorizar exceções por procedimento interno.

## 7. Secretaria e gestão interna

A secretaria terá visão de:

- alunos ativos, pendentes, suspensos e concluídos;
- progresso por curso, módulo e disciplina;
- pagamentos em dia, em atraso, negociados ou cancelados;
- provas liberadas, realizadas, pendentes e retestes autorizados;
- solicitações de suporte e histórico completo do aluno;
- tarefas internas separadas dos procedimentos acadêmicos do aluno;
- trilha de auditoria para liberação de provas, autorização de reteste e alteração de nota.

O professor acessa apenas as turmas, disciplinas, provas e resultados sob sua responsabilidade. A secretaria possui as funções administrativas autorizadas. O aluno acessa somente os próprios dados.

## 8. Ordem de implantação

1. Finalizar e validar o fluxo de atendimento da Véxora com Comercial, Financeiro e Suporte.
2. Criar a empresa Rastreabem em ambiente controlado e testar bot, protocolo, transbordo, equipe, Kanban e Asaas Sandbox.
3. Consolidar o adaptador financeiro comum e testar Asaas sem misturar Sandbox com Produção.
4. Implantar o catálogo de produtos e clientes, começando pela InfinitePay.
5. Criar o tenant FAETER com branding, departamentos e permissões próprias.
6. Cadastrar curso, módulos, disciplinas, professores, produtos e planos.
7. Implementar portal do aluno, progressão por pré-requisito e liberação de aulas.
8. Implementar provas presenciais e online, tentativa única, reteste autorizado e notas.
9. Implementar gráficos, resultado animado, PDF e envio autorizado por WhatsApp.
10. Revalidar backup, restauração, isolamento por tenant, auditoria e migração para outro servidor Dokploy.

## 9. Critérios de aceite

Um módulo só será considerado pronto quando passar por teste automatizado, teste de autorização, teste de falha do provedor, teste de idempotência, teste de isolamento entre empresas e teste de interface no desktop e no celular.

O documento é um blueprint de produto. Ele registra o que deverá ser construído e testado, sem declarar como concluído um recurso que ainda não passou pela validação funcional real.

