/** IPC channel names — keep in sync with src/preload/index.js and src/preload/splash-preload.js. */
module.exports = {
  // ── Core ──────────────────────────────────────────────────────────────────
  PING:                   "cpilot:ping",
  OPEN_DEVTOOLS:          "cpilot:open-devtools",
  GET_APP_INFO:           "cpilot:get-app-info",
  OPEN_EXTERNAL_URL:      "cpilot:open-external-url",
  GET_SETTINGS:           "cpilot:get-settings",
  SAVE_SETTINGS:          "cpilot:save-settings",
  SPLASH_STATUS:          "cpilot:splash-status",
  SPLASH_LOG:             "cpilot:splash-log",
  QUIT_APP:               "cpilot:quit-app",
  WINDOW_MINIMIZE:        "cpilot:window-minimize",
  WINDOW_MAXIMIZE:        "cpilot:window-maximize",
  WINDOW_CLOSE:           "cpilot:window-close",
  WINDOW_IS_MAXIMIZED:    "cpilot:window-is-maximized",

  // ── File I/O ──────────────────────────────────────────────────────────────
  OPEN_JSON_FILE:         "cpilot:open-json-file",
  SAVE_REPORT_FILE:       "cpilot:save-report-file",

  // ── Sitefinity Connection ──────────────────────────────────────────────────
  TEST_CONNECTION:        "cpilot:test-connection",
  FETCH_MODULE:           "cpilot:fetch-module",

  // ── JSON Parsing ──────────────────────────────────────────────────────────
  PARSE_JSON:             "cpilot:parse-json",
  GET_FIELD_SUGGESTIONS:  "cpilot:get-field-suggestions",

  // ── Sync ──────────────────────────────────────────────────────────────────
  COMPARE_DATA:           "cpilot:compare-data",
  EXECUTE_SYNC:           "cpilot:execute-sync",
  CANCEL_SYNC:            "cpilot:cancel-sync",
  SYNC_PROGRESS:          "cpilot:sync-progress",   // main → renderer push
  RENDERER_FETCH:         "cpilot:renderer-fetch",  // main → renderer
  RENDERER_FETCH_RESULT:  "cpilot:renderer-fetch-result", // renderer → main

  // ── Saved Sitefinity Connections ──────────────────────────────────────────
  LIST_CONNECTIONS:       "cpilot:list-connections",
  SAVE_CONNECTION:        "cpilot:save-connection",
  DELETE_CONNECTION:      "cpilot:delete-connection",

  // ── Saved Sync Configurations ─────────────────────────────────────────────
  LIST_CONFIGS:           "cpilot:list-configs",
  GET_CONFIG:             "cpilot:get-config",
  SAVE_CONFIG:            "cpilot:save-config",
  DELETE_CONFIG:          "cpilot:delete-config",

  // ── Operation History ─────────────────────────────────────────────────────
  LIST_OPERATIONS:        "cpilot:list-operations",
  GET_OPERATION:          "cpilot:get-operation",
  GET_OPERATION_ITEMS:    "cpilot:get-operation-items",
  GET_DASHBOARD_STATS:    "cpilot:get-dashboard-stats",
};
