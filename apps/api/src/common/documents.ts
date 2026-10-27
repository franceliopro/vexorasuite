import { ArgumentMetadata, Injectable, PipeTransform } from '@nestjs/common';

/** Normalize only document fields; never rewrite a customer's message or a file. */
export const isDocumentField = (key: string) => /^(cpf|cnpj|cpf_?cnpj|document|documento|document_?number)$/i.test(key);
export function documentDigits(value: unknown): string {
  return typeof value === 'string' ? value.normalize('NFKC').replace(/\D/g, '') : '';
}
export function normalizeDocumentFields(value: unknown, depth = 0): unknown {
  if (depth > 20 || !value || typeof value !== 'object' || Buffer.isBuffer(value) || value instanceof Date) return value;
  if (Array.isArray(value)) return value.map(item => normalizeDocumentFields(item, depth + 1));
  return Object.fromEntries(Object.entries(value).map(([key, item]) => [key,
    isDocumentField(key) && typeof item === 'string' ? documentDigits(item) : normalizeDocumentFields(item, depth + 1)]));
}
@Injectable()
export class DocumentNormalizationPipe implements PipeTransform {
  transform(value: unknown, metadata: ArgumentMetadata) {
    if (metadata.type === 'body' || metadata.type === 'query') {
      return metadata.data && isDocumentField(metadata.data) && typeof value === 'string'
        ? documentDigits(value) : normalizeDocumentFields(value);
    }
    return value;
  }
}
