const fs = require("fs");
const path = require("path");
const appPaths = require("./app-paths");

const THEMES = ["system", "dark", "light"];

const DEFAULTS = Object.freeze({
    dataDir: "",
    theme: "system",
    reducedMotion: false
});

let cached = null;

function normalize(raw) {
    const input = raw && typeof raw === "object" ? raw : {};
    const theme = THEMES.includes(input.theme) ? input.theme : DEFAULTS.theme;
    return {
        dataDir: typeof input.dataDir === "string" ? input.dataDir.trim() : DEFAULTS.dataDir,
        theme,
        reducedMotion: input.reducedMotion === true
    };
}

function readSettings() {
    if (cached) return { ...cached };
    try {
        const raw = fs.readFileSync(appPaths.settingsFilePath(), "utf8");
        cached = normalize(JSON.parse(raw));
    } catch {
        cached = { ...DEFAULTS };
    }
    return { ...cached };
}

function saveSettings(patch) {
    const next = normalize({ ...readSettings(), ...(patch || {}) });
    const file = appPaths.settingsFilePath();
    appPaths.ensureDir(path.dirname(file));
    fs.writeFileSync(file, JSON.stringify(next, null, 2), "utf8");
    cached = next;
    return { ...next };
}

function getPublicSettings() {
    const settings = readSettings();
    return {
        ...settings,
        effectiveDataDir: appPaths.getDataDir(),
        defaultDataDir: appPaths.getDefaultDataDir()
    };
}

function resetCache() {
    cached = null;
}

module.exports = {
    THEMES,
    DEFAULTS,
    readSettings,
    saveSettings,
    getPublicSettings,
    resetCache,
    normalize
};
