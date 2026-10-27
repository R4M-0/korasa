/*
 * Korasa desktop shell. Everything runs on this machine: a bundled Next.js
 * server listens on 127.0.0.1 only, and all data lives in the OS app-data
 * directory. No network services are contacted.
 */
const { app, BrowserWindow, dialog, Menu, net, session, shell, utilityProcess } = require("electron");
const crypto = require("node:crypto");
const fs = require("node:fs");
const http = require("node:http");
const path = require("node:path");

const PREFERRED_PORT = 47823; // stable port keeps per-origin storage (UI prefs, drafts) across launches
const HOST = "127.0.0.1";

let server = null;
let mainWindow = null;
let origin = null;
let quitting = false;

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on("second-instance", () => {
    if (!mainWindow) return;
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  });
}

function serverDir() {
  return app.isPackaged
    ? path.join(process.resourcesPath, "server")
    : path.join(__dirname, "..", "build", `${process.platform}-${process.arch}`, "server");
}

function findPort(preferred) {
  return new Promise((resolve) => {
    const probe = http.createServer();
    probe.once("error", () => {
      const fallback = http.createServer();
      fallback.listen(0, HOST, () => {
        const { port } = fallback.address();
        fallback.close(() => resolve(port));
      });
    });
    probe.listen(preferred, HOST, () => probe.close(() => resolve(preferred)));
  });
}

async function waitForServer(url, token, timeoutMs = 30000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await net.fetch(`${url}/api/workspace`, { headers: { cookie: `korasa_token=${token}` } });
      if (res.ok) return;
    } catch {}
    await new Promise((r) => setTimeout(r, 150));
  }
  throw new Error("The local Korasa server did not start in time.");
}

function startServer(port, token) {
  const dataDir = path.join(app.getPath("userData"), "data");
  return new Promise((resolve, reject) => {
    server = utilityProcess.fork(path.join(__dirname, "server-entry.cjs"), [], {
      serviceName: "Korasa server",
      stdio: "pipe",
      env: {
        ...process.env,
        NODE_ENV: "production",
        PORT: String(port),
        HOSTNAME: HOST,
        KORASA_TOKEN: token,
        KORASA_DATA_DIR: dataDir,
        KORASA_SERVER_DIR: serverDir(),
        NEXT_TELEMETRY_DISABLED: "1",
      },
    });
    const logFile = path.join(app.getPath("userData"), "server.log");
    const log = fs.createWriteStream(logFile, { flags: "w" });
    server.stdout?.pipe(log);
    server.stderr?.pipe(log);
    let failure = null;
    server.on("message", (msg) => {
      if (msg?.type === "error") failure = msg.message;
    });
    server.on("exit", (code) => {
      server = null;
      if (!quitting) {
        const reason = failure ?? `The local server stopped unexpectedly (code ${code}). Details: ${logFile}`;
        reject(new Error(reason));
        dialog.showErrorBox("Korasa", reason);
        app.quit();
      }
    });
    server.on("spawn", resolve);
  });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 920,
    minWidth: 900,
    minHeight: 600,
    title: "Korasa",
    backgroundColor: "#f6f3ec",
    autoHideMenuBar: true,
    show: false,
    webPreferences: { contextIsolation: true, sandbox: true, spellcheck: true },
  });
  mainWindow.once("ready-to-show", () => mainWindow.show());
  mainWindow.loadFile(path.join(__dirname, "loading.html"));
  wireNavigation(mainWindow);

  // Let the page persist pending edits before the window goes away.
  let closing = false;
  mainWindow.on("close", (event) => {
    if (closing || !origin) return;
    event.preventDefault();
    closing = true;
    const flush = mainWindow.webContents
      .executeJavaScript("window.__korasaFlush ? window.__korasaFlush() : true")
      .catch(() => true);
    const timeout = new Promise((r) => setTimeout(r, 4000));
    Promise.race([flush, timeout]).finally(() => mainWindow?.destroy());
  });
  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

function wireNavigation(win) {
  const isInternal = (url) => origin && url.startsWith(origin);
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (isInternal(url)) {
      // Print views open in their own window.
      return {
        action: "allow",
        overrideBrowserWindowOptions: { width: 1000, height: 900, autoHideMenuBar: true, backgroundColor: "#f6f3ec" },
      };
    }
    if (/^https?:|^mailto:/.test(url)) shell.openExternal(url);
    return { action: "deny" };
  });
  win.webContents.on("will-navigate", (event, url) => {
    if (!isInternal(url) && !url.startsWith("file:")) {
      event.preventDefault();
      if (/^https?:|^mailto:/.test(url)) shell.openExternal(url);
    }
  });
  win.webContents.on("did-create-window", (child) => wireNavigation(child));
}

async function boot() {
  createWindow();
  const token = crypto.randomBytes(32).toString("hex");
  const port = await findPort(PREFERRED_PORT);
  origin = `http://${HOST}:${port}`;
  await session.defaultSession.cookies.set({ url: origin, name: "korasa_token", value: token, httpOnly: true, sameSite: "strict" });
  await startServer(port, token);
  await waitForServer(origin, token);
  await mainWindow?.loadURL(origin);
}

app.whenReady().then(() => {
  if (process.platform !== "darwin") Menu.setApplicationMenu(null);
  boot().catch((err) => {
    dialog.showErrorBox("Korasa couldn't start", String(err?.message ?? err));
    app.quit();
  });
  app.on("activate", () => {
    if (!mainWindow && origin) {
      createWindow();
      mainWindow.loadURL(origin);
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("before-quit", () => {
  quitting = true;
  server?.kill();
});
