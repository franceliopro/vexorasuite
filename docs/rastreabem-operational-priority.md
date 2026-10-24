# Rastreabem — Plano de prioridade operacional da Véxora

## Decisão
Priorizar a operação atual da Rastreabem antes da expansão de aquisição/comercial. A plataforma de captura de leads permanece como capacidade futura compartilhada, sem atrasar suporte, financeiro, cobrança e conteúdo social.

## Contexto operacional
A Rastreabem atende clientes de três plataformas: Ceeb Vision, Link e Rastreabem. Os clientes estão no Asaas, mas suporte e financeiro são independentes por plataforma. O contato comercial/administrativo atualmente é direcionado a um número de telefone próprio.

## 1. Triagem e roteamento
- Identificar contato por telefone como sugestão, não autenticação suficiente para dados financeiros.
- Confirmar identidade com fluxo adequado (CPF/CNPJ e validação adicional conforme risco).
- Resolver vínculo tenant/contact e vínculos das plataformas em fonte confiável; permitir múltiplas plataformas por cliente.
- Menu principal: Suporte técnico; Financeiro; Comercial; Administrativo.
- Suporte: selecionar/confirmar plataforma e encaminhar à equipe/fila correspondente.
- Financeiro: autoatendimento seguro de consulta e pagamento, ou transferência humana com contexto já coletado.
- Ao transferir, transportar resumo estruturado: identidade verificada/estado, plataforma, motivo, dados já solicitados e histórico relevante.
- Fallback para humano em ambiguidades, falha de identificação, conflito de cadastro ou indisponibilidade da integração.
- Não expor dívidas, CPF/CNPJ, dados de pagamento ou dados de terceiros antes de autenticação apropriada.
- Registrar trilha de auditoria das consultas e ações financeiras, sem guardar documentos/sigilos além do necessário.

## 2. Financeiro — consulta e pagamento
- Pesquisa por CPF/CNPJ normalizado, usando associação confiável e validação; nunca confiar apenas no documento digitado como prova de identidade.
- Consultar débitos por cliente e por produto/plataforma, mantendo separação dos serviços.
- Exibir fatura, valor, vencimento, status e meios disponíveis, respeitando a origem do dado.
- Oferecer link de pagamento oficial do provedor; não registrar como pago até confirmação oficial/webhook ou reconciliação confiável.
- Permitir ao agente pesquisar rapidamente pelo cadastro autenticado e ver resumo de títulos vencidos, a vencer, pagos e contestados.
- Registrar quando, por quem e em qual contexto houve consulta ou disparo de cobrança.
- Definir precedência para faturas duplicadas, baixas tardias, acordos, parcelamentos, estornos e renegociação.
- Mostrar data de atualização e indisponibilidade do financeiro; não apresentar valores antigos como saldo confirmado.
- Dados compartilhados no Asaas não eliminam a necessidade de classificar cada contrato/cobrança por plataforma e unidade financeira.

## 3. Régua de cobrança por vencimento
Datas de recebimento informadas: dia 10, 20 e 30. Régua relativa ao vencimento:
- D-5: lembrete inicial.
- D-3: lembrete de proximidade.
- D0: aviso de vencimento.
- D+2: lembrete de atraso.
- D+5: novo aviso de atraso.

Exemplos de primeira data:
- Vencimento dia 10 → primeiro lembrete dia 5.
- Vencimento dia 20 → primeiro lembrete dia 15.
- Vencimento dia 30 → primeiro lembrete dia 25.

Regras:
- A data real de vencimento do título é a fonte da programação; o calendário 10/20/30 organiza lotes e não substitui o vencimento individual.
- Usar fuso horário do tenant e regras explícitas para fins de semana/feriados; não deslocar silenciosamente.
- Jobs idempotentes, reprocessáveis e auditados; suspender mensagens para faturas pagas, canceladas, em disputa, renegociadas ou com promessa de pagamento vigente conforme política.
- Revalidar situação do título imediatamente antes do envio; aplicar limites de frequência, janela de contato, consentimento e opt-out.
- Estado por etapa: previsto, elegível, enviado, entregue, falha, suprimido e cancelado; métricas separadas.
- Prever falhas do provedor, retry com backoff, fila de exceções e reconciliação.
- Templates por canal aprovados, variáveis validadas, linguagem clara e identificação da empresa/plataforma.
- Cobrança manual com um clique deve abrir prévia de destinatário, plataforma, título, valor, vencimento, canal e mensagem; exigir confirmação, prevenir duplicidade e respeitar permissões.
- Envio automatizado não é comprovante de entrega; entrega não é pagamento.

