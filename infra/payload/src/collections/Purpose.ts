import type { CollectionConfig } from 'payload'
import { isAdmin, isEditorOrAdmin, isTenantScopedReader } from '../access/roles'

export const Purpose: CollectionConfig = {
  slug: 'purpose',
  admin: { useAsTitle: 'slug', defaultColumns: ['name', 'slug', 'tenantId'] },
  access: {
    read: isTenantScopedReader,
    create: isEditorOrAdmin,
    update: isEditorOrAdmin,
    delete: isAdmin,
  },
  indexes: [{ fields: ['tenantId', 'slug'], unique: true }],
  fields: [
    { name: 'tenantId', type: 'text', required: true, index: true },
    { name: 'name', type: 'text', required: true },
    { name: 'slug', type: 'text', required: true, index: true },
    { name: 'legacyId', type: 'text', index: true, admin: { readOnly: true } },
  ],
}