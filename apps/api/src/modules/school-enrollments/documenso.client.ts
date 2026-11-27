import { BadGatewayException, Injectable, ServiceUnavailableException } from "@nestjs/common";

type Config = { baseUrl: string; token: string };

export interface CreatedEnvelope {
  envelopeId: string;
  externalId: string;
}

export interface DistributedEnvelope {
  signingUrl: string | null;
  recipients: Array<{ email: string; name: string; role: string; signingUrl: string | null }>;
}

/**
 * Cliente da API pública V2 do Documenso. Nenhuma chamada é feita sem configuração
 * explícita; ausência de credenciais resulta em estado PREPARED, nunca em "enviado".
 */
@Injectable()
export class DocumensoClient {
  private config(): Config {
    const rawUrl = process.env.DOCUMENSO_API_URL?.trim();
    const token = process.env.DOCUMENSO_API_TOKEN?.trim();
    if (!rawUrl || !token) {
      throw new ServiceUnavailableException("Documenso ainda não está configurado neste ambiente.");
    }
    let url: URL;
    try { url = new URL(rawUrl); } catch { throw new ServiceUnavailableException("DOCUMENSO_API_URL não é uma URL válida."); }
    if (!["http:", "https:"].includes(url.protocol) || url.username || url.password) {
      throw new ServiceUnavailableException("DOCUMENSO_API_URL deve usar HTTP/HTTPS sem credenciais embutidas.");
    }
    return { baseUrl: rawUrl.replace(/\/$/, ""), token };
  }

  isConfigured(): boolean {
    return Boolean(process.env.DOCUMENSO_API_URL?.trim() && process.env.DOCUMENSO_API_TOKEN?.trim());
  }

  private async request(path: string, init: RequestInit): Promise<Response> {
    const { baseUrl, token } = this.config();
    let response: Response;
    try {
      response = await fetch(baseUrl + path, {
        ...init,
        headers: { authorization: `api_${token.replace(/^api_/, "")}`, ...(init.headers || {}) },
        cache: "no-store",
        signal: AbortSignal.timeout(30_000),
        redirect: "error",
      });
    } catch (error) {
      if (error instanceof ServiceUnavailableException) throw error;
      throw new BadGatewayException("Documenso não respondeu nesta tentativa.");
    }
    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      throw new BadGatewayException(`Documenso recusou a operação (${response.status})${detail ? `: ${detail.slice(0, 160)}` : ""}.`);
    }
    return response;
  }

  async createEnvelope(input: {
    title: string;
    externalId: string;
    signerName: string;
    signerEmail: string;
    file: Buffer;
    filename: string;
    subject: string;
    message: string;
    redirectUrl?: string;
  }): Promise<CreatedEnvelope> {
    const payload = {
      type: "DOCUMENT",
      title: input.title,
      externalId: input.externalId,
      visibility: "EVERYONE",
      recipients: [{
        email: input.signerEmail,
        name: input.signerName,
        role: "SIGNER",
        fields: [
          { identifier: 0, type: "SIGNATURE", page: 1, positionX: 12, positionY: 88, width: 28, height: 5 },
          { identifier: 0, type: "DATE", page: 1, positionX: 62, positionY: 88, width: 18, height: 4 },
        ],
      }],
      meta: {
        subject: input.subject,
        message: input.message,
        timezone: "America/Sao_Paulo",
        ...(input.redirectUrl ? { redirectUrl: input.redirectUrl } : {}),
      },
    };
    const form = new FormData();
    form.append("payload", new Blob([JSON.stringify(payload)], { type: "application/json" }), "payload.json");
    form.append("files", new Blob([new Uint8Array(input.file)], { type: "application/pdf" }), input.filename);
    const response = await this.request("/api/v2/envelope/create", { method: "POST", body: form });
    const body = await response.json().catch(() => ({})) as { id?: unknown };
    if (typeof body.id !== "string" || !body.id) throw new BadGatewayException("Documenso não devolveu o identificador do envelope.");
    return { envelopeId: body.id, externalId: input.externalId };
  }

  async distribute(envelopeId: string, meta?: { subject?: string; message?: string }): Promise<DistributedEnvelope> {
    const response = await this.request("/api/v2/envelope/distribute", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ envelopeId, ...(meta ? { meta } : {}) }),
    });
    const body = await response.json().catch(() => ({})) as {
      recipients?: Array<{ email?: unknown; name?: unknown; role?: unknown; signingUrl?: unknown }>;
    };
    const recipients = (Array.isArray(body.recipients) ? body.recipients : []).map((item) => ({
      email: typeof item.email === "string" ? item.email : "",
      name: typeof item.name === "string" ? item.name : "",
      role: typeof item.role === "string" ? item.role : "SIGNER",
      signingUrl: typeof item.signingUrl === "string" && /^https:\/\//.test(item.signingUrl) ? item.signingUrl : null,
    }));
    return { signingUrl: recipients.find((item) => item.role === "SIGNER")?.signingUrl ?? null, recipients };
  }

  async downloadEnvelopeItem(envelopeItemId: string): Promise<Buffer> {
    if (!/^envelope_item_[A-Za-z0-9_-]+$/.test(envelopeItemId)) throw new BadGatewayException("Item de envelope inválido.");
    const response = await this.request(`/api/v2/envelope/item/${encodeURIComponent(envelopeItemId)}/download`, { method: "GET" });
    return Buffer.from(await response.arrayBuffer());
  }
}
