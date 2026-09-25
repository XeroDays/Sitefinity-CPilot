/**
 * config-handlers.js — IPC handlers for saved configurations CRUD.
 *
 * Channels:
 *   cpilot:list-configs
 *   cpilot:get-config
 *   cpilot:save-config
 *   cpilot:delete-config
 */

"use strict";

const { ipcMain }  = require("electron");
const channels     = require("../../shared/ipc/channels");
const configRepo   = require("../services/db/config-repository");
const { ipc: log } = require("../services/app-logger");

function registerConfigHandlers() {

  ipcMain.handle(channels.LIST_CONFIGS, async () => {
    try {
      return { ok: true, configs: configRepo.listConfigurations() };
    } catch (err) {
      log.error("LIST_CONFIGS", { error: err.message });
      return { ok: false, error: err.message };
    }
  });

  ipcMain.handle(channels.GET_CONFIG, async (_event, id) => {
    try {
      const cfg = configRepo.getConfiguration(id);
      if (!cfg) return { ok: false, error: "Configuration not found." };
      return { ok: true, config: cfg };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  });

  ipcMain.handle(channels.SAVE_CONFIG, async (_event, data) => {
    try {
      const saved = configRepo.saveConfiguration(data);
      return { ok: true, config: saved };
    } catch (err) {
      log.error("SAVE_CONFIG", { error: err.message });
      return { ok: false, error: err.message };
    }
  });

  ipcMain.handle(channels.DELETE_CONFIG, async (_event, id) => {
    try {
      configRepo.deleteConfiguration(id);
      return { ok: true };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  });
}

module.exports = { registerConfigHandlers };
