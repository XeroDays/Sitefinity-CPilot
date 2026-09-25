const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const testsDir = __dirname;
const projectRoot = path.join(__dirname, "..");

function collectTests() {
    const dir = path.join(testsDir, "unit");
    if (!fs.existsSync(dir)) return [];
    return fs.readdirSync(dir)
        .filter((name) => name.endsWith(".test.js"))
        .sort()
        .map((name) => ({ label: `unit/${name}`, file: path.join(dir, name) }));
}

function runNodeTests(tests) {
    let failed = false;
    for (const test of tests) {
        console.log(`\n=== ${test.label} ===`);
        const result = spawnSync(process.execPath, [test.file], {
            stdio: "inherit",
            cwd: projectRoot,
            env: process.env
        });
        if (result.status !== 0) {
            failed = true;
        }
    }
    return failed;
}

const tests = collectTests();

if (tests.length === 0) {
    console.error("No *.test.js files found under tests/unit/");
    process.exit(1);
}

if (runNodeTests(tests)) {
    console.error("\nSome tests failed.");
    process.exit(1);
}

console.log("\nAll tests passed.");
