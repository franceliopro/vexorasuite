import { PrismaPg } from "@prisma/adapter-pg";

function schemaFromConnectionString(connectionString: string): string | undefined {
  try {
    return new URL(connectionString).searchParams.get("schema") ?? undefined;
  } catch {
    return undefined;
  }
}

/**
 * Prisma 7 requires a driver adapter for every PostgreSQL client. The pool is
 * created from the same DATABASE_URL the Prisma CLI reads in prisma.config.ts.
 * The `schema` query parameter must be forwarded to both the pg pool (so raw
 * SQL uses the same search_path) and PrismaPg (so generated queries are
 * qualified for that schema).
 */
export function createPrismaAdapter(connectionString: string = process.env.DATABASE_URL ?? ""): PrismaPg {
  const schema = schemaFromConnectionString(connectionString);
  return new PrismaPg(
    {
      connectionString,
      options: schema ? `-c search_path="${schema}"` : undefined,
    },
    schema ? { schema } : undefined
  );
}
