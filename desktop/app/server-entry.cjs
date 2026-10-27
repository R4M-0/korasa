/*
 * Runs inside an Electron utility process: applies pending SQL migrations to
 * the user's local database, then boots the bundled Next.js server.
 */
const fs = require("node:fs");
const path = require("node:path");

const serverDir = process.env.KORASA_SERVER_DIR;
const dataDir = process.env.KORASA_DATA_DIR;
const migrationsDir = path.join(serverDir, "migrations");

function migrate() {
  fs.mkdirSync(path.join(dataDir, "attachments"), { recursive: true });
  const Database = require(path.join(serverDir, "node_modules", "better-sqlite3"));
  const db = new Database(path.join(dataDir, "korasa.db"));
  try {
    db.pragma("journal_mode = WAL");
    db.exec("CREATE TABLE IF NOT EXISTS _korasa_migrations (name TEXT PRIMARY KEY, applied_at TEXT NOT NULL)");
    const applied = new Set(db.prepare("SELECT name FROM _korasa_migrations").pluck().all());
    const pending = fs
      .readdirSync(migrationsDir, { withFileTypes: true })
      .filter((d) => d.isDirectory() && !applied.has(d.name))
      .map((d) => d.name)
      .sort();
    for (const name of pending) {
      const sql = fs.readFileSync(path.join(migrationsDir, name, "migration.sql"), "utf8");
      db.transaction(() => {
        db.exec(sql);
        db.prepare("INSERT INTO _korasa_migrations (name, applied_at) VALUES (?, ?)").run(name, new Date().toISOString());
      })();
    }
  } finally {
    db.close();
  }
}

try {
  migrate();
} catch (err) {
  process.parentPort?.postMessage({ type: "error", message: `Database migration failed: ${err.message}` });
  process.exit(1);
}

process.chdir(serverDir);
require(path.join(serverDir, "server.js"));
