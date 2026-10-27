# Pesquisa e execução de IA com prioridade gratuita

Pesquisa de fontes primárias em 27/10/2026. Código aberto elimina a licença ou a cobrança de inferência do fornecedor, mas utiliza CPU, memória, disco e manutenção do servidor. Serviços gratuitos hospedados têm cotas, condições e disponibilidade próprias.

## Implementação

O módulo Agentes de IA oferece uma política por empresa: priorizar modelos locais/gratuitos e permitir ou bloquear contingência paga. Quando a prioridade está ativa, a ordem é Ollama configurado → modelos OpenRouter gratuitos → modelos pagos explicitamente configurados, somente se autorizados. O preset gratuito visível é `openrouter/free`. Pedidos gratuitos incluem limite de preço zero para entrada/saída, recusam provedores que coletam dados e desativam o plugin pago de busca. Não há compra de créditos nem troca automática para um modelo pago quando a contingência está bloqueada.

A configuração anterior de outras empresas permanece preservada. A prioridade deve ser salva na empresa desejada. A política também bloqueia voz OpenAI e pesquisa Brave quando a contingência paga não está autorizada. Os limites diários, permissões e Skills continuam ativos, inclusive no processamento local.

Busca usa SearXNG próprio quando `SEARXNG_URL` está configurado. O resultado é limitado a cinco fontes HTTPS e 512 KB por resposta, com timeout e sem seguir redirects. Não há fallback pago após erro local. A API de pesquisa não recebe chaves do OpenRouter/OpenAI. O cache de pesquisa existente é isolado por empresa.

Ollama recebe somente requisições no endereço definido pelo operador em `OLLAMA_BASE_URL`. A interface não pode indicar um endpoint arbitrário e nenhuma chave de nuvem é enviada ao Ollama. `OLLAMA_DEFAULT_MODEL` identifica o modelo local padrão instalado. Voz local usa Speaches em `LOCAL_VOICE_URL`, com as rotas compatíveis de transcrição e síntese. A voz portuguesa padrão é `pf_dora`, alterável por `LOCAL_TTS_VOICE`.

## Infraestrutura incluída

O Compose adiciona serviços privados, sem portas publicadas na internet:

- SearXNG: JSON habilitado, segredo independente gerado a cada inicialização, 512 MB e 0,5 CPU; Bing, DuckDuckGo e Wikipedia como fontes iniciais. Bloqueios dos buscadores podem reduzir resultados.
- Ollama: um modelo carregado e uma execução paralela; teto de 4 GB e 2 CPUs. Inicializador baixa `qwen2.5:1.5b`, cerca de 986 MB, Apache 2.0 e suporte a português.
- Speaches CPU: teto de 2 GB e 1 CPU; modelos `Systran/faster-whisper-small` e `speaches-ai/Kokoro-82M-v1.0-ONNX`; cache persistente.
- FFmpeg e Sharp já compõem artes e vídeos por templates. Essa composição não equivale a geração cinematográfica por modelo de vídeo.

Os serviços novos não são dependências obrigatórias da inicialização da API. Uma falha de pesquisa/voz/modelo fica restrita à operação correspondente. Downloads iniciais e carregamento dos modelos podem demorar. Configuração de endereço, instalação e disponibilidade real são estados diferentes; conferir a primeira execução antes de considerar o serviço validado.

## Alternativas pesquisadas

| Uso | Opção | Condição e situação |
|---|---|---|
| Escrever e conversar | Ollama + Qwen2.5 1.5B | Integração local implementada; qualidade e velocidade devem ser avaliadas no servidor. A licença varia por tamanho: 1.5B é Apache 2.0; não generalizar para 3B/72B. |
| Texto gratuito hospedado | OpenRouter Free | Integração implementada. Em geral 50 pedidos/dia sem créditos, ou 1.000/dia após aquisição de pelo menos US$ 10 em créditos; não foi feita aquisição. Falhas também consomem cota. |
| Transcrever e falar | Whisper/Kokoro via Speaches | Adaptador e infraestrutura CPU incluídos. Modelos precisam concluir download e validação. Kokoro tem vozes em português brasileiro. |
| Pesquisa | SearXNG | Sem cobrança de API do software; manutenção e recursos próprios. Instâncias públicas frequentemente não permitem JSON e não são o padrão da Véxora. |
| Pesquisa com cota grátis | Tavily | 1.000 créditos mensais sem cartão; alternativa pesquisada, ainda sem conector. |
| Texto e transcrição com cota | Groq | Plano gratuito e limites por modelo/organização; alternativa pesquisada, ainda sem conector. Não classificar o provedor hospedado como software aberto. |
| Texto/imagens com cota | Gemini API | Há modalidades gratuitas para determinados modelos. Limites variam e o tratamento dos dados difere do plano pago; não habilitado para dados de clientes nesta etapa. |
| Imagens generativas | FLUX.1 schnell | Pesos Apache 2.0; uso local requer capacidade de inferência. Pesquisado; servidor gerador ainda não conectado. |
| Vídeos generativos | Wan2.2 | Pesquisado; a configuração oficial TI2V-5B cita GPU com ao menos 24 GB de VRAM. Não ativado em VPS sem GPU confirmada. |
| Publicar/agendar | Postiz self-hosted | Alternativa pesquisada; requer implantação, credenciais e permissões das redes. O conector Zernio existente continua responsável pela publicação nesta etapa. |

Publicação e interação social são integrações com redes, não modelos de linguagem. Um modelo gratuito não remove tarifas ou exigências da plataforma/conector. Não foi criado um conector Postiz fictício nem marcada como ativa uma integração ainda ausente.

## Fontes primárias

- SearXNG: https://docs.searxng.org/user/about.html ; https://docs.searxng.org/dev/search_api.html ; https://github.com/searxng/searxng/tree/master/container
- Ollama: https://docs.ollama.com/api/openai-compatibility ; https://ollama.com/library/qwen2.5:1.5b
- OpenRouter: https://openrouter.ai/openrouter/free ; https://openrouter.ai/blog/tutorials/how-to-get-the-lowest-cost-llm-inference-on-openrouter/
- Speaches: https://speaches.ai/installation/ ; https://speaches.ai/usage/text-to-speech/ ; https://speaches.ai/usage/speech-to-text/
- Kokoro: https://huggingface.co/hexgrad/Kokoro-82M ; https://huggingface.co/hexgrad/Kokoro-82M/blob/main/VOICES.md
- Tavily: https://www.tavily.com/pricing
- Groq: https://console.groq.com/docs/rate-limits
- Gemini: https://ai.google.dev/gemini-api/docs/pricing
- Imagem: https://huggingface.co/black-forest-labs/FLUX.1-schnell
- Vídeo: https://github.com/Wan-Video/Wan2.2
- Publicação: https://postiz.com/

## Verificação

Regressões cobrem ordem de modelos, exclusão dos pagos, preço zero no OpenRouter, ausência de envio de chaves aos serviços locais, limites e sanitização da pesquisa, proibição de fallback pago, autorização da política e voz local. A CI inicia um SearXNG isolado e verifica o formato JSON, além das verificações já existentes de tipos, PostgreSQL, aplicações e containers.
