import type { CollectionConfig } from 'payload'
import { isAdmin, isAnyAuthenticated, ROLE_OPTIONS } from '../access/roles'

/**
 * Contas da instância única. API keys são geradas no Studio pelo admin e
 * representam uma conta `service`. O segredo fica no cofre do consumidor.
 */
export const Users: CollectionConfig = {
  slug: 'users',
  admin: {
    useAsTitle: 'email',
    defaultColumns: ['email', 'role', 'tenantId'],
    description: 'Usuários ilimitados. Papéis: admin, editor, agent e service.',
  },
  auth: {
    useAPIKey: true,
    tokenExpiration: 7200,
    verify: false,
    maxLoginAttempts: 5,
    lockTime: 10 * 60 * 1000,
  },
  access: {
    admin: isAdmin,
    create: isAdmin,
    read: isAnyAuthenticated,
    update: isAdmin,
    delete: isAdmin,
  },
  fields: [
    {
      name: 'role',
      type: 'select',
      required: true,
      defaultValue: 'agent',
      options: [...ROLE_OPTIONS],
      admin: { position: 'sidebar' },
    },
    {
      name: 'roleScope',
      type: 'text',
      admin: {
        description: 'Descrição opcional do escopo da conta. Não é regra de acesso.',
      },
    },
    {
      name: 'tenantId',
      type: 'text',
      index: true,
      admin: {
        description: 'Identificador do site atendido. Não limita quantidade de usuários.',
      },
    },
  ],
}