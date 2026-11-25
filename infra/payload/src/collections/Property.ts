import type { CollectionConfig } from 'payload'
import { isOwnerOrEditor, isTenantScopedReader, isWriter } from '../access/roles'

export const PROPERTY_STATUSES = ['draft', 'pending', 'published', 'rejected'] as const

/**
 * `owner_id` aponta para Users. O Studio nunca aceita owner de outro usuário:
 * acesso de escrita do agente é restrito aos próprios registros.
 */
export const Property: CollectionConfig = {
  slug: 'property',
  admin: { useAsTitle: 'code', defaultColumns: ['code', 'title', 'status', 'tenantId'] },
  access: {
    read: isTenantScopedReader,
    create: isWriter,
    update: isOwnerOrEditor,
    delete: isOwnerOrEditor,
  },
  fields: [
    { name: 'tenantId', type: 'text', required: true, index: true },
    { name: 'legacyId', type: 'text', index: true, admin: { readOnly: true } },
    { name: 'code', type: 'text', required: true, index: true },
    { name: 'title', type: 'text', required: true },
    { name: 'type', type: 'text' },
    {
      name: 'owner_id',
      type: 'relationship',
      relationTo: 'users',
      admin: { description: 'Dono do registro. Agentes só alteram imóveis que possuem.' },
    },
    { name: 'category', type: 'relationship', relationTo: 'category' },
    { name: 'purpose', type: 'relationship', relationTo: 'purpose' },
    { name: 'location', type: 'relationship', relationTo: 'location' },
    { name: 'price', type: 'number' },
    { name: 'condominium', type: 'number' },
    { name: 'bedrooms', type: 'number' },
    { name: 'bathrooms', type: 'number' },
    { name: 'parking', type: 'number' },
    { name: 'area', type: 'number' },
    {
      name: 'status',
      type: 'select',
      required: true,
      defaultValue: 'draft',
      options: [...PROPERTY_STATUSES],
      index: true,
    },
    {
      name: 'gallery',
      type: 'json',
      defaultValue: [],
      admin: { description: 'Itens { src, alt, position }. Nenhuma imagem é inventada pelo sistema.' },
    },
    { name: 'description', type: 'textarea' },
    { name: 'rejection_reason', type: 'textarea' },
    {
      name: 'legacyUpdatedAt',
      type: 'text',
      admin: { readOnly: true, description: 'Usado apenas para idempotência do snapshot.' },
    },
  ],
}