const fs = require("fs");
const os = require("os");
const path = require("path");

const SETTINGS_FILENAME = "settings.json";
const DEFAULT_DIR_NAME = "Sitefinity CPilot";
const LEGACY_DIR_NAME = "Sitefinity C-Pilot";
const LEGACY_SUBDIRS = ["db", "Logs"];

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
    return path.join(getDataDir(), SETTINGS_FILENAME);
}

/**
 * Root folder for Sitefinity C-Pilot user data.
 *
 * Precedence: `CPILOT_DATA_DIR` env, otherwise `Documents/Sitefinity CPilot`.
 * Resolved once per process.
 */
function getDataDir() {
    if (cachedDataDir) return cachedDataDir;

    const fromEnv = typeof process.env.CPILOT_DATA_DIR === "string"
        ? process.env.CPILOT_DATA_DIR.trim()
        : "";
    cachedDataDir = fromEnv || path.join(documentsDir(), DEFAULT_DIR_NAME);
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

/**
 * Copy a file tree into destDir. Existing destination files are left untouched.
 */
function copyMissingTree(sourceDir, destDir) {
    if (!fs.existsSync(sourceDir)) return;
    ensureDir(destDir);
    fs.readdirSync(sourceDir, { withFileTypes: true }).forEach(function (entry) {
        const from = path.join(sourceDir, entry.name);
        const to = path.join(destDir, entry.name);
        if (entry.isDirectory()) {
            copyMissingTree(from, to);
        } else if (entry.isFile() && !fs.existsSync(to)) {
            fs.copyFileSync(from, to);
        }
    });
}

/**
 * Copy database, logs, and settings from the previous layout when the new
 * files are missing. Old folders are left in place.
 *
 * @param {{ documentsDir?: string, targetDir?: string, legacySettingsFile?: string }} [options]
 */
function migrateLegacyData(options) {
    const opts = options || {};
    const docs = opts.documentsDir || documentsDir();
    const target = opts.targetDir || getDataDir();
    const legacyRoot = path.join(docs, LEGACY_DIR_NAME);

    if (fs.existsSync(legacyRoot) && path.resolve(legacyRoot) !== path.resolve(target)) {
        LEGACY_SUBDIRS.forEach(function (name) {
            copyMissingTree(path.join(legacyRoot, name), path.join(target, name));
        });
    }

    const legacySettings = opts.legacySettingsFile || path.join(userDataDir(), SETTINGS_FILENAME);
    const newSettings = path.join(target, SETTINGS_FILENAME);
    if (fs.existsSync(legacySettings) && !fs.existsSync(newSettings)) {
        ensureDir(path.dirname(newSettings));
        fs.copyFileSync(legacySettings, newSettings);
    }
}

module.exports = {
    SETTINGS_FILENAME,
    DEFAULT_DIR_NAME,
    LEGACY_DIR_NAME,
    getDataDir,
    getDefaultDataDir,
    settingsFilePath,
    userDataDir,
    documentsDir,
    ensureDir,
    dataPath,
    subDir,
    resetCache,
    migrateLegacyData
};
