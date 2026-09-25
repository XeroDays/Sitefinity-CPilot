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
    assert("fallback ends with Sitefinity CPilot", path.basename(fallback) === "Sitefinity CPilot");
    assert("fallback matches getDefaultDataDir", fallback === appPaths.getDefaultDataDir());
    assert(
        "settings.json lives in the data dir",
        appPaths.settingsFilePath() === path.join(fallback, "settings.json")
    );

    const migRoot = path.join(tmpRoot, "migrate");
    const docs = path.join(migRoot, "Documents");
    const legacy = path.join(docs, "Sitefinity C-Pilot");
    const target = path.join(migRoot, "Sitefinity CPilot");
    const legacySettings = path.join(tmpRoot, "userdata", "settings.json");
    fs.mkdirSync(path.join(legacy, "db"), { recursive: true });
    fs.writeFileSync(path.join(legacy, "db", "cpilot.db"), "legacy-db");
    fs.mkdirSync(path.join(legacy, "Logs"), { recursive: true });
    fs.writeFileSync(path.join(legacy, "Logs", "dump.log"), "legacy-log");
    fs.mkdirSync(path.dirname(legacySettings), { recursive: true });
    fs.writeFileSync(legacySettings, "{\"theme\":\"dark\"}");
    fs.mkdirSync(path.join(target, "db"), { recursive: true });
    fs.writeFileSync(path.join(target, "db", "cpilot.db"), "existing-db");

    appPaths.migrateLegacyData({
        documentsDir: docs,
        targetDir: target,
        legacySettingsFile: legacySettings
    });

    assert(
        "does not overwrite an existing database",
        fs.readFileSync(path.join(target, "db", "cpilot.db"), "utf8") === "existing-db"
    );
    assert(
        "copies a missing log",
        fs.readFileSync(path.join(target, "Logs", "dump.log"), "utf8") === "legacy-log"
    );
    assert(
        "copies settings when the new file is missing",
        fs.readFileSync(path.join(target, "settings.json"), "utf8") === "{\"theme\":\"dark\"}"
    );

    fs.writeFileSync(path.join(target, "settings.json"), "{\"theme\":\"light\"}");
    appPaths.migrateLegacyData({
        documentsDir: docs,
        targetDir: target,
        legacySettingsFile: legacySettings
    });
    assert(
        "does not overwrite existing settings",
        fs.readFileSync(path.join(target, "settings.json"), "utf8") === "{\"theme\":\"light\"}"
    );

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
