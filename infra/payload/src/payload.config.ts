import { postgresAdapter } from '@payloadcms/db-postgres'
import { lexicalEditor } from '@payloadcms/richtext-lexical'
import path from 'path'
import { buildConfig } from 'payload'
import { fileURLToPath } from 'url'
import sharp from 'sharp'

import { Category } from './collections/Category'
import { Location } from './collections/Location'
import { Media } from './collections/Media'
import { Property } from './collections/Property'
import { Purpose } from './collections/Purpose'
import { Submission } from './collections/Submission'
import { Users } from './collections/Users'
import { migrations } from './migrations'

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)

/** Falha clara e imediata se o cofre não entregou a configuração mínima. */
if (!process.env.DATABASE_URL || !process.env.PAYLOAD_SECRET) {
  throw new Error('DATABASE_URL e PAYLOAD_SECRET são obrigatórios. Configure no cofre antes de iniciar.')
}

export default buildConfig({
  admin: {
    user: Users.slug,
    importMap: { baseDir: path.resolve(dirname) },
  },
  collections: [Users, Category, Purpose, Location, Property, Submission, Media],
  editor: lexicalEditor(),
  secret: process.env.PAYLOAD_SECRET,
  typescript: { outputFile: path.resolve(dirname, 'payload-types.ts') },
  db: postgresAdapter({
    pool: { connectionString: process.env.DATABASE_URL },
    // Postgres em produção não cria tabelas sozinho. Este é um container de
    // longa duração: as migrations rodam na inicialização, antes de servir.
    prodMigrations: migrations,
  }),
  sharp,
  plugins: [],
})