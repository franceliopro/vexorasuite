# Empresas e recursos Google por contexto

## Empresas
A conta proprietária pode criar outra empresa usando um segmento do catálogo. A criação prepara departamentos, pipelines, rascunhos e modelos de agentes, sem copiar contatos, chaves ou conexões da empresa anterior.
A solicitação usa um identificador estável e um lock por proprietário para que uma repetição ou envio concorrente não crie duas empresas. Há um limite de 25 empresas por proprietário.

GET /auth/companies lista somente empresas ativas em que a conta tem vínculo OWNER. POST /auth/companies cria e entra na empresa; POST /auth/switch troca para uma empresa proprietária autorizada. Ambos retornam nova sessão pelo proxy HTTP-only. A interface recarrega por inteiro depois da troca para encerrar o estado e os eventos do contexto anterior.

## Drive e Agenda
Em Configurações, Google por departamento e atendente permite selecionar contas já conectadas à própria empresa e uma agenda real. O servidor verifica permissões da agenda e o vínculo do atendente ao departamento.
A pasta do destino contém Referências, Novidades, Prontas e Publicadas. A criação não publica arquivos, não altera o compartilhamento e não move conteúdo existente.

Antes de criar pastas, os IDs são reservados no Drive e persistidos no banco. Se uma resposta se perder, a retomada consulta os mesmos IDs e não solicita outra estrutura. Uma alteração concorrente do destino impede a configuração anterior de sobrescrevê-la.

A resolução conserva recursos separados: base da empresa, departamento e configuração direta da pessoa naquele departamento. Uma configuração direta de Agenda pode substituir a agenda herdada sem substituir o Drive do departamento.

Os links abrem a pasta/agenda correspondente no Explorer e na Agenda da Véxora. Operações externas continuam exigindo conexão Google real e permissões apropriadas.

## Referências oficiais
- https://developers.google.com/workspace/drive/api/guides/folder
- https://developers.google.com/workspace/drive/api/reference/rest/v3/files/generateIds
- https://developers.google.com/workspace/calendar/api/v3/reference/calendarList/get

## Validação
Testes unitários e regressão PostgreSQL executados no GitHub Actions. O resultado efetivo fica no PR; não interpretar a existência do teste como aprovação.

## Pacotes departamentais
Carregar um padrão agora materializa também o agente de IA e a rotina de acompanhamento. A ativação de tarefas internas é opcional no carregamento; não envia mensagens a clientes. Agentes exigem modelo/provedor antes da ativação. A reaplicação preserva rascunhos, agentes personalizados e rotinas existentes.
