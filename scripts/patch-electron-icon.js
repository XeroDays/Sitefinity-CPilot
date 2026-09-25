const fs = require("node:fs");
const path = require("node:path");

if (process.platform !== "win32") {
  process.exit(0);
}

const iconPath = path.resolve(__dirname, "../build/icon.ico");
if (!fs.existsSync(iconPath)) {
  console.warn("[patch-electron-icon] build/icon.ico not found, skipping");
  process.exit(0);
}

let rcedit;
try {
  rcedit = require("rcedit");
} catch {
  console.warn("[patch-electron-icon] rcedit not installed, skipping");
  process.exit(0);
}

const electronPath = require("electron");

(async () => {
  try {
    await rcedit(electronPath, {
      icon: iconPath,
      "version-string": {
        FileDescription: "Sitefinity C-Pilot",
        ProductName: "Sitefinity C-Pilot",
      },
    });
    console.log("[patch-electron-icon] Applied Sitefinity C-Pilot icon to electron.exe");
  } catch (error) {
    console.warn("[patch-electron-icon] Failed:", error.message);
  }
})();
