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
    const denied = options.denied === true;
    splash.webContents.send(channels.SPLASH_STATUS, { text, loading, denied });
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

      try {
        appPaths.migrateLegacyData();
      } catch (err) {
        log.error("legacy data migration failed", { error: String(err.message || err) });
      }

      // Initialise SQLite database
      try {
        initDatabase(appPaths.getDataDir());
      } catch (err) {
        log.error("database init failed", { error: String(err.message || err) });
        const { dialog } = require("electron");
        dialog.showErrorBox(
          "Database failed to initialise",
          "The native database module could not be loaded. " +
          "This is usually caused by an ABI mismatch after npm install.\n\n" +
          "Fix: run  npm run rebuild  in the project root, then restart the app.\n\n" +
          "Details: " + String(err.message || err)
        );
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

  const licenseService = require("./services/license-service");
  const prefetchPromise = licenseService.prefetchRegistrationData();

  sendSplashStatus(splash, "Preparing…");
  log.mark('sendSplashStatus "Preparing…"');

  const heavyStartedAt = log.enter("loadHeavyModules");
  const { createMainWindow } = await loadHeavyModules();
  log.exit("loadHeavyModules", heavyStartedAt);

  const main = createMainWindow();

  sendSplashStatus(splash, "Checking for updates…");
  log.mark('sendSplashStatus "Checking for updates…"');

  const [licenseResult] = await Promise.all([
    (async () => {
      await prefetchPromise;
      const registerStartedAt = log.enter("licenseService.register");
      const result = await licenseService.register();
      log.exit("licenseService.register", registerStartedAt, {
        accessGranted: result.accessGranted,
        fromCache: result.fromCache,
        updateAvailable: result.updateAvailable,
        localBuild: result.localBuild,
        remoteBuild: result.remoteBuild,
        forceUpdate: result.forceUpdate,
      });
      return result;
    })(),
    waitForWebContentsLoad(main),
  ]);

  if (!licenseResult.accessGranted) {
    log.warn("access denied — staying on splash", {
      fromCache: licenseResult.fromCache,
      error: licenseResult.error || null,
    });
    sendSplashStatus(splash, "Access denied, please contact customer service.", {
      loading: false,
      denied: true,
    });
    if (!main.isDestroyed()) main.destroy();
    log.exit("bootstrap", bootstrapStartedAt, { outcome: "access-denied" });
    return;
  }

  sendSplashStatus(splash, "Loading menu…");
  log.mark('sendSplashStatus "Loading menu…"');

  if (!main.isDestroyed() && main.webContents && !main.webContents.isDestroyed()) {
    main.webContents.send(channels.LICENSE_UPDATE, licenseResult);
  }

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
