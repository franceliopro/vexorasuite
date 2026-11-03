# Trabalho assíncrono

## O que roda em background

| Job | Intervalo | Onde | Trava |
|---|---|---|---|
| `webhook-worker` | 2 s (configurável) | processo próprio | `FOR UPDATE SKIP LOCKED` na tabela `webhook_deliveries` |
| Triagem de áudio (`audio-triage`) | 15 s | API ou `scheduler-worker` | lease `audio-triage` + claim da mensagem em transação |
| Cadência de workflows (`workflow-cadence`) | 15 s | API ou `scheduler-worker` | lease `workflow-cadence` + `SKIP LOCKED` nos runs |
| Saúde dos canais (`channel-health`) | 15 s | API ou `scheduler-worker` | lease `channel-health` + `healthNextCheckAt` por canal |
| Reconciliação Asaas | diária | API ou `scheduler-worker` | `pg_try_advisory_xact_lock` |

## Trava por job (lease)

Cada tick tenta registrar sua linha em `scheduler_leases` (`JobLeaseService`). Só a primeira
réplica que chegar vence; as demais pulam o tick e tentam de novo no intervalo seguinte. Se o
processo morrer no meio, a lease expira sozinha e outro processo assume — não existe risco de
travar o job para sempre.

O trabalho real continua protegido por claim próprio (transação da mensagem, `SKIP LOCKED` dos
workflows), então a lease é uma camada de eficiência e não a única garantia contra duplicidade.

## Onde os jobs rodam

`SCHEDULER_MODE` decide:

- `in-process` (padrão): a API inicia os timers. Funciona com uma ou várias réplicas, porque cada
tick pega a lease. É o modo atual do Compose e não exige nada do Dokploy.
- `worker`: a API não inicia timers; quem roda é o serviço `scheduler-worker`
  (`node dist/scheduler-worker.js`), que só sobe com o profile `scheduler`:
  `docker compose --profile scheduler up -d` e `SCHEDULER_MODE=worker` na API.
- `off`: nenhum job periódico (container de migração, leitura etc.).

## Arquivos

- `apps/api/src/webhook-worker.ts` — entregas de webhook com retry e backoff.
- `apps/api/src/scheduler-worker.ts` — processo dos jobs periódicos.
- `apps/api/src/common/job-lease.service.ts` — lease compartilhada em banco.
- `apps/api/src/common/scheduler-mode.ts` — decide papel do processo.
- `apps/api/prisma/migrations/20261103090000_scheduler_leases` — tabela da lease.
