import path from "node:path";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "../src/generated/prisma/client";
import { seedWorkspace } from "../src/lib/db/seed-data";

const dataDir = path.resolve(process.env.KORASA_DATA_DIR ?? "data");
const url = process.env.DATABASE_URL ?? `file:${path.join(dataDir, "korasa.db")}`;
const db = new PrismaClient({ adapter: new PrismaBetterSqlite3({ url }) });

/** Adds the sample courses and notes to an empty workspace (for demos and development). */
async function main() {
  const ws =
    (await db.workspace.findFirst({ orderBy: { createdAt: "asc" } })) ??
    (await db.workspace.create({ data: { name: "My Workspace" } }));
  const existing = (await db.collection.count({ where: { workspaceId: ws.id } })) + (await db.project.count({ where: { workspaceId: ws.id } }));
  if (existing) {
    console.log("The workspace already has content — skipping sample data.");
    return;
  }
  await seedWorkspace(db, ws.id);
  console.log("Added sample courses and notes.");
}

main().finally(() => db.$disconnect());
