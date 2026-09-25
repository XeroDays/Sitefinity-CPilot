const { BrowserWindow, screen, nativeImage } = require("electron");
const path = require("path");
const { splash: log } = require("../services/app-logger");

function getAppIcon() {
  const iconFile = process.platform === "win32" ? "icon.ico" : "icon.png";
  const iconPath = path.resolve(__dirname, "../../../build", iconFile);
  const icon = nativeImage.createFromPath(iconPath);
  return icon.isEmpty() ? null : icon;
}

function createSplashWindow() {
  const startedAt = log.enter("createSplashWindow");
  const { workArea } = screen.getPrimaryDisplay();
  const width = Math.round(workArea.width * 0.448);
  const icon = getAppIcon();
  const splashHtml = path.join(__dirname, "../../renderer/splash.html");

  const win = new BrowserWindow({
    width,
    height: 387,
    useContentSize: true,
    center: true,
    frame: false,
    resizable: false,
    maximizable: false,
    minimizable: false,
    fullscreenable: false,
    show: false,
    backgroundColor: "#0f1419",
    ...(icon && { icon }),
    webPreferences: {
      preload: path.join(__dirname, "../../preload/splash-preload.js"),
      contextIsolation: true,
    },
  });

  if (process.platform === "win32" && icon) {
    win.setIcon(icon);
  }

  log.info("loading splash.html", { width, height: 387, file: splashHtml });
  win.loadFile(splashHtml);
  log.exit("createSplashWindow", startedAt);

  return win;
}

module.exports = { createSplashWindow };
