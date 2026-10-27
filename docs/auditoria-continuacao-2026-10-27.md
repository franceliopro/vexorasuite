# Continuação da auditoria — 27/10/2026

## Base verificada

- Repositório: `franceliopro/vexorasuite`.
- Branch que aciona o Dokploy: `foundation/bootstrap-monorepo`.
- Base: `8557a7acccb68f7c75a78cb2494849876f88ee6e`, merge do PR #163.
- CI dessa base aprovada: execução 40450891738, incluindo containers.
- PR #162 permanece em rascunho. Seu fluxo inicial adiciona configurações de atribuição em texto livre e ações PIX/boleto que o contrato executável atual não aceita. Não deve ser mesclado integralmente sem adaptação; parte das melhorias de viewport já foi incorporada no #163.

## Defeitos corrigidos

### Edições concorrentes no CRM

Perfil, etapa e finalização liam metadados antes da operação de escrita. Duas alterações simultâneas podiam substituir notas, campos, etiquetas ou vínculo financeiro gravados pela outra operação.

Agora essas rotas leem o contato depois de obter bloqueio de linha no PostgreSQL, com filtro obrigatório de empresa, e aplicam as alterações sobre esse estado. O bloco de etiquetas do Engine também relê o contato sob o mesmo bloqueio, em vez de reutilizar o snapshot da conversa. A finalização bloqueia primeiro as conversas, em ordem estável, e depois o contato, para respeitar a ordem usada pelo Engine.

A validação de etapa é feita dentro da transação: uma etapa não pode ressuscitar o pipeline de um contato já finalizado. Identificadores nas rotas de contato passam por validação UUID; resultado de finalização com tipo incorreto retorna erro de entrada.

Escopo: isso protege as rotas citadas e a escrita de etiquetas pelo Engine. Os importadores Asaas e webhooks ainda têm outras escritas de metadados a consolidar; não representa a solução de toda a concorrência da aplicação.

### Autorização de respostas pendentes

O envio de uma resposta preparada pelo Engine agora confere novamente:
- canal ativo, mesma empresa/provedor e empresa ativa;
- motor ativo, mesma revisão e canal ainda vinculado à publicação;
- conversa ainda no mesmo canal e sem tomada humana/finalização.

Depois dessa conferência usa a configuração atual do canal. Uma revogação observada cancela o envio com estado FAILED. A conferência ocorre imediatamente antes do transporte, mas não pode desfazer uma requisição já aceita pelo provedor.

Essa mudança não implementa replay de mensagens nem reenvia automaticamente estados ambíguos. Reconciliação/outbox com recuperação após crash continua pendente.

### Variáveis ausentes no Compose

A API consome BRAVE_SEARCH_API_KEY, OPENROUTER_API_KEY, OPENAI_API_KEY, INTEGRATION_ENCRYPTION_KEY e GOOGLE_MAPS_API_KEY, mas o Compose não as encaminhava ao container. O repasse opcional foi acrescentado e o exemplo de ambiente atualizado, incluindo a configuração Google.

No Dokploy, cadastrar uma variável não garante seu repasse a um serviço Compose sem referência explícita. As regras e relatórios determinísticos continuam sem dependência dessas chaves.

Não trocar INTEGRATION_ENCRYPTION_KEY de instalações existentes sem recriptografar credenciais. Deixar vazio preserva o fallback anterior. Nenhuma credencial real foi criada ou alterada nesta entrega.

## Validação

A CI foi ampliada com regressão sobre PostgreSQL após migrações e build da API:
- dez rodadas de edições concorrentes em notas, campos e etiquetas, preservando vínculo Asaas;
- rejeição de acesso ao contato com outra empresa;
- corrida entre finalização e mudança de etapa, incluindo resolução da conversa.

Há testes unitários do bloqueio e da releitura, e testes do envio após interrupção, substituição da revisão, retirada de canal e mudança de canal da conversa. Consultar o resultado da CI do novo PR; não interpretar a CI da base como validação desta mudança.

## Implantação e retorno

Nenhuma migração de banco é necessária. Docker multi-stage existente preservado. Merge na branch operacional aciona o autodeploy; um commit na branch de correção não equivale a implantação concluída.

Após deploy: conferir saúde da API, login, perfil/CRM, execução de fluxo de teste e interrupção controlada. Para voltar, reverter o commit desta entrega e reconstruir os containers; não há coluna/tabela a remover. Não há exclusão de dados, rascunhos, canais ou arquivos do Drive.

## Pendências que continuam abertas

1. Transporte real de arquivos/áudio e visualização no atendimento.
2. Worker/outbox: recuperação de mensagens não reclamadas e reconciliação de envios ambíguos, sem duplicar mensagens.
3. Retirar chamadas de IA da transação longa e manter reserva de orçamento durável também em falhas.
4. Consolidar todos os escritores de metadata (Asaas e webhooks), com testes de concorrência entre módulos.
5. Piloto Rastreabem com destinos de equipe reais e identidade financeira validada.
6. Testes autenticados de Google/Drive e publicação Zernio; matriz de permissões e mobile.
7. Rate limit distribuído, restauração de backup e retenção operacional.

A inspeção desta continuação é de código e CI. A sessão autenticada anterior e o deploy em produção não foram revalidados nesta etapa.
