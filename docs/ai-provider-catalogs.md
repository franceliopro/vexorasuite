# Catálogos de IA e teste local

A interface oferece seletores por provedor e entrada manual de ID: Ollama, OpenRouter, OpenAI, Google Gemini, Claude (Anthropic), DeepSeek e Qwen (Alibaba Cloud, região Singapura). Claude Code é uma ferramenta de desenvolvimento; a integração utiliza a API Claude. Qwen também pode ser executado localmente pelo Ollama.

As chaves são criptografadas com vínculo à empresa e ao provedor. Chave cadastrada não confirma validade ou saldo. Catálogos autenticados usam a chave da empresa atual, sem cache compartilhado. Serviços sem chave mostram indisponibilidade, sem inventar modelos ou preços. Preços desconhecidos não são exibidos como gratuitos. A política local/grátis continua bloqueando provedores pagos sem contingência autorizada.

O seletor usa os catálogos oficiais, com paginação limitada para Claude e Qwen. Qwen usa o endpoint DashScope de Singapura; chaves de outras regiões exigem outra integração, não são intercambiáveis. O catálogo OpenAI omite IDs conhecidos de áudio/imagem/realtime e outros endpoints; um ID listado não garante acesso ou compatibilidade com Chat Completions. O teste privado confirma a execução.

Em 28/10/2026 o catálogo de produção retornou qwen2.5:1.5b instalado no Ollama. O primeiro teste privado retornou erro de API indisponível. Foi encontrado um prazo de 30 segundos no proxy web, menor que os 60 segundos permitidos pela API local. Os endpoints de geração agora esperam até 200 segundos, cobrindo a sequência limitada de três provedores. Isso não prova uma geração bem-sucedida antes da implantação e novo teste.

Validação automatizada: protocolos de geração e consumo, catálogos por empresa, paginação, falhas isoladas, ausência de dados secretos no retorno e política de custo. A implantação e o teste real devem ser confirmados separadamente.

Referências oficiais consultadas:
- https://developers.openai.com/api/reference/resources/models/methods/list
- https://developers.openai.com/api/reference/resources/chat/subresources/completions/methods/create
- https://ai.google.dev/gemini-api/docs/openai
- https://platform.claude.com/docs/en/api/messages/create
- https://platform.claude.com/docs/en/api/models/list
- https://api-docs.deepseek.com/api/list-models/
- https://www.alibabacloud.com/help/en/model-studio/list-models
- https://www.alibabacloud.com/help/en/model-studio/regions
