import { BadRequestException } from "@nestjs/common";

export type SupportField = { key: string; label: string };
export type SupportSettings = { fields: SupportField[]; helpMinutes: number; escalationMinutes: number; replyMinutes: number };

const defaults: SupportSettings = {
  fields: [{ key: "service", label: "Serviço" }, { key: "reference", label: "Referência" }, { key: "diagnostic", label: "Diagnóstico e testes" }],
  helpMinutes: 60,
  escalationMinutes: 30,
  replyMinutes: 30,
};

export function supportRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

export function supportText(value: unknown, label: string, max: number, optional = false): string {
  if (optional && (value === undefined || value === "")) return "";
  if (typeof value !== "string" || (!optional && !value.trim()) || value.trim().length > max) {
    throw new BadRequestException(label + " deve ter até " + max + " caracteres.");
  }
  return value.trim();
}

export function validateSupportSettings(value: unknown): SupportSettings {
  const input = supportRecord(value);
  if (!Array.isArray(input.fields) || input.fields.length > 12) throw new BadRequestException("Configure até 12 campos.");
  const fields = input.fields.map(value => {
    const field = supportRecord(value);
    if (typeof field.key !== "string" || !/^[a-z][a-z0-9_]{0,31}$/.test(field.key) || ["constructor","prototype"].includes(field.key)) {
      throw new BadRequestException("Use uma chave de campo válida.");
    }
    return { key: field.key, label: supportText(field.label, "Nome do campo", 55) };
  });
  if (new Set(fields.map(field => field.key)).size !== fields.length) throw new BadRequestException("As chaves dos campos devem ser únicas.");
  function minutes(value: unknown) {
    if (typeof value !== "number" || !Number.isInteger(value) || value < 1 || value > 10080) {
      throw new BadRequestException("O prazo deve estar entre 1 e 10080 minutos.");
    }
    return value;
  }
  return { fields, helpMinutes: minutes(input.helpMinutes), escalationMinutes: minutes(input.escalationMinutes), replyMinutes: minutes(input.replyMinutes ?? defaults.replyMinutes) };
}

export function readSupportSettings(integrations: unknown): SupportSettings {
  const value = supportRecord(integrations).supportSettings;
  return value === undefined ? defaults : validateSupportSettings(value);
}
