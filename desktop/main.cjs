// Oak's desktop shell. Electron supplies Chromium (Oak supports Chromium only: Web Audio, AudioWorklet and
// the mic all behave as the browser suites tested them); a bundled Bun runs Oak's own server on loopback,
// exactly as `bun run start` does. Progress stays in ~/.oak, shared with the browser version.
const { app, BrowserWindow, dialog, nativeTheme, session, shell, systemPreferences } = require("electron");
const { spawn, execFileSync } = require("node:child_process");
const fs = require("node:fs");
const net = require("node:net");
const os = require("node:os");
const path = require("node:path");

const FIRST_PORT = 8797; // not 8787, so the desktop app and a `bun run start` server can coexist
const PORT_TRIES = 10;

let server = null;
let serverLog = null;
let win = null;
let origin = null;
let quitting = false;

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on("second-instance", () => {
    if (win) {
      if (win.isMinimized()) win.restore();
      win.focus();
    }
  });
  app.whenReady().then(main);
}

/** Where the runtime lives: the app bundle's Resources when packaged, the repository in development. */
function runtime() {
  if (app.isPackaged) {
    return {
      root: path.join(process.resourcesPath, "oak"),
      bun: path.join(process.resourcesPath, "bin", "bun"),
    };
  }
  return { root: path.join(__dirname, ".."), bun: "bun" };
}

/** GUI apps get a bare PATH; the tutor needs the user's `claude`, so take PATH from their login shell. */
function loginPath() {
  const extra = [path.join(os.homedir(), ".local", "bin"), "/opt/homebrew/bin", "/usr/local/bin"];
  let shellPath = "";
  try {
    const sh = process.env.SHELL || "/bin/zsh";
    shellPath = execFileSync(sh, ["-ilc", 'printf "__OAKPATH__%s" "$PATH"'], {
      encoding: "utf8",
      timeout: 5000,
      stdio: ["ignore", "pipe", "ignore"],
    }).split("__OAKPATH__")[1];
  } catch {
    /* fall back to the defaults below */
  }
  const parts = [
    ...(shellPath || process.env.PATH || "").split(":"),
    ...extra,
    "/usr/bin",
    "/bin",
    "/usr/sbin",
    "/sbin",
  ];
  return [...new Set(parts.filter(Boolean))].join(":");
}

function portFree(port) {
  return new Promise((resolve) => {
    const s = net.createServer();
    s.once("error", () => resolve(false));
    s.once("listening", () => s.close(() => resolve(true)));
    s.listen(port, "127.0.0.1");
  });
}

async function pickPort() {
  for (let p = FIRST_PORT; p < FIRST_PORT + PORT_TRIES; p++) if (await portFree(p)) return p;
  throw new Error(`no free port between ${FIRST_PORT} and ${FIRST_PORT + PORT_TRIES - 1}`);
}

function logFile() {
  const dir = path.join(os.homedir(), "Library", "Logs", "Oak");
  fs.mkdirSync(dir, { recursive: true });
  return path.join(dir, "server.log");
}

function startServer(port) {
  const { root, bun } = runtime();
  const logPath = logFile();
  serverLog = fs.createWriteStream(logPath, { flags: "a" });
  serverLog.write(`\n--- ${new Date().toISOString()} Oak ${app.getVersion()} on port ${port}\n`);
  const env = { ...process.env, PATH: loginPath(), OAK_PORT: String(port) };
  delete env.OAK_DEV;
  delete env.ELECTRON_RUN_AS_NODE;
  server = spawn(bun, ["server/src/main.ts", "--serve-dist"], {
    cwd: root,
    env,
    stdio: ["ignore", "pipe", "pipe"],
  });
  server.stdout.pipe(serverLog, { end: false });
  server.stderr.pipe(serverLog, { end: false });
  server.on("exit", (code, signal) => {
    server = null;
    if (quitting) return;
    dialog.showErrorBox(
      "Oak stopped",
      `Oak's server exited (${signal ?? `code ${code}`}).\n\nThe log is at ${logPath}.`,
    );
    app.quit();
  });
  return logPath;
}

async function waitForServer(url, ms = 45000) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    if (!server) throw new Error("the server exited while starting");
    try {
      const res = await fetch(url);
      if (res.ok) return;
    } catch {
      /* not listening yet */
    }
    await new Promise((r) => setTimeout(r, 150));
  }
  throw new Error("the server did not start in time");
}

