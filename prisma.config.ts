import path from "node:path";
import { defineConfig } from "prisma/config";

const dataDir = path.resolve(process.env.KORASA_DATA_DIR ?? "data");

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    url: process.env.DATABASE_URL ?? `file:${path.join(dataDir, "korasa.db")}`,
  },
});
