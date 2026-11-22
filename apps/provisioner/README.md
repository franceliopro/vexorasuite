# Provisionador de sites (esqueleto em simulação)

Serviço interno de operação do projeto Dokploy `Estúdio de Sites`. **Este esqueleto não cria pasta, banco, usuário, vhost, TLS ou domínio real.** Ele apenas valida a requisição, monta o plano e simula o ciclo de vida do job.

## Rotas

| Método | Rota                             | Finalidade                                     |
| ------ | -------------------------------- | ---------------------------------------------- |
| `GET`  | `/`                              | GUI web (simulação)                            |
| `GET`  | `/styles.css`, `/app.js`         | Arquivos estáticos da GUI                      |
| `GET`  | `/health`                        | Verificação simples do processo                |
| `GET`  | `/meta`                          | Metadados: modo, versões PHP e versões legadas |
| `POST` | `/provision/dry-run`             | Valida e devolve o plano, sem aplicar          |
| `POST` | `/provision/apply`               | Marca o job como aplicado na simulação         |
| `GET`  | `/provision/:requestId/status`   | Estado real do job em memória                  |
| `POST` | `/provision/:requestId/rollback` | Marca o job como revertido                     |

## GUI web

A GUI é servida pelo próprio processo na raiz (`/`). Ela preenche o pedido, gera o `dry-run`, mostra o plano e os avisos, exige uma caixa de aprovação explícita antes de habilitar `apply`, consulta o `status` e oferece `rollback` com confirmação. As versões PHP vêm de `/meta`, então a lista da tela acompanha a API.

Nada na GUI executa recursos reais: o selo de modo simulação aparece no topo e o `status` sempre traz `tls: "pending"`.

## Contrato mínimo

```json
{
  "requestId": "vx-1001",
  "tenantId": "tenant-a",
  "slug": "alto-araguaia-imoveis",
  "domain": "exemplo.com.br",
  "type": "php-mysql",
  "phpVersion": "8.3",
  "quotaGb": 2,
  "source": "valuehost"
}
```

`type` aceita `php-mysql` ou `nextjs`. Para `php-mysql`, `phpVersion` deve estar na lista de 5.2 a 8.6. Versões 5.x e 7.x geram aviso explícito no `dry-run`.

## Segurança

- `requestId` é a chave de idempotência; reutilizá-lo com dados diferentes retorna `409`.
- Campos desconhecidos são descartados; senhas e tokens enviados no corpo não aparecem em plano, status ou resposta.
- O estado fica apenas em memória neste esqueleto. Persistência, Docker secrets, socket do Docker e webhook assinado virão em etapas seguintes.
- Nenhuma publicação é marcada como concluída: `status` sempre devolve `mode: "simulation"` e `tls: "pending"`.

## Comandos

```sh
pnpm --filter @vexorasuite/provisioner build
pnpm --filter @vexorasuite/provisioner test
pnpm --filter @vexorasuite/provisioner start
```