function lockDown() {
  const ses = session.defaultSession;
  const ours = (url) => typeof url === "string" && url.startsWith(origin);
  // The mic is for singing; nothing else is granted, and only to Oak's own pages.
  const allowed = new Set(["media", "clipboard-sanitized-write", "fullscreen", "speaker-selection"]);
  ses.setPermissionRequestHandler(async (wc, permission, callback, details) => {
    if (!allowed.has(permission) || !ours(details.requestingUrl ?? wc.getURL())) return callback(false);
    if (permission === "media" && (details.mediaTypes ?? []).includes("audio")) {
      return callback(await systemPreferences.askForMediaAccess("microphone"));
    }
    callback(true);
  });
  ses.setPermissionCheckHandler((_wc, permission, requestingOrigin) => {
    return allowed.has(permission) && ours(`${requestingOrigin}/`);
  });
}

// The window frame: macOS traffic lights inset over a title strip drawn in Oak's own theme (paper or bark,
// whichever the learner chose), with the wordmark centred. The strip pushes the shell and drawers down.
const BAR = 38;
const FRAME_CSS = `
:root { --oak-desktop-bar: ${BAR}px; }
body::before {
  content: "Oak";
  position: fixed; inset: 0 0 auto 0; height: var(--oak-desktop-bar); box-sizing: border-box;
  display: flex; align-items: center; justify-content: center;
  background: var(--oak-surface-2); border-bottom: 1px solid var(--oak-border);
  color: var(--oak-text-2); font: 600 14px/1 var(--oak-font-display, Georgia, serif); letter-spacing: 0.02em;
  -webkit-app-region: drag; user-select: none; z-index: 2147483000;
}
#root { padding-top: var(--oak-desktop-bar); box-sizing: border-box; }
#root .h-dvh { height: calc(100dvh - var(--oak-desktop-bar)); }
dialog.h-dvh { top: var(--oak-desktop-bar); height: calc(100dvh - var(--oak-desktop-bar)); }
`;

function createWindow() {
  win = new BrowserWindow({
    width: 1440,
    height: 920,
    minWidth: 960,
    minHeight: 640,
    title: "Oak",
    show: false,
    titleBarStyle: "hidden",
    trafficLightPosition: { x: 14, y: Math.round(BAR / 2 - 7) },
    backgroundColor: nativeTheme.shouldUseDarkColors ? "#14110e" : "#f6f2ea",
    webPreferences: {
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
      // Keep the scheduler and audio running at full rate when the window is in the background.
      backgroundThrottling: false,
    },
  });
  win.once("ready-to-show", () => win.show());
  win.webContents.on("dom-ready", () => {
    if (origin && win.webContents.getURL().startsWith(origin)) win.webContents.insertCSS(FRAME_CSS);
  });
  // Links that leave Oak open in the default browser.
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/.test(url) && !url.startsWith(origin)) shell.openExternal(url);
    return { action: "deny" };
  });
  win.webContents.on("will-navigate", (e, url) => {
    if (!url.startsWith(origin) && !url.startsWith("file:")) {
      e.preventDefault();
      if (/^https?:/.test(url)) shell.openExternal(url);
    }
  });
  win.on("closed", () => {
    win = null;
  });
  return win;
}

async function main() {
  const w = createWindow();
  await w.loadFile(path.join(__dirname, "splash.html"));
  let logPath = logFile();
  try {
    const port = await pickPort();
    origin = `http://127.0.0.1:${port}`;
    lockDown();
    logPath = startServer(port);
    await waitForServer(`${origin}/`);
    await w.loadURL(`${origin}/`);
  } catch (err) {
    if (quitting) return;
    dialog.showErrorBox("Oak could not start", `${err.message}\n\nThe log is at ${logPath}.`);
    app.quit();
  }
}

app.on("window-all-closed", () => app.quit());

app.on("before-quit", (e) => {
  quitting = true;
  if (!server) return;
  e.preventDefault();
  const proc = server;
  const kill = setTimeout(() => proc.kill("SIGKILL"), 4000);
  proc.once("exit", () => {
    clearTimeout(kill);
    server = null;
    app.quit();
  });
  proc.kill("SIGTERM");
});