## 4. Raio X financeiro do agente
Dashboard com filtros de plataforma, período, carteira, vencimento, status e responsável:
- A vencer; vencidos; faixa de atraso (1–5, 6–15, 16–30, 31+ dias configurável).
- Valor e quantidade de títulos; pagantes; inadimplentes; acordos/contestações; pagamentos recentes.
- Promessas de pagamento, vencidas e cumpridas.
- Aging/antiguidade da dívida e tendência, sem misturar empresas/plataformas.
- Ações rápidas: consultar cadastro, abrir título, copiar link oficial, cobrar com prévia, registrar contato/ocorrência, encaminhar negociação.
- Métricas de recebimento e efetividade da régua com definições e período explícitos.
- Proteção de dados sensíveis, permissões e auditoria por ação.

## 5. Modelo operacional multi-produto
- Uma pessoa/cliente pode ter relações distintas com Ceeb Vision, Link e Rastreabem.
- Cadastro de vínculo de plataforma/serviço e carteira financeira precisa ser explícito.
- Evitar presumir que um cliente tem uma única plataforma.
- Permissões e visibilidade devem ser configuráveis por função/equipe e escopo de produto.
- Comercial/Administrativo como encaminhamento externo/telefone, sem construir funil comercial complexo agora.

## 6. Social Media com Zernio
- Recuperar a especificação/implementação anterior antes de reconstruir para preservar o que funcionava.
- Integrar Zernio via credenciais seguras e escopos mínimos, com contas e conexões por tenant.
- Calendário de publicações, criação/edição, rascunho, aprovação, agendamento, status, falhas e histórico.
- Publicar Facebook/Instagram apenas onde a conta e o tipo de publicação forem suportados e autorizados pelo provedor.
- Não afirmar publicação concluída sem confirmação do provedor; sincronizar estados e tratar token expirado.
- Biblioteca de mídia, prévia, validação de formato, permissões e registro de autoria.
- Atribuição UTM por publicação/campanha será um recurso futuro integrado, não bloqueador do suporte e cobrança.

## 7. Fases e aceite
### P0 — Validar operação real
Inventariar fluxo atual do bot, roteamento, equipes, tenants, integração Asaas, associação cliente-produto, endpoints, permissões e operação deploy.

### P1 — Suporte confiável
- Confirmar equipe/fila por produto, triagem, contexto e handoff.
- Testar cliente de cada produto, cliente multiproduto, não identificado, fila indisponível e agente ausente.
- Grupos permanecem desabilitados por padrão conforme regra existente.

### P2 — Financeiro assistido
- Validar consulta por CPF/CNPJ com autenticação e separação de produto.
- Resposta consistente no bot e no painel do agente.
- Link de pagamento e atualização de status confirmados.
- Testes de privacidade, autorização, isolamento por tenant e auditoria.

### P3 — Cobrança
- Implementar scheduler/régua com idempotência, supressão de pagos e revalidação.
- Simular os cinco marcos D-5/D-3/D0/D+2/D+5, incluindo vencimentos dia 10/20/30, fim de mês, feriados e timezone.
- Dashboard de carteira, cobrança manual segura e trilha de entrega.

### P4 — Social Media
- Recuperar referência anterior, confirmar o Zernio atualmente autorizado e integrar publicação com status real.
- Validar contas, mídia, falhas, reautorização e publicação ponta a ponta.

## Dependências bloqueadoras
1. Acesso à versão anterior da Véxora ou código/URL/arquivo da página de cobrança e integração Zernio para reproduzir o comportamento que o usuário aprovou. A cópia fiel não pode ser inferida somente por descrição.
2. Confirmar o mapeamento real de clientes/contratos/títulos do Asaas às três plataformas e às carteiras responsáveis.
3. Validar contrato técnico e credenciais/permissões das integrações financeiras e sociais no ambiente, sem colocar segredos no repositório.

## Fora da prioridade imediata
- Construir um sistema de aquisição paga completo.
- CAC/ROAS/ROI sem custo e conversões confiáveis.
- Funil comercial amplo para a Rastreabem atual.
- Misturar cobrança das três plataformas sem separação explícita.

## Critério de conclusão
Nenhum recurso financeiro será chamado de pronto sem teste ponta a ponta, autorização e tenant isolation, consistência de estado de pagamento, idempotência, auditoria e confirmação de execução no ambiente.
