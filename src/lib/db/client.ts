import "server-only";
import path from "node:path";
import fs from "node:fs";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "@/generated/prisma/client";

export const DATA_DIR = path.resolve(process.env.KORASA_DATA_DIR ?? "data");
export const ATTACHMENTS_DIR = path.join(DATA_DIR, "attachments");

function createClient() {
  fs.mkdirSync(ATTACHMENTS_DIR, { recursive: true });
  const url = process.env.DATABASE_URL ?? `file:${path.join(DATA_DIR, "korasa.db")}`;
  const adapter = new PrismaBetterSqlite3({ url });
  return new PrismaClient({ adapter });
}

const globalForPrisma = globalThis as unknown as { korasaPrisma?: PrismaClient };

export const db = globalForPrisma.korasaPrisma ?? createClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.korasaPrisma = db;
