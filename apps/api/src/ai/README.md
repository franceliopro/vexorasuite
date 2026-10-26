# Véxora AI Core — fundação

Serviço interno NestJS para geração de texto com OpenAI/OpenRouter e fallback sequencial.
Importe `AiModule` no módulo consumidor e injete `AiService`.

## Limites e próximos passos
- Não existe rota HTTP pública de geração nesta entrega.
- Não há persistência de credenciais nem medição de custos por tenant.
- O chamador deve autorizar o usuário, selecionar as credenciais do tenant e registrar uso.
- Não registrar prompts, chaves ou dados sensíveis em logs.
- RAG, STT, TTS, imagem, pesquisa e integração ao Marketing ainda serão migrados.
- Verificar testes e build antes de qualquer merge; não ativar para clientes.
