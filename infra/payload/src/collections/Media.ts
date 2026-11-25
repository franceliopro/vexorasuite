import type { CollectionConfig } from 'payload'
import { isEditorOrAdmin, isTenantScopedReader } from '../access/roles'

/**
 * Catálogo de mídia legada por URL. Não é uma collection `upload`: nenhum
 * arquivo é baixado, gerado ou publicado por este app.
 */
export const Media: CollectionConfig = {
  slug: 'media',
  admin: { useAsTitle: 'filename', defaultColumns: ['filename', 'mimeType', 'tenantId'] },
  access: {
    read: isTenantScopedReader,
    create: isEditorOrAdmin,
    update: isEditorOrAdmin,
    delete: isEditorOrAdmin,
  },
  fields: [
    { name: 'tenantId', type: 'text', required: true, index: true },
    { name: 'legacyId', type: 'text', required: true, index: true },
    { name: 'filename', type: 'text' },
    { name: 'url', type: 'text' },
    { name: 'alt', type: 'text' },
    { name: 'mimeType', type: 'text' },
    { name: 'filesize', type: 'number' },
    { name: 'width', type: 'number' },
    { name: 'height', type: 'number' },
    { name: 'source', type: 'json', defaultValue: {} },
  ],
}