# Escopo enxuto da Véxora Suite

Decisão de produto: construir uma plataforma operacional que resolva o trabalho cotidiano dentro do mesmo sistema. Não copiar menus da versão anterior só para parecer completa. Cada recurso precisa economizar tempo, reduzir erro ou dar visibilidade a uma operação importante.

## Navegação principal

1. **Visão geral** — resumo operacional com dados reais, sem métricas fictícias.
2. **Atendimento** — caixa de entrada omnichannel, mensagens em tempo real, filas/atribuição, histórico, etiquetas, notas internas e passagem segura entre automação e humano.
3. **CRM** — contatos, oportunidades, funis, tarefas/follow-ups e contexto do cliente. Origem do lead é um campo/contexto do contato e da oportunidade, não um módulo independente.
4. **Agenda** — agendamentos de atendimento, reuniões, chamadas e retornos; visualização de disponibilidade, responsável, lembretes, reagendamento e cancelamento. Deve funcionar internamente e sincronizar com Google Agenda quando conectado.
5. **Automação** — fluxos, regras e agentes de IA no mesmo espaço de trabalho. IA é opcional e deve respeitar o botão de ativação/desativação do servidor. Execuções e falhas precisam ser visíveis.
6. **Marketing** — criações/conteúdo, campanhas e resultados de divulgação. Publicação e anúncios pagos só entram quando houver integração real, autorização explícita, confirmação e proteção contra gasto acidental.
7. **Financeiro** — débitos, cobranças, links de pagamento, status confirmado pelo provedor e histórico das ações enviadas ao cliente.
8. **Configurações** — empresa, equipe/permissões, canais, integrações, marca e preferências. Conexões não precisam de um módulo de primeiro nível separado.

## Decisão sobre recursos herdados

| Recurso da versão anterior | Decisão | Motivo |
|---|---|---|
| Origem/rastreamento de leads | **Manter de forma enxuta** | Registrar origem/campanha/página quando houver dado confiável ajuda a medir marketing e priorizar atendimento. Não criar rastreador invasivo nem uma área separada sem necessidade. |
| Agentes de IA | **Manter dentro de Automação** | Úteis para triagem, qualificação, resposta e tarefas autorizadas; evitar menu separado que fragmenta o fluxo. |
| Chatbots/fluxos | **Manter dentro de Automação** | São ferramentas do mesmo motor operacional; editor simples primeiro, recursos avançados apenas quando necessários. |
| Filas e distribuição | **Manter como configuração de Atendimento** | Ajuda a evitar conversas perdidas e balancear a equipe; regras começam desativadas até a empresa configurá-las. |
| Pagamentos e cobranças | **Manter como parte central do Financeiro** | Reduz troca de aplicativos e deixa evidência de envio e confirmação. Não tratar link enviado como pagamento recebido nem como contabilidade completa. |
| Marketing social e anúncios | **Manter com escopo gradual** | Conteúdo e campanhas são úteis, mas mídia paga exige conexão real, revisão e confirmação do orçamento antes de ativar. |
| Mensagens agendadas/sequências | **Integrar ao motor de Automação** | Evitar telas redundantes. Só habilitar execução quando houver agenda, cancelamento, estado e auditoria confiáveis. |
| API pública, webhooks e conexões | **Mover para Configurações** | São essenciais para operação e integração, mas não precisam disputar espaço com as tarefas diárias. |
| Personalização visual | **Manter em Configurações** | Marca e identidade por empresa são úteis; opções cosméticas raras ficam fora da navegação principal. |
| Agendamento operacional | **Manter como capacidade central** | Serve para atendimentos, reuniões, chamadas e retornos na Rastreabem, e para consultas/aulas/serviços em clínicas, escolas e barbearias. Agenda e disponibilidade são reutilizáveis; evitar transformar isso em um sistema complexo de gestão clínica/escolar na primeira fase. |
| Google Agenda | **Integração prioritária** | Sincronizar eventos, responsáveis, horários e lembretes, com consentimento, tratamento de conflitos e prevenção de eventos duplicados. |
| Google Drive | **Integração prioritária** | Permitir conectar conta, escolher arquivos/pastas autorizados e anexar ou compartilhar documentos a partir do atendimento/CRM; não copiar todo o Drive automaticamente. |
| Meta direta e Zernio | **Camada de canais com opções** | Permitir conectar contas Meta existentes ou configurar novas, e suportar Zernio para serviços Meta quando fizer sentido. Mostrar claramente o provedor, permissões, status e capacidades reais disponíveis em cada conexão. |
| Integrações adicionais | **Base extensível, configuração simples** | Conexões via OAuth quando suportado, webhooks e credenciais protegidas. Integrações ficam em Configurações, com assistente de conexão e teste de status; não um menu operacional separado. |
| Templates por segmento | **Adiar como produto separado** | Usar modelos simples de configuração quando ajudarem a iniciar uma empresa, sem transformar segmentos em módulos distintos. |
| Escola, delivery e outros legados | **Não levar para a primeira fase** | A prioridade é validar o atendimento da Rastreabem antes de expandir para outros produtos verticais. |
| Rastreamento anônimo, relatórios avançados, construtores complexos e opções pouco usadas | **Adiar ou descartar** | Não aumentar coleta de dados nem complexidade sem necessidade comprovada. |

