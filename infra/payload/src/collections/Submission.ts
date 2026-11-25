import type { CollectionConfig } from 'payload'
import { isEditorOrAdmin, isTenantScopedReader, isWriter } from '../access/roles'

export const SUBMISSION_STATUSES = ['pending', 'approved', 'rejected'] as const

/**
 * Gravação do formulário público passa pelo Worker, nunca pelo navegador.
 * A decisão humana é auditada na Véxora; aqui só o status é alterado.
 */
export const Submission: CollectionConfig = {
  slug: 'submission',
  admin: { useAsTitle: 'submission_key', defaultColumns: ['submission_key', 'name', 'status', 'tenantId'] },
  access: {
    read: isTenantScopedReader,
    create: isWriter,
    update: isEditorOrAdmin,
    delete: isEditorOrAdmin,
  },
  indexes: [{ fields: ['tenantId', 'submission_key'], unique: true }],
  fields: [
    { name: 'tenantId', type: 'text', required: true, index: true },
    { name: 'legacyId', type: 'text', index: true, admin: { readOnly: true } },
    { name: 'submission_key', type: 'text', required: true, index: true },
    { name: 'name', type: 'text', required: true },
    { name: 'email', type: 'text', required: true },
    { name: 'phone', type: 'text' },
    { name: 'payload', type: 'json', defaultValue: {} },
    {
      name: 'status',
      type: 'select',
      required: true,
      defaultValue: 'pending',
      options: [...SUBMISSION_STATUSES],
      index: true,
    },
    {
      name: 'rejection_reason',
      type: 'textarea',
      admin: { description: 'Obrigatório quando status = rejected.' },
    },
    { name: 'property_id', type: 'relationship', relationTo: 'property' },
    { name: 'decidedAt', type: 'date' },
    { name: 'legacyCreatedAt', type: 'text', admin: { readOnly: true } },
  ],
}