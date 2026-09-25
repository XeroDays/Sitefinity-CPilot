const { contextBridge, ipcRenderer } = require("electron");

const CH = {
  // ── Core ──────────────────────────────────────────────────────────────────
  PING:                  "cpilot:ping",
  OPEN_DEVTOOLS:         "cpilot:open-devtools",
  GET_APP_INFO:          "cpilot:get-app-info",
  OPEN_EXTERNAL_URL:     "cpilot:open-external-url",
  GET_SETTINGS:          "cpilot:get-settings",
  SAVE_SETTINGS:         "cpilot:save-settings",
  SPLASH_LOG:            "cpilot:splash-log",
  QUIT_APP:              "cpilot:quit-app",
  WINDOW_MINIMIZE:       "cpilot:window-minimize",
  WINDOW_MAXIMIZE:       "cpilot:window-maximize",
  WINDOW_CLOSE:          "cpilot:window-close",
  WINDOW_IS_MAXIMIZED:   "cpilot:window-is-maximized",

  // ── File I/O ──────────────────────────────────────────────────────────────
  OPEN_JSON_FILE:        "cpilot:open-json-file",
  SAVE_REPORT_FILE:      "cpilot:save-report-file",

  // ── Connection ────────────────────────────────────────────────────────────
  TEST_CONNECTION:       "cpilot:test-connection",
  FETCH_MODULE:          "cpilot:fetch-module",

  // ── JSON ──────────────────────────────────────────────────────────────────
  PARSE_JSON:            "cpilot:parse-json",
  GET_FIELD_SUGGESTIONS: "cpilot:get-field-suggestions",

  // ── Sync ──────────────────────────────────────────────────────────────────
  COMPARE_DATA:          "cpilot:compare-data",
  EXECUTE_SYNC:          "cpilot:execute-sync",
  CANCEL_SYNC:           "cpilot:cancel-sync",
  SYNC_PROGRESS:         "cpilot:sync-progress",

  // ── Saved Connections ─────────────────────────────────────────────────────
  LIST_CONNECTIONS:      "cpilot:list-connections",
  SAVE_CONNECTION:       "cpilot:save-connection",
  DELETE_CONNECTION:     "cpilot:delete-connection",

  // ── Saved Configurations ──────────────────────────────────────────────────
  LIST_CONFIGS:          "cpilot:list-configs",
  GET_CONFIG:            "cpilot:get-config",
  SAVE_CONFIG:           "cpilot:save-config",
  DELETE_CONFIG:         "cpilot:delete-config",

  // ── Operation History ─────────────────────────────────────────────────────
  LIST_OPERATIONS:       "cpilot:list-operations",
  GET_OPERATION:         "cpilot:get-operation",
  GET_OPERATION_ITEMS:   "cpilot:get-operation-items",
  GET_DASHBOARD_STATS:   "cpilot:get-dashboard-stats",
};

contextBridge.exposeInMainWorld("cpilot", {
  // ── Core ──────────────────────────────────────────────────────────────────
  ping:            () => ipcRenderer.invoke(CH.PING),
  openDevTools:    () => ipcRenderer.invoke(CH.OPEN_DEVTOOLS),
  getAppInfo:      () => ipcRenderer.invoke(CH.GET_APP_INFO),
  openExternalUrl: (url) => ipcRenderer.invoke(CH.OPEN_EXTERNAL_URL, url),
  getSettings:     () => ipcRenderer.invoke(CH.GET_SETTINGS),
  saveSettings:    (patch) => ipcRenderer.invoke(CH.SAVE_SETTINGS, patch),
  log(level, namespace, message, meta) {
    ipcRenderer.send(CH.SPLASH_LOG, { level, namespace, message, meta });
  },
  quitApp:         () => ipcRenderer.invoke(CH.QUIT_APP),
  minimizeWindow:  () => ipcRenderer.invoke(CH.WINDOW_MINIMIZE),
  maximizeWindow:  () => ipcRenderer.invoke(CH.WINDOW_MAXIMIZE),
  closeWindow:     () => ipcRenderer.invoke(CH.WINDOW_CLOSE),
  isWindowMaximized: () => ipcRenderer.invoke(CH.WINDOW_IS_MAXIMIZED),

  // ── File I/O ──────────────────────────────────────────────────────────────
  openJsonFile:    () => ipcRenderer.invoke(CH.OPEN_JSON_FILE),
  saveReportFile:  (opts) => ipcRenderer.invoke(CH.SAVE_REPORT_FILE, opts),

  // ── Connection ────────────────────────────────────────────────────────────
  testConnection:   (opts)   => ipcRenderer.invoke(CH.TEST_CONNECTION, opts),
  fetchModule:      (opts)   => ipcRenderer.invoke(CH.FETCH_MODULE, opts),

  // ── JSON ──────────────────────────────────────────────────────────────────
  parseJson:           (opts) => ipcRenderer.invoke(CH.PARSE_JSON, opts),
  getFieldSuggestions: (opts) => ipcRenderer.invoke(CH.GET_FIELD_SUGGESTIONS, opts),

  // ── Sync ──────────────────────────────────────────────────────────────────
  compareData:    (opts) => ipcRenderer.invoke(CH.COMPARE_DATA, opts),
  executeSync:    (opts) => ipcRenderer.invoke(CH.EXECUTE_SYNC, opts),
  cancelSync:     ()     => ipcRenderer.invoke(CH.CANCEL_SYNC),

  // ── SYNC_PROGRESS push listener ───────────────────────────────────────────
  onSyncProgress: (callback) => {
    const wrapped = (_event, data) => callback(data);
    ipcRenderer.on(CH.SYNC_PROGRESS, wrapped);
    return wrapped; // return so caller can unsubscribe
  },
  offSyncProgress: (wrapped) => {
    ipcRenderer.removeListener(CH.SYNC_PROGRESS, wrapped);
  },

  // ── Saved Connections ─────────────────────────────────────────────────────
  listConnections:   ()       => ipcRenderer.invoke(CH.LIST_CONNECTIONS),
  saveConnection:    (data)   => ipcRenderer.invoke(CH.SAVE_CONNECTION, data),
  deleteConnection:  (id)     => ipcRenderer.invoke(CH.DELETE_CONNECTION, id),

  // ── Saved Configurations ──────────────────────────────────────────────────
  listConfigs:    ()       => ipcRenderer.invoke(CH.LIST_CONFIGS),
  getConfig:      (id)     => ipcRenderer.invoke(CH.GET_CONFIG, id),
  saveConfig:     (data)   => ipcRenderer.invoke(CH.SAVE_CONFIG, data),
  deleteConfig:   (id)     => ipcRenderer.invoke(CH.DELETE_CONFIG, id),

  // ── Operation History ─────────────────────────────────────────────────────
  listOperations:      (opts) => ipcRenderer.invoke(CH.LIST_OPERATIONS, opts),
  getOperation:        (id)   => ipcRenderer.invoke(CH.GET_OPERATION, id),
  getOperationItems:   (id)   => ipcRenderer.invoke(CH.GET_OPERATION_ITEMS, id),
  getDashboardStats:   ()     => ipcRenderer.invoke(CH.GET_DASHBOARD_STATS),
});
