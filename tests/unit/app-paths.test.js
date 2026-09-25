const fs = require("fs");
const os = require("os");
const path = require("path");
const { createAssert } = require("../helpers/assert");

const { assert, finish } = createAssert();

const appPathsPath = require.resolve("../../src/main/services/app-paths");

function freshModule() {
    delete require.cache[appPathsPath];
    return require(appPathsPath);
}

const originalEnv = process.env.CPILOT_DATA_DIR;
const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "cpilot-app-paths-"));
process.env.CPILOT_USER_DATA_DIR = path.join(tmpRoot, "userdata");

try {
    const envDir = path.join(tmpRoot, "env-data");
    process.env.CPILOT_DATA_DIR = envDir;
    let appPaths = freshModule();
    assert("env var drives getDataDir", appPaths.getDataDir() === envDir);

    process.env.CPILOT_DATA_DIR = path.join(tmpRoot, "changed");
    assert("data dir is memoised", appPaths.getDataDir() === envDir);

    appPaths.resetCache();
    assert("resetCache re-reads the env", appPaths.getDataDir() === path.join(tmpRoot, "changed"));

    delete process.env.CPILOT_DATA_DIR;
    appPaths = freshModule();
    const fallback = appPaths.getDataDir();
    assert("fallback ends with Sitefinity C-Pilot", path.basename(fallback) === "Sitefinity C-Pilot");
    assert("fallback matches getDefaultDataDir", fallback === appPaths.getDefaultDataDir());

    const settingsFile = appPaths.settingsFilePath();
    const settingsDir = path.join(tmpRoot, "from-settings");
    appPaths.ensureDir(path.dirname(settingsFile));
    fs.writeFileSync(settingsFile, JSON.stringify({ dataDir: settingsDir }), "utf8");
    appPaths.resetCache();
    assert("settings.json dataDir is honoured", appPaths.getDataDir() === settingsDir);

    fs.writeFileSync(settingsFile, JSON.stringify({ dataDir: "   " }), "utf8");
    appPaths.resetCache();
    assert("blank dataDir falls back to default", appPaths.getDataDir() === appPaths.getDefaultDataDir());

    fs.writeFileSync(settingsFile, "{not json", "utf8");
    appPaths.resetCache();
    assert("corrupt settings.json falls back", appPaths.getDataDir() === appPaths.getDefaultDataDir());
    fs.rmSync(settingsFile, { force: true });

    process.env.CPILOT_DATA_DIR = path.join(tmpRoot, "scratch");
    appPaths = freshModule();
    const nested = appPaths.dataPath("Logs", "cpilot.log");
    assert("dataPath creates the parent dir", fs.existsSync(path.dirname(nested)));
    assert("dataPath does not create the file", !fs.existsSync(nested));
    const templates = appPaths.subDir("Templates");
    assert("subDir creates the folder", fs.existsSync(templates));
    assert("subDir returns the path", templates === path.join(tmpRoot, "scratch", "Templates"));
} finally {
    if (typeof originalEnv === "string") {
        process.env.CPILOT_DATA_DIR = originalEnv;
    } else {
        delete process.env.CPILOT_DATA_DIR;
    }
    delete process.env.CPILOT_USER_DATA_DIR;
    fs.rmSync(tmpRoot, { recursive: true, force: true });
}

finish();
