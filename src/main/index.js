const { app, Menu, BrowserWindow } = require("electron");
const { startup: log } = require("./services/app-logger");
const { createSplashWindow } = require("./windows/splash-window");
const { registerSplashHandlers } = require("./ipc/register-splash-handlers");
const channels = require("../shared/ipc/channels");

if (process.platform === "win32" && app.isPackaged) {
  app.setAppUserModelId("com.softasium.sitefinity-cpilot");
}

function sendSplashStatus(splash, text, options = {}) {
  if (splash && !splash.isDestroyed() && splash.webContents && !splash.webContents.isDestroyed()) {
    const loading = options.loading !== false;
    splash.webContents.send(channels.SPLASH_STATUS, { text, loading });
  }
}

function waitForWebContentsLoad(win) {
  if (win.isDestroyed() || !win.webContents || win.webContents.isDestroyed()) {
    return Promise.resolve();
  }
  if (!win.webContents.isLoading()) {
    return Promise.resolve();
  }
  return new Promise((resolve) => {
    win.webContents.once("did-finish-load", resolve);
  });
}

function yieldToEventLoop() {
  return new Promise((resolve) => setImmediate(resolve));
}

function loadHeavyModules() {
  return new Promise((resolve) => {
    setImmediate(() => {
      const { registerIpcHandlers } = require("./ipc/register");
      const { createMainWindow } = require("./windows/main-window");
      const { initDatabase } = require("./services/db/database");
      const appPaths = require("./services/app-paths");

      // Initialise SQLite database
      try {
        initDatabase(appPaths.getDataDir());
      } catch (err) {
        log.error("database init failed", { error: String(err.message || err) });
      }

      registerIpcHandlers();
      resolve({ createMainWindow });
    });
  });
}

async function bootstrap() {
  const bootstrapStartedAt = log.enter("bootstrap");

  const handlersStartedAt = log.enter("registerSplashHandlers");
  registerSplashHandlers();
  log.exit("registerSplashHandlers", handlersStartedAt);

  const splashCreateStartedAt = log.enter("createSplashWindow");
  const splash = createSplashWindow();
  log.exit("createSplashWindow", splashCreateStartedAt);

  if (!splash.isDestroyed()) {
    splash.show();
    log.mark("splash.show");
  }

  await yieldToEventLoop();
  sendSplashStatus(splash, "Starting…");
  log.mark('sendSplashStatus "Starting…"');

  sendSplashStatus(splash, "Preparing…");
  log.mark('sendSplashStatus "Preparing…"');

  const heavyStartedAt = log.enter("loadHeavyModules");
  const { createMainWindow } = await loadHeavyModules();
  log.exit("loadHeavyModules", heavyStartedAt);

  const main = createMainWindow();

  sendSplashStatus(splash, "Loading menu…");
  log.mark('sendSplashStatus "Loading menu…"');

  const mainLoadStartedAt = log.enter("waitForWebContentsLoad(main)");
  await waitForWebContentsLoad(main);
  log.exit("waitForWebContentsLoad(main)", mainLoadStartedAt);

  if (!splash.isDestroyed()) {
    splash.close();
    log.mark("splash.close");
  }

  if (!main.isDestroyed()) {
    main.maximize();
    main.show();
    main.focus();
    log.mark("main.maximize + show + focus");
  }

  log.exit("bootstrap", bootstrapStartedAt, { outcome: "success" });
}

app.whenReady().then(() => {
  log.mark("app.whenReady");
  Menu.setApplicationMenu(null);

  process.on("uncaughtException", (err) => {
    log.error("uncaughtException", { error: String(err.message || err), stack: err.stack });
  });

  process.on("unhandledRejection", (reason) => {
    log.error("unhandledRejection", {
      error: reason instanceof Error ? reason.message : String(reason),
    });
  });

  bootstrap();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      bootstrap();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
