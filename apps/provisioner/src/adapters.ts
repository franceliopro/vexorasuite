import { mkdir, readFile, rmdir, unlink, writeFile } from "node:fs/promises";
import { join, resolve, sep } from "node:path";
import { phpImageFor, type ProvisionerConfig } from "./config.js";
import { databaseNameFor, folderFor } from "./plan.js";
import { readSecret } from "./secrets.js";
import {
  ProvisionerError,
  type ProvisionJob,
  type ProvisionStepResult,
} from "./types.js";

export interface ProvisionExecutor {
  readonly name: "simulation" | "real";
  execute(
    job: ProvisionJob,
    config: ProvisionerConfig,
  ): Promise<ProvisionStepResult[]> | ProvisionStepResult[];
  rollback(job: ProvisionJob, config: ProvisionerConfig): Promise<void>;
}

function skipped(
  kind: ProvisionStepResult["kind"],
  target: string,
  detail: string,
): ProvisionStepResult {
  return { kind, target, status: "skipped", detail };
}

function executed(
  kind: ProvisionStepResult["kind"],
  target: string,
  detail: string,
): ProvisionStepResult {
  return { kind, target, status: "executed", detail };
}

function failed(
  kind: ProvisionStepResult["kind"],
  target: string,
  detail: string,
): ProvisionStepResult {
  return { kind, target, status: "failed", detail };
}

export class SimulationExecutor implements ProvisionExecutor {
  readonly name = "simulation" as const;

  execute(job: ProvisionJob): ProvisionStepResult[] {
    return job.plan.actions.map((action) =>
      skipped(
        action.kind,
        action.target,
        "Simulação: nenhum recurso real criado",
      ),
    );
  }

  async rollback(): Promise<void> {
    // Não há recursos reais para desfazer.
  }
}

export class RealExecutor implements ProvisionExecutor {
  readonly name = "real" as const;

  async execute(
    job: ProvisionJob,
    config: ProvisionerConfig,
  ): Promise<ProvisionStepResult[]> {
    const steps: ProvisionStepResult[] = [];
    for (const action of job.plan.actions) {
      switch (action.kind) {
        case "folder":
          steps.push(await this.createFolder(job, config));
          break;
        case "database":
          steps.push(await this.database(job, config, "create-database"));
          break;
        case "user":
          steps.push(await this.database(job, config, "create-user"));
          break;
        case "vhost":
          steps.push(await this.writeVhost(job, config));
          break;
        case "tls":
          steps.push(
            skipped(
              "tls",
              action.target,
              "TLS gerenciado pelo Traefik; confirmado apenas pelo health-check HTTPS",
            ),
          );
          break;
        case "healthcheck":
          steps.push(
            skipped(
              "healthcheck",
              action.target,
              "Executado pelo orquestrador após a criação dos recursos",
            ),
          );
          break;
      }
    }
    steps.push(await this.filebrowserUser(job, config, "create"));
    return steps;
  }

  async rollback(job: ProvisionJob, config: ProvisionerConfig): Promise<void> {
    await this.removeVhost(job, config);
    if (job.request.type === "php-mysql") {
      if (config.dbAdminUrl && config.dbAdminSecretFile) {
        try {
          await this.callAdmin(config, "drop-user", job);
          await this.callAdmin(config, "drop-database", job);
        } catch {
          // Rollback é melhor esforço; o estado do job ainda é registrado.
        }
      }
      if (config.filebrowserUrl && config.filebrowserSecretFile) {
        try {
          await this.callFilebrowser(config, "delete", job);
        } catch {
          // Best effort.
        }
      }
    }
    try {
      await rmdir(this.folderPath(config, job.request.slug));
    } catch {
      // Só remove pastas vazias criadas por este job.
    }
  }

  private folderPath(config: ProvisionerConfig, slug: string): string {
    if (!config.sitesRoot) {
      throw new ProvisionerError(
        "PROVISIONER_SITES_ROOT não configurado",
        "configuration",
        500,
      );
    }
    const root = resolve(config.sitesRoot);
    const target = resolve(root, slug);
    if (target !== root && !target.startsWith(`${root}${sep}`)) {
      throw new ProvisionerError(
        "slug fora da raiz permitida",
        "invalid_request",
        400,
      );
    }
    return target;
  }

  private async createFolder(
    job: ProvisionJob,
    config: ProvisionerConfig,
  ): Promise<ProvisionStepResult> {
    const target = folderFor(job.request.slug);
    try {
      await mkdir(this.folderPath(config, job.request.slug), {
        recursive: true,
      });
      return executed("folder", target, "Pasta criada na raiz configurada");
    } catch {
      return failed("folder", target, "Falha ao criar a pasta do site");
    }
  }

  private async database(
    job: ProvisionJob,
    config: ProvisionerConfig,
    operation: "create-database" | "create-user",
  ): Promise<ProvisionStepResult> {
    const target = databaseNameFor(job.request.slug);
    if (!config.dbAdminUrl || !config.dbAdminSecretFile) {
      return failed(
        operation === "create-user" ? "user" : "database",
        target,
        "Administrador de banco não configurado",
      );
    }
    try {
      await this.callAdmin(config, operation, job);
      return executed(
        operation === "create-user" ? "user" : "database",
        target,
        operation === "create-user"
          ? "Usuário criado; senha permanece em Docker secret"
          : "Banco exclusivo criado",
      );
    } catch {
      return failed(
        operation === "create-user" ? "user" : "database",
        target,
        "Falha na operação de banco pelo endpoint configurado",
      );
    }
  }

