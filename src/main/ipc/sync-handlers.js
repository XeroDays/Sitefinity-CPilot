/**
 * sync-handlers.js — IPC handlers for comparison and execution.
 *
 * Channels:
 *   cpilot:compare-data  — run the comparison engine
 *   cpilot:execute-sync  — execute the synchronisation plan
 *   cpilot:cancel-sync   — cancel an in-progress execution
 */

"use strict";

const { ipcMain }      = require("electron");
const channels         = require("../../shared/ipc/channels");
const sfClient         = require("../services/sitefinity-client");
const compEngine       = require("../services/comparison-engine");
const syncExecutor     = require("../services/sync-executor");
const opRepo           = require("../services/db/operation-repository");
const { ipc: log }     = require("../services/app-logger");
const { decryptPassword } = require("./connection-handlers");

function registerSyncHandlers() {

  // ── Compare ──────────────────────────────────────────────────────────────
  ipcMain.handle(channels.COMPARE_DATA, async (event, opts) => {
    log.enter("COMPARE_DATA");
    try {
      // 1. Fetch existing Sitefinity records
      const fetchResult = await sfClient.fetchAllRecords({
        apiEndpoint: opts.apiEndpoint,
        authType:    opts.authType || "none",
        username:    opts.username || "",
        password:    decryptPassword(opts.encryptedPassword) || opts.password || "",
        cookie:      opts.cookie || "",
        pageSize:    opts.pageSize || 100,
      }, function (progress) {
        if (!event.sender.isDestroyed()) {
          event.sender.send(channels.SYNC_PROGRESS, { type: "fetch-progress", ...progress });
        }
      });

      if (!fetchResult || !Array.isArray(fetchResult.records)) {
        return { ok: false, error: "Failed to fetch Sitefinity records." };
      }

      // 2. Run comparison
      const result = compEngine.compare({
        sourceRecords:   opts.sourceRecords || [],
        existingRecords: fetchResult.records,
        mappings:        opts.mappings || [],
        matchingKey:     opts.matchingKey || "ExternalId",
        syncMode:        opts.syncMode || "upsert",
        deletionEnabled: opts.deletionEnabled || false,
        skipUnchanged:   opts.skipUnchanged !== false,
        caseSensitive:   opts.caseSensitive || false,
      });

      return { ok: true, ...result };
    } catch (err) {
      log.error("COMPARE_DATA", { error: err.message });
      return { ok: false, error: err.message };
    }
  });

  // ── Execute Sync ─────────────────────────────────────────────────────────
  ipcMain.handle(channels.EXECUTE_SYNC, async (event, opts) => {
    log.enter("EXECUTE_SYNC");
    try {
      const result = await syncExecutor.execute(opts, function (progress) {
        if (!event.sender.isDestroyed()) {
          event.sender.send(channels.SYNC_PROGRESS, { type: "exec-progress", ...progress });
        }
      });
      return { ok: true, ...result };
    } catch (err) {
      log.error("EXECUTE_SYNC", { error: err.message });
      return { ok: false, error: err.message };
    }
  });

  // ── Cancel Sync ───────────────────────────────────────────────────────────
  ipcMain.handle(channels.CANCEL_SYNC, async () => {
    syncExecutor.requestCancel();
    return { ok: true };
  });
}

module.exports = { registerSyncHandlers };
