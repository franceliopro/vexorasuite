import type { CollectionConfig } from 'payload'
import { isAdmin, isEditorOrAdmin, isTenantScopedReader } from '../access/roles'

export const Location: CollectionConfig = {
  slug: 'location',
  admin: { useAsTitle: 'naturalKey', defaultColumns: ['city', 'state', 'neighborhood', 'tenantId'] },
  access: {
    read: isTenantScopedReader,
    create: isEditorOrAdmin,
    update: isEditorOrAdmin,
    delete: isAdmin,
  },
  indexes: [{ fields: ['tenantId', 'naturalKey'], unique: true }],
  fields: [
    { name: 'tenantId', type: 'text', required: true, index: true },
    { name: 'city', type: 'text', required: true },
    { name: 'state', type: 'text' },
    { name: 'region', type: 'text' },
    { name: 'neighborhood', type: 'text' },
    {
      name: 'naturalKey',
      type: 'text',
      required: true,
      index: true,
      admin: { description: 'city|state|neighborhood. Usada como chave natural na migração.' },
    },
    { name: 'legacyId', type: 'text', index: true, admin: { readOnly: true } },
  ],
}