  private async writeVhost(
    job: ProvisionJob,
    config: ProvisionerConfig,
  ): Promise<ProvisionStepResult> {
    const target = job.request.domain;
    if (!config.traefikConfigDir) {
      return failed(
        "vhost",
        target,
        "Diretório de config do Traefik não configurado",
      );
    }
    const container = config.siteContainerTemplate.replaceAll(
      "{slug}",
      job.request.slug,
    );
    const serviceUrl = `http://${container}.${config.traefikNetwork}:${config.sitePort}`;
    const image =
      job.request.type === "php-mysql" && job.request.phpVersion
        ? phpImageFor(config, job.request.phpVersion)
        : "imagem definida pelo serviço Next.js";
    const router = job.request.slug;
    const document = {
      http: {
        routers: {
          [router]: {
            rule: `Host(\`${job.request.domain}\`)`,
            service: router,
            entryPoints: ["websecure"],
            ...(config.tlsResolver
              ? { tls: { certResolver: config.tlsResolver } }
              : {}),
          },
        },
        services: {
          [router]: { loadBalancer: { servers: [{ url: serviceUrl }] } },
        },
      },
    };
    try {
      await writeFile(
        join(config.traefikConfigDir, `${job.request.slug}.json`),
        `${JSON.stringify(document, null, 2)}\n`,
        "utf8",
      );
      return executed("vhost", target, `Config escrita no Traefik (${image})`);
    } catch {
      return failed("vhost", target, "Falha ao escrever a config do Traefik");
    }
  }

  private async filebrowserUser(
    job: ProvisionJob,
    config: ProvisionerConfig,
    operation: "create" | "delete",
  ): Promise<ProvisionStepResult> {
    const username = `site_${job.request.slug.replaceAll("-", "_")}`;
    const target = folderFor(job.request.slug);
    if (!config.filebrowserUrl || !config.filebrowserSecretFile) {
      return failed(
        "filebrowser",
        target,
        "Filebrowser não configurado; usuário não criado",
      );
    }
    try {
      await this.callFilebrowser(config, operation, job);
      return executed(
        "filebrowser",
        target,
        operation === "create"
          ? `Usuário ${username} criado com escopo por site`
          : `Usuário ${username} removido`,
      );
    } catch {
      return failed("filebrowser", target, "Falha na operação do Filebrowser");
    }
  }

  private async callAdmin(
    config: ProvisionerConfig,
    operation:
      "create-database" | "create-user" | "drop-database" | "drop-user",
    job: ProvisionJob,
  ): Promise<void> {
    const secret = readSecret(config.dbAdminSecretFile!);
    const response = await fetch(`${config.dbAdminUrl}/operations`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${secret}`,
        "content-type": "application/json",
      },
      signal: AbortSignal.timeout(10000),
      body: JSON.stringify({
        operation,
        requestId: job.requestId,
        tenantId: job.request.tenantId,
        slug: job.request.slug,
        database: databaseNameFor(job.request.slug),
        passwordSecretName: `vx_${job.request.slug}_db_password`,
      }),
    });
    if (!response.ok) {
      throw new ProvisionerError("Operação de banco recusada", "upstream", 502);
    }
  }

  private async callFilebrowser(
    config: ProvisionerConfig,
    operation: "create" | "delete",
    job: ProvisionJob,
  ): Promise<void> {
    const secret = readSecret(config.filebrowserSecretFile!);
    const username = `site_${job.request.slug.replaceAll("-", "_")}`;
    const url =
      operation === "create"
        ? `${config.filebrowserUrl}/api/users`
        : `${config.filebrowserUrl}/api/users/${encodeURIComponent(username)}`;
    const response = await fetch(url, {
      method: operation === "create" ? "POST" : "DELETE",
      headers: {
        authorization: `Bearer ${secret}`,
        "content-type": "application/json",
      },
      signal: AbortSignal.timeout(10000),
      body:
        operation === "create"
          ? JSON.stringify({
              username,
              scope: folderFor(job.request.slug),
              passwordSecretName: `vx_${job.request.slug}_filebrowser_password`,
            })
          : undefined,
    });
    if (!response.ok) {
      throw new ProvisionerError(
        "Operação do Filebrowser recusada",
        "upstream",
        502,
      );
    }
  }

  private async removeVhost(
    job: ProvisionJob,
    config: ProvisionerConfig,
  ): Promise<void> {
    if (!config.traefikConfigDir) return;
    const path = join(config.traefikConfigDir, `${job.request.slug}.json`);
    try {
      const content = await readFile(path, "utf8");
      if (!content.includes(job.request.domain)) return;
      await unlink(path);
    } catch {
      // Arquivo ausente ou ilegível: nada a remover.
    }
  }
}
