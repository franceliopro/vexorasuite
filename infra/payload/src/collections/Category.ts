import type { CollectionConfig } from 'payload'
import { isAnyAuthenticated, isEditorOrAdmin, isTenantScopedReader } from '../access/roles'

export const Category: CollectionConfig = {
  slug: 'category',
  admin: { useAsTitle: 'slug', defaultColumns: ['name', 'slug', 'tenantId'] },
  access: {
    read: isTenantScopedReader,
    create: isEditorOrAdmin,
    update: isEditorOrAdmin,
    delete: isAdminForCategory,
  },
  fields: [
    { name: 'tenantId', type: 'text', required: true, index: true },
    { name: 'name', type: 'text', required: true },
    { name: 'slug', type: 'text', required: true, index: true, unique: true },
    { name: 'legacyId', type: 'text', index: true, admin: { readOnly: true } },
  ],
}