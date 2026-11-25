import type { CollectionConfig } from 'payload'
import { isAdmin, isEditorOrAdmin, isTenantScopedReader } from '../access/roles'

/** Chaves naturais são indexadas, não únicas globalmente: a instância é multi-site. */
export const Category: CollectionConfig = {
  slug: 'category',
  admin: { useAsTitle: 'slug', defaultColumns: ['name', 'slug', 'tenantId'] },
  access: {
    read: isTenantScopedReader,
    create: isEditorOrAdmin,
    update: isEditorOrAdmin,
    delete: isAdmin,
  },
  fields: [
    { name: 'tenantId', type: 'text', required: true, index: true },
    { name: 'name', type: 'text', required: true },
    { name: 'slug', type: 'text', required: true, index: true },
    { name: 'legacyId', type: 'text', index: true, admin: { readOnly: true } },
  ],
}