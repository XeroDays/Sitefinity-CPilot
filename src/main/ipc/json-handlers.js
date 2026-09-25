/**
 * json-handlers.js — IPC handlers for JSON parsing and field mapping.
 *
 * Channels:
 *   cpilot:open-json-file    — open OS file dialog and return file contents
 *   cpilot:parse-json        — parse JSON text and return analysis
 *   cpilot:get-field-suggestions — auto-map JSON fields to Sitefinity fields
 *   cpilot:save-report-file  — save export report to disk
 */

"use strict";

const { ipcMain, dialog } = require("electron");
const fs                  = require("fs");
const path                = require("path");
const channels            = require("../../shared/ipc/channels");
const jsonParser          = require("../services/json-parser");
const fieldMapper         = require("../services/field-mapper");
const { ipc: log }        = require("../services/app-logger");

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50 MB

function registerJsonHandlers() {

  // ── Open JSON File ─────────────────────────────────────────────────────
  ipcMain.handle(channels.OPEN_JSON_FILE, async (event) => {
    const { BrowserWindow } = require("electron");
    const win = BrowserWindow.fromWebContents(event.sender);

    const result = await dialog.showOpenDialog(win, {
      title: "Select JSON File",
      filters: [{ name: "JSON Files", extensions: ["json"] }],
      properties: ["openFile"],
    });

    if (result.canceled || result.filePaths.length === 0) {
      return { canceled: true };
    }

    const filePath = result.filePaths[0];

    try {
      const stats = fs.statSync(filePath);
      if (stats.size > MAX_FILE_SIZE) {
        return { ok: false, error: "File is too large (max 50 MB)." };
      }
      const text = fs.readFileSync(filePath, "utf8");
      return { ok: true, text, fileName: path.basename(filePath), filePath };
    } catch (err) {
      return { ok: false, error: "Could not read file: " + err.message };
    }
  });

  // ── Parse JSON ─────────────────────────────────────────────────────────
  ipcMain.handle(channels.PARSE_JSON, (_event, opts) => {
    log.enter("PARSE_JSON");
    try {
      const result = jsonParser.parseJson(opts.text, opts.recordPath);
      return result;
    } catch (err) {
      log.error("PARSE_JSON", { error: err.message });
      return { ok: false, error: err.message };
    }
  });

  // ── Get Field Suggestions (auto-map) ───────────────────────────────────
  ipcMain.handle(channels.GET_FIELD_SUGGESTIONS, (_event, opts) => {
    log.enter("GET_FIELD_SUGGESTIONS");
    try {
      // opts: { sitefinityFields: [{name, type}], jsonFields: [{name, type}] }
      const mappings = fieldMapper.autoMap(opts.sitefinityFields || [], opts.jsonFields || []);
      const issues   = fieldMapper.validateMappings(mappings, opts.matchingKey || "ExternalId");
      return { ok: true, mappings, issues };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  });

  // ── Save Report File ───────────────────────────────────────────────────
  ipcMain.handle(channels.SAVE_REPORT_FILE, async (event, opts) => {
    const { BrowserWindow } = require("electron");
    const win = BrowserWindow.fromWebContents(event.sender);

    const ext  = opts.format === "csv" ? "csv" : "json";
    const name = (opts.fileName || "operation-report") + "." + ext;

    const result = await dialog.showSaveDialog(win, {
      title: "Save Report",
      defaultPath: name,
      filters: [
        ext === "csv"
          ? { name: "CSV Files", extensions: ["csv"] }
          : { name: "JSON Files", extensions: ["json"] },
      ],
    });

    if (result.canceled || !result.filePath) {
      return { canceled: true };
    }

    try {
      fs.writeFileSync(result.filePath, opts.content, "utf8");
      return { ok: true, filePath: result.filePath };
    } catch (err) {
      return { ok: false, error: "Could not save file: " + err.message };
    }
  });
}

module.exports = { registerJsonHandlers };