## Regras de implementação

- Primeiro, concluir o caminho operacional da Rastreabem: receber mensagem, persistir, atualizar em tempo real, responder, transferir para humano, concluir e recuperar após reconexão.
- Agendamentos devem suportar tipo, contato, responsável, início/fim, fuso horário, status, lembretes, reagendamento/cancelamento e trilha de auditoria. Não prometer sincronização até a integração estar conectada e testada.
- Integrações devem usar arquitetura por conectores/adaptadores para que um tenant conecte sua conta existente ou configure uma nova sem alterar o fluxo dos demais. Tokens ficam criptografados e isolados por tenant; pedir apenas os escopos necessários.
- Google Drive: iniciar com seleção explícita de arquivo/pasta e ações de anexar/compartilhar. Google Agenda: criar/atualizar/cancelar eventos e tratar conflitos/duplicação. Meta/Zernio: identificar recursos disponíveis conforme a conta, permissões e provedor; não presumir que uma conexão dá acesso a todas as APIs Meta.
- Depois, garantir autenticação, isolamento por empresa, permissões e auditoria antes de liberar operações sensíveis.
- Financeiro: separar claramente **preparado**, **enviado**, **confirmado pelo provedor** e **falha/resultado incerto**. O atendente precisa enxergar o que foi enviado.
- Toda automação deve ter estado explícito, cancelamento, proteção contra duplicação e histórico de execução.
- Não mostrar contadores, métricas, status de conexão ou resultados simulados como se fossem dados reais.
- A interface mantém navegação curta, painel lateral recolhível e layouts responsivos. Funções avançadas ficam dentro do módulo relacionado ou em Configurações.
- Nada será migrado do ambiente antigo nem publicado em produção oficial sem validação e autorização explícitas.
- Não remover dados nem funcionalidades da Véxora Matriz; este documento orienta exclusivamente a nova Véxora Suite.

## Ordem de entrega

1. Fundação: autenticação, tenant, permissões, banco/migrações, auditoria e testes de isolamento.
2. Atendimento em tempo real e integração WhatsApp para validar Rastreabem.
3. CRM mínimo integrado à conversa, incluindo origem do lead.
4. Agenda operacional básica para chamadas, reuniões, atendimentos e retornos; depois sincronização com Google Agenda.
5. Motor de automação e IA opcional.
6. Financeiro com registro confiável das ações e confirmação de pagamento.
7. Conectores prioritários: Google Drive, Google Agenda, Meta direta e Zernio, com conexões por empresa.
8. Marketing e rastreamento de origem confiável.
9. PWA e expansão para outros segmentos após o fluxo principal passar nos testes de aceite.

Este escopo é deliberadamente menor do que a lista de recursos da versão anterior. Funcionalidade só entra quando resolver uma tarefa real e puder ser mantida/testada com segurança.
