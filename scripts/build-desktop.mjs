#!/usr/bin/env node
/*
 * Builds the Korasa desktop installers.
 *
 *   node scripts/build-desktop.mjs --linux            # AppImage + deb
 *   node scripts/build-desktop.mjs --win              # NSIS installer (needs Wine on Linux)
 *   node scripts/build-desktop.mjs --mac              # dmg for arm64 + x64 (macOS only)
 *   ... --publish always                              # upload to GitHub Releases (CI)
 *
 * Steps: build Next.js as a standalone server, assemble it with static assets
 * and migrations, then give each target platform/arch its own copy containing
 * the matching prebuilt better-sqlite3 binary for Electron's ABI.
 */
import { execFileSync, execSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(import.meta.url);
const args = process.argv.slice(2);
const buildDir = path.join(root, "desktop", "build");
const run = (cmd, env = {}) => execSync(cmd, { cwd: root, stdio: "inherit", env: { ...process.env, ...env } });

const platforms = [
  args.includes("--linux") && "linux",
  args.includes("--win") && "win32",
  args.includes("--mac") && "darwin",
].filter(Boolean);
if (!platforms.length) platforms.push(process.platform);
const archsFor = (p) => (p === "darwin" ? ["arm64", "x64"] : ["x64"]);

// 1. Standalone Next.js server
console.log("\n▸ Building Next.js (standalone)…");
run("npx prisma generate");
run("npx next build", { KORASA_DESKTOP: "1", NEXT_TELEMETRY_DISABLED: "1" });

// 2. Assemble the base server bundle
console.log("\n▸ Assembling server bundle…");
const base = path.join(buildDir, "base");
fs.rmSync(buildDir, { recursive: true, force: true });
fs.cpSync(path.join(root, ".next", "standalone"), base, { recursive: true, verbatimSymlinks: true });
fs.cpSync(path.join(root, ".next", "static"), path.join(base, ".next", "static"), { recursive: true });
fs.cpSync(path.join(root, "public"), path.join(base, "public"), { recursive: true });
fs.cpSync(path.join(root, "prisma", "migrations"), path.join(base, "migrations"), { recursive: true });
// Belt and braces: drop anything that isn't runtime (and sharp, whose native
// binaries are host-specific; image optimisation is disabled).
for (const stray of [
  "data", "desktop", "landing", "dist-desktop", "scripts", "src", "prisma", ".env",
  "node_modules/sharp", "node_modules/@img",
]) fs.rmSync(path.join(base, stray), { recursive: true, force: true });
for (const f of fs.readdirSync(base)) {
  if (/\.(md|ya?ml|mjs|tsbuildinfo|jpe?g|png)$|^(components|skills-lock|tsconfig)\.json$|\.config\.ts$/.test(f)) fs.rmSync(path.join(base, f), { force: true });
}
// Turbopack links hashed external packages via symlinks in .next/node_modules.
// Installers (notably Windows) don't preserve symlinks, so materialise them.
function materialiseSymlinks(dir) {
  if (!fs.existsSync(dir)) return;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isSymbolicLink()) {
      const target = fs.realpathSync(p);
      fs.rmSync(p);
      fs.cpSync(target, p, { recursive: true, dereference: true });
    } else if (entry.isDirectory() && entry.name.startsWith("@")) {
      materialiseSymlinks(p);
    }
  }
}
materialiseSymlinks(path.join(base, ".next", "node_modules"));

if (!fs.existsSync(path.join(base, "node_modules", "better-sqlite3"))) {
  throw new Error("better-sqlite3 was not traced into the standalone bundle");
}

// 3. Per-target copies with Electron-ABI native binaries
const sqliteVersion = require(path.join(root, "node_modules", "better-sqlite3", "package.json")).version;
const electronAbi = execFileSync(require("electron"), ["-p", "process.versions.modules"], {
  env: { ...process.env, ELECTRON_RUN_AS_NODE: "1" },
  encoding: "utf8",
}).trim();

async function fetchNative(platform, arch, dest) {
  const name = `better-sqlite3-v${sqliteVersion}-electron-v${electronAbi}-${platform}-${arch}.tar.gz`;
  const url = `https://github.com/WiseLibs/better-sqlite3/releases/download/v${sqliteVersion}/${name}`;
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "korasa-native-"));
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`No prebuilt better-sqlite3 for ${platform}-${arch} (Electron ABI ${electronAbi}): ${res.status}`);
    const archive = path.join(tmp, name);
    fs.writeFileSync(archive, Buffer.from(await res.arrayBuffer()));
    execFileSync("tar", ["-xzf", archive, "-C", tmp]);
    const binary = path.join(tmp, "build", "Release", "better_sqlite3.node");
    // Every copy of the package (including Turbopack's hashed alias) gets the binary.
    const hashed = fs.existsSync(path.join(dest, ".next", "node_modules"))
      ? fs.readdirSync(path.join(dest, ".next", "node_modules")).filter((n) => n.startsWith("better-sqlite3")).map((n) => path.join(dest, ".next", "node_modules", n))
      : [];
    for (const pkg of [path.join(dest, "node_modules", "better-sqlite3"), ...hashed]) {
      const target = path.join(pkg, "build", "Release");
      fs.rmSync(target, { recursive: true, force: true });
      fs.mkdirSync(target, { recursive: true });
      fs.copyFileSync(binary, path.join(target, "better_sqlite3.node"));
    }
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

for (const platform of platforms) {
  for (const arch of archsFor(platform)) {
    console.log(`\n▸ Preparing ${platform}-${arch} (Electron ABI ${electronAbi})…`);
    const dest = path.join(buildDir, `${platform}-${arch}`, "server");
    fs.cpSync(base, dest, { recursive: true, verbatimSymlinks: true });
    await fetchNative(platform, arch, dest);
  }
}

// 4. Package
const ebArgs = [];
if (platforms.includes("linux")) ebArgs.push("--linux");
if (platforms.includes("win32")) ebArgs.push("--win");
if (platforms.includes("darwin")) ebArgs.push("--mac");
const publishIdx = args.indexOf("--publish");
ebArgs.push("--publish", publishIdx !== -1 ? args[publishIdx + 1] : "never");
console.log(`\n▸ electron-builder ${ebArgs.join(" ")}`);
run(`npx electron-builder --config electron-builder.yml ${ebArgs.join(" ")}`);
console.log("\n✓ Installers written to dist-desktop/");
