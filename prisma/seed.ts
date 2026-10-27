import path from "node:path";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "../src/generated/prisma/client";
import { seedWorkspace } from "../src/lib/db/seed-data";

const dataDir = path.resolve(process.env.KORASA_DATA_DIR ?? "data");
const url = process.env.DATABASE_URL ?? `file:${path.join(dataDir, "korasa.db")}`;
const db = new PrismaClient({ adapter: new PrismaBetterSqlite3({ url }) });

async function main() {
  if (await db.workspace.count()) {
    console.log("Workspace already exists — skipping sample content.");
    return;
  }
  const ws = await db.workspace.create({ data: { name: "My Workspace" } });
  await seedWorkspace(db, ws.id);
  console.log("Seeded sample workspace.");
}

main().finally(() => db.$disconnect());
