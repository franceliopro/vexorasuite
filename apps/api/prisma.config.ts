import "dotenv/config";
import { defineConfig } from "prisma/config";

// Prisma 7 no longer reads DATABASE_URL from schema.prisma. The CLI reads it
// here while the application passes an explicit driver adapter to the client.
// Read the variable directly so `prisma generate` also works without a database.
export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: process.env.DATABASE_URL ?? "",
  },
});
