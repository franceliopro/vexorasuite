# Rastreabem chatbot — implementação incremental

Esta etapa introduz uma política de conversação pura, com testes, **sem ativá-la no webhook de produção**.

## Regras preservadas
- Protocolo único por atendimento: deve ser **gerado e persistido transacionalmente pelo serviço de conversas**, antes de chamar `startRastreabemBot`. A função não gera nem reserva protocolos.
- Clientes verificados na base seguem diretamente para a escolha do setor, sem perguntar o nome novamente. Um nome sugerido, não verificado, exige confirmação. A resposta vira `novo_nome`.
- Financeiro e Suporte exigem escolher Ceeb Vision, Link ou Rastreabem. Essas plataformas são apenas **rotas internas**; não são tenants ou contas Asaas independentes.
- Financeiro oferece duas opções após a plataforma: equipe humana ou pagamento Asaas.
- Consulta financeira recebe CPF/CNPJ e retorna somente um **efeito declarativo**. A integração real deve validar o documento, autorizar a consulta e confirmar pagamentos pelo provedor; não tratar emissão como pagamento confirmado.
- Comercial e Administrativo emitem ação de contato externo; os números e URLs devem vir das configurações do tenant, nunca embutidos no motor.
- Todas as ações de transferência e cobrança precisam ser executadas por serviços de backend com escopo de tenant, controle de idempotência e logs.

## Próximas etapas necessárias antes de habilitar
1. Persistir protocolos com unicidade por tenant e atendimento; definir o comportamento em reabertura.
2. Persistir estado do bot e executar efeitos com idempotência e tratamento de falhas.
3. Associar cada plataforma às equipes de Suporte e Financeiro da Rastreabem.
4. Integrar consulta de cobrança Asaas e mensagens de PIX/boleto; validar sandbox.
5. Integrar com o canal WAHA, controles de transferência humano/IA e horários.
6. Construir o editor gráfico com pan, zoom, drag, auto-layout, publicação versionada e simulação; adaptar componentes do repositório legado.
7. Testes ponta a ponta e rollout explícito por tenant. Stripe é uma integração futura, não deve ser anunciada como funcional sem backend.

Não publicar um fluxo incompleto automaticamente. O atendimento atual permanece intacto até essas etapas serem validadas.
