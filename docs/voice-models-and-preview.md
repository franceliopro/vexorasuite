# Modelos e prévia de áudio

Escopo: somente IA. Os editores de Chatbots e Workflows não foram alterados.

Os campos Nome do modelo em STT e TTS usam seletores na configuração de agentes e na configuração geral. Catálogos locais consultam /v1/models filtrando automatic-speech-recognition ou text-to-speech. Somente modelos retornados pelo servidor são apresentados como instalados. A OpenAI tem listas separadas dos modelos compatíveis com transcrição de arquivos e Speech API; modelos Realtime não são oferecidos nesses campos. IDs não listados podem ser informados manualmente.

A prévia permite texto → áudio, reprodução com controles, download, áudio → transcrição e transcrição do próprio áudio gerado. A transcrição não envia o texto para o agente nem para clientes. A rota de prévia mantém autenticação, empresa, papel, Skill, política de custo e reserva de orçamento. A prévia pode testar um agente desabilitado sem ativá-lo.

Diagnóstico de produção em 28/10/2026: Speaches v0.8.2 respondia com catálogo vazio e HTTP 404 na síntese. Os modelos Systran/faster-whisper-small e speaches-ai/Kokoro-82M-v1.0-ONNX foram instalados pelo endpoint oficial. Depois, a Véxora confirmou Voz concluída e o proprietário confirmou que ouviu normalmente.

A inicialização speech-models instala esses dois modelos pelo endpoint idempotente do Speaches. A instalação usa o perfil local-ai e preserva o volume existente de modelos. O serviço de voz recebe healthcheck. A configuração PRELOAD_MODELS sozinha não havia produzido modelos instalados na versão observada.

Fontes:
- https://speaches.ai/usage/model-discovery/
- https://speaches.ai/usage/text-to-speech/
- https://developers.openai.com/api/docs/guides/speech-to-text
- https://developers.openai.com/api/reference/resources/audio/subresources/speech/methods/create
