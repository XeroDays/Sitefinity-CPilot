const { BrowserWindow, ipcMain } = require("electron");
const channels = require("../../shared/ipc/channels");
const settingsStore = require("../services/settings-store");
const { ipc: log } = require("../services/app-logger");

// Import new handler modules
const { registerConnectionHandlers } = require("./connection-handlers");
const { registerJsonHandlers }       = require("./json-handlers");
const { registerSyncHandlers }       = require("./sync-handlers");
const { registerConfigHandlers }     = require("./config-handlers");
const { registerHistoryHandlers }    = require("./history-handlers");
const licenseService = require("../services/license-service");

let ipcHandlersRegistered = false;

function wrapIpcHandler(channelName, handler) {
  return async (event, ...args) => {
    const startedAt = log.enter(channelName);
    try {
      const result = await handler(event, ...args);
      log.exit(channelName, startedAt);
      return result;
    } catch (err) {
      log.error(`${channelName} failed`, { error: String(err.message || err) });
      log.exit(channelName, startedAt, { error: String(err.message || err) });
      throw err;
    }
  };
}

function registerIpcHandlers() {
  if (ipcHandlersRegistered) return;
  ipcHandlersRegistered = true;

  // ── Core ─────────────────────────────────────────────────────────────────
  ipcMain.handle(channels.PING, async () => "pong");

  ipcMain.handle(channels.OPEN_DEVTOOLS, (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (win) win.webContents.openDevTools({ mode: "detach" });
  });

  ipcMain.handle(channels.WINDOW_MINIMIZE, (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (win) win.minimize();
    return { ok: true };
  });

  ipcMain.handle(channels.WINDOW_MAXIMIZE, (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (!win) return { ok: false };
    if (win.isMaximized()) {
      win.unmaximize();
    } else {
      win.maximize();
    }
    return { ok: true, maximized: win.isMaximized() };
  });

  ipcMain.handle(channels.WINDOW_CLOSE, (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (win) win.close();
    return { ok: true };
  });

  ipcMain.handle(channels.WINDOW_IS_MAXIMIZED, (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    return win ? win.isMaximized() : false;
  });

  ipcMain.handle(channels.GET_SETTINGS, async () => {
    return settingsStore.getPublicSettings();
  });

  ipcMain.handle(channels.SAVE_SETTINGS, wrapIpcHandler("SAVE_SETTINGS", async (_event, patch) => {
    settingsStore.saveSettings(patch);
    return settingsStore.getPublicSettings();
  }));

  ipcMain.handle(channels.GET_LICENSE_UPDATE, async () => {
    return licenseService.getCachedUpdate();
  });

  ipcMain.handle(channels.DOWNLOAD_UPDATE, wrapIpcHandler("DOWNLOAD_UPDATE", async (event, downloadUrl, filename) => {
    return licenseService.downloadUpdate(downloadUrl, filename, event.sender);
  }));

  ipcMain.handle(channels.INSTALL_UPDATE, wrapIpcHandler("INSTALL_UPDATE", async (_event, filename) => {
    return licenseService.installUpdate(filename);
  }));

  ipcMain.handle(channels.CHECK_UPDATE_FILE, async (_event, filename) => {
    return licenseService.checkUpdateFile(filename);
  });

  // ── Domain handlers ───────────────────────────────────────────────────────
  registerConnectionHandlers();
  registerJsonHandlers();
  registerSyncHandlers();
  registerConfigHandlers();
  registerHistoryHandlers();
}

module.exports = { registerIpcHandlers };
