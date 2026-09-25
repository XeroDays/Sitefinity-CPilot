const fs = require("fs");
const path = require("path");
const appPaths = require("./app-paths");

const LOG_DIR_NAME = "Logs";
const LOG_FILE_NAME = "dump.log";
const MAX_BYTES = 1 * 1024 * 1024;

function getLogFilePath() {
  return path.join(appPaths.getDataDir(), LOG_DIR_NAME, LOG_FILE_NAME);
}

function ensureLogDirectory() {
  fs.mkdirSync(path.dirname(getLogFilePath()), { recursive: true });
}

function rotateIfOversized() {
  const logPath = getLogFilePath();
  if (fs.existsSync(logPath) && fs.statSync(logPath).size >= MAX_BYTES) {
    fs.unlinkSync(logPath);
  }
}

function initLogFile() {
  ensureLogDirectory();
  rotateIfOversized();
}

module.exports = {
  getLogFilePath,
  ensureLogDirectory,
  rotateIfOversized,
  initLogFile,
  MAX_BYTES,
};
