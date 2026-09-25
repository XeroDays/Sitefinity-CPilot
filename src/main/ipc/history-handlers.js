/**
 * history-handlers.js — IPC handlers for operation history.
 *
 * Channels:
 *   cpilot:list-operations
 *   cpilot:get-operation
 *   cpilot:get-operation-items
 *   cpilot:get-dashboard-stats
 */

"use strict";

const { ipcMain }  = require("electron");
const channels     = require("../../shared/ipc/channels");
const opRepo       = require("../services/db/operation-repository");
const { ipc: log } = require("../services/app-logger");

function registerHistoryHandlers() {

  ipcMain.handle(channels.LIST_OPERATIONS, async (_event, opts) => {
    try {
      const ops = opRepo.listOperations(opts || {});
      return { ok: true, operations: ops };
    } catch (err) {
      log.error("LIST_OPERATIONS", { error: err.message });
      return { ok: false, error: err.message };
    }
  });

  ipcMain.handle(channels.GET_OPERATION, async (_event, id) => {
    try {
      const op = opRepo.getOperation(id);
      return { ok: !!op, operation: op };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  });

  ipcMain.handle(channels.GET_OPERATION_ITEMS, async (_event, operationId) => {
    try {
      const items = opRepo.getOperationItems(operationId);
      return { ok: true, items };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  });

  ipcMain.handle(channels.GET_DASHBOARD_STATS, async () => {
    try {
      const stats = opRepo.getDashboardStats();
      return { ok: true, ...stats };
    } catch (err) {
      log.error("GET_DASHBOARD_STATS", { error: err.message });
      return { ok: false, error: err.message, totalOperations: 0, successful: 0, failed: 0, totalCreated: 0, totalUpdated: 0, totalDeleted: 0, recentOperations: [] };
    }
  });
}

module.exports = { registerHistoryHandlers };
