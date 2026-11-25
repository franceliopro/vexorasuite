import type { Access, User } from 'payload'

/** Papéis da instância única. Usuários são ilimitados; não há assento pago. */
export const ROLES = ['admin', 'editor', 'agent', 'service'] as const
export type Role = (typeof ROLES)[number]

export const ROLE_OPTIONS = [
  { label: 'Admin', value: 'admin' },
  { label: 'Editor', value: 'editor' },
  { label: 'Agente', value: 'agent' },
  { label: 'Serviço (API)', value: 'service' },
] as const

type AppUser = User & { role?: string | null; tenantId?: string | null }

function roleOf(user: unknown): Role | null {
  if (!user || typeof user !== 'object') return null
  const role = (user as AppUser).role
  return ROLES.includes(role as Role) ? (role as Role) : null
}

export function isRole(user: unknown, ...roles: Role[]): boolean {
  const role = roleOf(user)
  return role !== null && roles.includes(role)
}

/** Somente administração da plataforma pode criar, alterar ou apagar usuários. */
export const isAdmin: Access = ({ req }) => isRole(req.user, 'admin')

export const isEditorOrAdmin: Access = ({ req }) => isRole(req.user, 'admin', 'editor')

export const isWriter: Access = ({ req }) => isRole(req.user, 'admin', 'editor', 'agent')

export const isAnyAuthenticated: Access = ({ req }) => isRole(req.user, ...ROLES)

/**
 * Leitura por tenant. Admin e editor enxergam tudo; agent e service ficam
 * limitados ao próprio tenant. Nenhuma leitura é pública por padrão.
 */
export const isTenantScopedReader: Access = ({ req }) => {
  if (isRole(req.user, 'admin', 'editor')) return true
  const tenantId = (req.user as AppUser | undefined)?.tenantId
  if (!tenantId) return false
  return { tenantId: { equals: tenantId } }
}

/** Agente edita e apaga somente imóveis cujo owner_id aponta para ele. */
export const isOwnerOrEditor: Access = ({ req }) => {
  if (isRole(req.user, 'admin', 'editor')) return true
  const id = (req.user as { id?: string | number } | undefined)?.id
  if (id === undefined || id === null) return false
  return { owner_id: { equals: String(id) } }
}