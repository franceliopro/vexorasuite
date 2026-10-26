# Manual da Véxora Intelligence Engine
Versão 0.1 — guia de treinamento e roteiro de vídeo

## 1. O que existe hoje
A Engine v1 classifica solicitações por regras, sem consumir tokens de LLM, e propõe rascunhos de fluxos para triagem Rastreabem e campanhas de carrossel. **Não executa nem publica fluxos.** A tela Agentes de IA salva configurações de assistentes e agentes; salvar ou habilitar não conecta automaticamente um agente ao WhatsApp. O chatbot operacional da Rastreabem é uma integração separada. O catálogo de Skills descreve capacidades, mas não é um executor de Skills.

## 2. Antes de começar
1. Entre na empresa correta (workspace/tenant). Não configure o piloto no workspace matriz por engano.
2. Confira se a API responde em /health e se o deploy da versão desejada foi concluído no Dokploy.
3. Confirme permissões de OWNER, ADMIN ou MANAGER para configuração e proposta de fluxo.
4. Use ambiente de testes para integrações financeiras. Nunca coloque chaves de API ou dados pessoais reais nos prompts de demonstração.

## 3. Configurar a assistente
1. Abra o módulo **Agentes de IA**.
2. Defina o nome da assistente e sua palavra de ativação.
3. Crie ou selecione um agente; configure perfil, comportamento, canais e modelo.
4. Mantenha o agente desabilitado até validar permissões, canal e integração.
5. Salve. O salvamento configura a empresa, mas **não autoriza envio automático de mensagens**.
6. Verifique GET /assistant/engine/status (autenticado) para conferir o modo de simulação e as capacidades disponíveis.

## 4. Testar o motor sem afetar clientes
1. Na área de laboratório da Engine, digite: "Quero pagar minha mensalidade".
2. Execute a simulação e confira a intenção payment e o próximo passo.
3. Repita com "Preciso de suporte no rastreador" e com uma mensagem ambígua.
4. A Engine deve encaminhar ambiguidade à revisão humana. Simulações não enviam mensagens a clientes.

## 5. Criar um rascunho de fluxo
1. Descreva: "Crie o fluxo de atendimento da Rastreabem com financeiro, suporte, comercial e administrativo".
2. Gere o rascunho; revise etapas e pendências.
3. Preencha destinos reais de equipes, contatos PF/PJ e administrativo antes de planejar a ativação.
4. A integração Asaas precisa validar identidade e permissões antes de mostrar cobranças.
5. O rascunho não é persistido nem ativado automaticamente. Não apresente esta etapa como um fluxo publicado.

## 6. Pessoas e telefones autorizados
1. Uma pessoa autorizada pertence a um contato e a uma empresa.
2. O cadastro nasce PENDING e não libera consultas financeiras.
3. Edições retornam o cadastro para PENDING e exigem nova verificação.
4. É possível revogar; exclusão física é limitada a registros pendentes.
5. A confirmação de identidade, a interface no CRM e a consulta automática pelo chatbot **ainda não estão concluídas**.

## 7. Segurança e operação
- Não substituir o chatbot existente sem testes de regressão e plano de reversão.
- Não permitir que automação responda quando a conversa estiver em atendimento humano.
- Respeitar isolamento entre empresas, permissões por função, auditoria e consentimentos aplicáveis.
- Ações externas (PIX, publicação social, alterações de CRM, mensagens) exigem validação de credenciais, idempotência e confirmação quando sensíveis.
- Não presumir que um telefone reconhecido comprova sozinho autorização permanente.

## 8. Roteiro para vídeo de treinamento
**Abertura (30 s):** diferença entre chatbot, Engine, agente e Skill.
**Configuração (2 min):** escolher empresa, abrir Agentes de IA, perfil e salvar.
**Laboratório (2 min):** simular pagamento, suporte e fallback.
**Fluxo (3 min):** solicitar rascunho Rastreabem, revisar pendências e explicar por que não está publicado.
**Segurança (2 min):** mostrar conceito de pessoa autorizada, status pendente e revogação.
**Encerramento (30 s):** explicar o que já funciona e o que está no roadmap.

## 9. Próximas entregas
1. Interface CRM para autorizações, com edição e histórico.
2. Verificação de identidade e consulta de permissões em tempo real.
3. Persistência, versionamento, teste e aprovação de workflows.
4. Executor de Skills com controle de acesso e trilha de auditoria.
5. Conexão controlada com canais, Asaas, Zernio e demais integrações.
6. Observabilidade, limites de custo e rollback de automações.

Este manual descreve o estado atual do produto e deve ser revisado após cada implantação validada.
