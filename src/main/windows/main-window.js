const { BrowserWindow, nativeImage } = require("electron");
const path = require("path");
const { startup: log } = require("../services/app-logger");

function getAppIcon() {
  const iconFile = process.platform === "win32" ? "icon.ico" : "icon.png";
  const iconPath = path.resolve(__dirname, "../../../build", iconFile);
  const icon = nativeImage.createFromPath(iconPath);
  return icon.isEmpty() ? null : icon;
}

function createMainWindow() {
  const startedAt = log.enter("createMainWindow");
  const icon = getAppIcon();
  const indexHtml = path.join(__dirname, "../../renderer/index.html");

  const win = new BrowserWindow({
    width: 1100,
    height: 720,
    minWidth: 880,
    minHeight: 560,
    ...(icon && { icon }),
    frame: false,
    backgroundColor: "#0b0b0d",
    autoHideMenuBar: true,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, "../../preload/index.js"),
      contextIsolation: true,
      // Sitefinity responses omit CORS headers for the file:// page.
      // Requests are issued with fetch in this window so they show in DevTools.
      webSecurity: false,
    },
  });
  win.cpilotIsMain = true;

  if (process.platform === "win32" && icon) {
    win.setIcon(icon);
  }

  win.setMenuBarVisibility(false);
  log.info("loading index.html", { file: indexHtml });
  win.loadFile(indexHtml);
  log.exit("createMainWindow", startedAt);

  return win;
}

module.exports = { createMainWindow };
