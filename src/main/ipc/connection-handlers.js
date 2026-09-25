/**
 * connection-handlers.js — IPC handlers for Sitefinity connection management.
 *
 * Channels:
 *   cpilot:test-connection  — validate endpoint and retrieve module info
 *   cpilot:fetch-module     — fetch all records for comparison engine
 *   cpilot:list-connections — list saved connections
 *   cpilot:save-connection  — create/update a saved connection
 *   cpilot:delete-connection
 */

"use strict";

const { ipcMain }         = require("electron");
const channels            = require("../../shared/ipc/channels");
const sfClient            = require("../services/sitefinity-client");
const configRepo          = require("../services/db/config-repository");
const { ipc: log }        = require("../services/app-logger");

// ── Register ───────────────────────────────────────────────────────────────
function registerConnectionHandlers() {

  // ── Test Connection ────────────────────────────────────────────────────
  ipcMain.handle(channels.TEST_CONNECTION, async (_event, opts) => {
    log.enter("TEST_CONNECTION");
    try {
      const result = await sfClient.testConnection({
        apiEndpoint: opts.apiEndpoint,
        baseUrl:     opts.baseUrl || opts.apiEndpoint,
        authType:    opts.authType || "none",
        username:    opts.username || "",
        password:    opts.password || "",
        cookie:      opts.cookie || "",
        accessKey:   opts.accessKey || "",
      });
      return result;
    } catch (err) {
      log.error("TEST_CONNECTION", { error: err.message });
      return { ok: false, error: err.message };
    }
  });

  // ── Fetch Module (all pages) ───────────────────────────────────────────
  ipcMain.handle(channels.FETCH_MODULE, async (event, opts) => {
    log.enter("FETCH_MODULE");
    try {
      const result = await sfClient.fetchAllRecords({
        apiEndpoint: opts.apiEndpoint,
        baseUrl:     opts.baseUrl || opts.apiEndpoint,
        authType:    opts.authType || "none",
        username:    opts.username || "",
        password:    opts.password || "",
        cookie:      opts.cookie || "",
        accessKey:   opts.accessKey || "",
        pageSize:    opts.pageSize || 100,
      }, function (progress) {
        // Push progress to renderer
        if (!event.sender.isDestroyed()) {
          event.sender.send(channels.SYNC_PROGRESS, { type: "fetch-progress", ...progress });
        }
      });
      return { ok: true, records: result.records, total: result.total };
    } catch (err) {
      log.error("FETCH_MODULE", { error: err.message });
      return { ok: false, error: err.message };
    }
  });

  // ── List Connections ───────────────────────────────────────────────────
  ipcMain.handle(channels.LIST_CONNECTIONS, async () => {
    try {
      return { ok: true, connections: configRepo.listConnections() };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  });

  // ── Save Connection ────────────────────────────────────────────────────
  // Persists name, endpoint, and auth type only — never passwords, access keys,
  // cookies, or other secrets. Callers may still send those fields; they are ignored.
  ipcMain.handle(channels.SAVE_CONNECTION, async (_event, data) => {
    try {
      const saved = configRepo.saveConnection({
        id:          data.id,
        name:        data.name,
        baseUrl:     data.baseUrl,
        apiEndpoint: data.apiEndpoint,
        authType:    data.authType || "none",
      });
      return { ok: true, connection: saved };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  });

  // ── Delete Connection ──────────────────────────────────────────────────
  ipcMain.handle(channels.DELETE_CONNECTION, async (_event, id) => {
    try {
      configRepo.deleteConnection(id);
      return { ok: true };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  });
}

module.exports = { registerConnectionHandlers };
