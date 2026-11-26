# Telefonia — serviço separado no Dokploy

Reabertura aprovada pelo proprietário em 26/11/2026. **Nenhuma credencial, token, senha, número de telefone ou segredo deve entrar no Git ou no chat.** Os valores reais ficam somente no cofre do Dokploy.

## Estado desta fatia

- Entregue: webhook assinado por tenant, idempotência, consentimento default-deny, auditoria, hash dos números, Postgres isolado, Dockerfile, Compose e CI.
- Não entregue: discagem real via Nvoip/SIP, áudio de chamada, STT/TTS, chamadas com IA e tela na Véxora. Estes virão em fatias seguintes, com revisão própria.
- Padrão `TELEPHONY_MODE=simulation`. O modo `real` exige `TELEPHONY_ALLOW_REAL=true` e credenciais da operadora no cofre; **nenhuma chamada, mensagem ou IA é executada pelo endpoint nesta fatia**.
- A presença deste Compose **não** prova deploy, ligação realizada, gravação obtida ou integração com operadora.

## Limites

- Projeto Dokploy **separado** do stack Véxora, do Payload, do Documenso e das escolas: banco, volume, domínio e segredos próprios.
- O `tenantId` vem da rota configurada no cofre; um `tenantId` enviado no corpo do webhook é ignorado. Nenhum evento pode ser redirecionado para outra empresa.
- Assinatura HMAC-SHA256 de `timestamp.corpo` por tenant, com janela de tolerância configurável e ID de correlação obrigatório. Comparação em tempo constante.
- Consentimento **default-deny**: ausência de registro, canal diferente, revogação ou opt-out bloqueiam gravação, transcrição e IA. Opt-out não pode ser desligado.
- Números são gravados como **hash por tenant/canal**, nunca em texto puro nem em log. Mídia e transcrição só entram no banco quando o consentimento cobre o uso correspondente.
- Nenhum scraping: quando o adaptador real existir, ele usará somente APIs oficiais e autorizadas pela operadora.

## Variáveis no cofre do Dokploy

| Variável | Origem |
| --- | --- |
| `TELEPHONY_POSTGRES_USER` | Usuário do banco exclusivo desta stack |
| `TELEPHONY_POSTGRES_PASSWORD` | Senha gerada no cofre (`openssl rand -base64 24`) |
| `TELEPHONY_POSTGRES_DB` | Nome do banco exclusivo desta stack |
| `TELEPHONY_TENANTS` | JSON `{ "tenantId": { "provider": "NVOIP", "webhookSecret": "..." } }` com segredo por tenant |
| `TELEPHONY_MODE` | `simulation` (padrão) ou `real` |
| `TELEPHONY_ALLOW_REAL` | `true` somente depois de credenciais válidas e piloto autorizado |
| `TELEPHONY_WEBHOOK_TOLERANCE_SECONDS` | Opcional; padrão `300` (30–3600) |
| `TELEPHONY_HOST_PORT` | Opcional; porta publicada no host (padrão `3002`) |

## Configuração no Dokploy

1. Criar projeto novo, separado, apontando para a branch aprovada.
2. Selecionar Docker Compose e usar `infra/telephony/docker-compose.yml` como Compose Path.
3. Cadastrar todas as variáveis acima no secret store **antes** do primeiro deploy. Nunca colar `TELEPHONY_TENANTS` no chat.
4. Criar volume novo e exclusivo: `telephony-pgdata`. Não reutilizar volumes de outro projeto.
5. Manter o banco sem porta publicada; apenas o serviço `telephony` é exposto via reverse proxy.
6. Fazer o primeiro deploy em `simulation` e confirmar `GET /health` antes de considerar a stack disponível.
7. Só trocar para `real` após configurar credenciais da operadora e registrar a decisão em novo PR.

## Verificação do contrato

- `GET /health` responde `status: ok`, modo e quantidade de tenants, sem segredos.
- Um webhook assinado com `tenantId` da rota é persistido uma única vez; o mesmo evento repetido retorna `duplicate: true` e não gera nova auditoria.
- Sem consentimento, `recordingStored`, `transcriptStored` e `aiInvoked` são `false`, e o banco rejeita mídia com `consent_reason <> 'GRANTED'`.
- O CI valida o Compose, o Dockerfile, a migration e os testes do serviço.

## Rollback

- Voltar `TELEPHONY_MODE` para `simulation` e redeployar a revisão anterior; nenhuma chamada é feita nesse modo.
- Mantido o volume exclusivo, restaurar o Compose anterior. Nunca apagar o volume sem backup.
