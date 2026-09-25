const fs = require("fs");
const os = require("os");
const path = require("path");

const SETTINGS_FILENAME = "settings.json";
const DEFAULT_DIR_NAME = "Sitefinity C-Pilot";

let cachedDataDir = null;

function electron() {
    try {
        return require("electron");
    } catch {
        return null;
    }
}

function userDataDir() {
    const fromEnv = typeof process.env.CPILOT_USER_DATA_DIR === "string"
        ? process.env.CPILOT_USER_DATA_DIR.trim()
        : "";
    if (fromEnv) return fromEnv;

    const app = electron()?.app;
    if (app && typeof app.getPath === "function") {
        try {
            return app.getPath("userData");
        } catch {
            // fall through to the tmp fallback below
        }
    }
    return path.join(os.tmpdir(), "cpilot-userdata");
}

function documentsDir() {
    const app = electron()?.app;
    if (app && typeof app.getPath === "function") {
        try {
            return app.getPath("documents");
        } catch {
            // fall through
        }
    }
    return path.join(os.homedir(), "Documents");
}

function settingsFilePath() {
    return path.join(userDataDir(), SETTINGS_FILENAME);
}

function readDataDirFromSettings() {
    try {
        const raw = fs.readFileSync(settingsFilePath(), "utf8");
        const parsed = JSON.parse(raw);
        const dir = parsed && typeof parsed.dataDir === "string" ? parsed.dataDir.trim() : "";
        return dir || null;
    } catch {
        return null;
    }
}

/**
 * Root folder for Sitefinity C-Pilot user data.
 *
 * Precedence: `CPILOT_DATA_DIR` env -> `dataDir` in settings.json ->
 * `Documents/Sitefinity C-Pilot`. Resolved once per process.
 */
function getDataDir() {
    if (cachedDataDir) return cachedDataDir;

    const fromEnv = typeof process.env.CPILOT_DATA_DIR === "string"
        ? process.env.CPILOT_DATA_DIR.trim()
        : "";
    const resolved = fromEnv
        || readDataDirFromSettings()
        || path.join(documentsDir(), DEFAULT_DIR_NAME);

    cachedDataDir = resolved;
    return cachedDataDir;
}

function getDefaultDataDir() {
    return path.join(documentsDir(), DEFAULT_DIR_NAME);
}

function ensureDir(dirPath) {
    if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
    }
    return dirPath;
}

function dataPath(...segments) {
    const full = path.join(getDataDir(), ...segments);
    ensureDir(path.dirname(full));
    return full;
}

function subDir(name) {
    return ensureDir(path.join(getDataDir(), name));
}

function resetCache() {
    cachedDataDir = null;
}

module.exports = {
    SETTINGS_FILENAME,
    DEFAULT_DIR_NAME,
    getDataDir,
    getDefaultDataDir,
    settingsFilePath,
    userDataDir,
    documentsDir,
    ensureDir,
    dataPath,
    subDir,
    resetCache
};
