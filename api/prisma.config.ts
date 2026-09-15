import { defineConfig } from "prisma/config";
import { PrismaPg } from "@prisma/adapter-pg";

process.loadEnvFile();

export default defineConfig({
  schema: "prisma/schema.prisma",
  datasource: {
    url: process.env.DATABASE_URL,
  },
  migrate: {
    async adapter() {
      return new PrismaPg({ connectionString: process.env.DATABASE_URL });
    },
  },
  migrations: {
    seed: "node prisma/seed.ts",
  },
});
