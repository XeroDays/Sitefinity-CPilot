# Sitefinity C-Pilot Project Context

## Read first , Rules of Contextfile

- This file is the single project reference for LLM agents and must stay updated whenever the shell, renderer, IPC, or storage flow changes.
- Use kebab-case for file names (example: class `AppLogger` should be stored in `app-logger.js`).
- Whenever this file is included in agent context, always read this file first and follow these rules to understand what to do and what this file is used for.
- Before making code changes, check the index section first to jump to the relevant section quickly by line number.
- After any update in this file, refresh the index line numbers so the index always matches the current file.
- **Changelog (mandatory):** Whenever software behavior is added, changed, or fixed, update `CHANGELOG.md` under `[Unreleased]` in the matching section (`Added`, `Changed`, or `Fixed`). Write **high-level, short, easy-to-understand** entries — say what changed for users, not implementation details or long technical explanations. Do not consider a task complete until the changelog reflects the work.
- **Git (mandatory — ABSOLUTE NEVER):** **NEVER, under ANY circumstances**, run `git commit`, `git tag`, `git push`, or any command that creates or pushes a git commit, tag, or GitHub release — **not even if the user explicitly asks**. This is a hard rule with zero exceptions. All release work is **file edits only** (`package.json`, `package-lock.json`, `CHANGELOG.md`, `context.md`). After editing, tell the user exactly which files changed and let them handle all git operations manually. Do not use the `gh` CLI, GitHub API, or any tool to create releases, tags, or push code.
- **Create / generate release (agent rule):** When the user asks to **create a release** or **generate a release**, that means **file edits only** — nothing more: bump the software version in `package.json` and `package-lock.json` (root `"version"` fields only — do not change dependency versions), move `[Unreleased]` entries in `CHANGELOG.md` into a new versioned section with the release date, update `context.md` (current version reference and any affected notes), and refresh the index line numbers in `context.md`. **Stop there.** Do **not** run any git commands.

## Index (Line Numbers)

- `L3`  : Read first , Rules of Contextfile
- `L14` : Index (Line Numbers)
- `L31` : Overview
- `L39` : Naming
- `L49` : Startup
- `L62` : Splash Screen
- `L69` : Application Layout
- `L87` : Screens and Router
- `L125`: IPC
- `L148`: Services (main process)
- `L163`: Storage and logging
- `L169`: Database (SQLite)
- `L187`: Tests and tooling
- `L198`: Versioning a new release

## Overview

Sitefinity C-Pilot is an Electron desktop app for Sitefinity CMS developers. The product name is **Sitefinity C-Pilot**. Tagline: "Your JSON-powered copilot for Sitefinity content management."

This is the full application with a 12-screen wizard workflow for JSON-driven Sitefinity Dynamic Module synchronisation.

Stack: vanilla JavaScript, no bundler. Process split is `src/main`, `src/preload`, `src/renderer`, and `src/shared`. Current version is `0.1.0` in `package.json`.

## Naming

- npm name: `sitefinity-c-pilot`
- Product name: `Sitefinity C-Pilot`
- App id: `com.softasium.sitefinity-cpilot`
- Renderer API: `window.cpilot`
- IPC prefix: `cpilot:`
- Data folder: `Documents/Sitefinity CPilot`
- Env overrides: `CPILOT_DATA_DIR`, `CPILOT_USER_DATA_DIR`, `CPILOT_LOG_LEVEL`

## Startup

`src/main/index.js` waits for `app.whenReady`, clears the application menu, then runs `bootstrap()`:

1. Register splash IPC (`register-splash-handlers.js`).
2. Create and show the frameless splash window.
3. Send splash status **Starting…**, then **Preparing…**.
4. On the next event-loop turn, register the remaining IPC handlers, **initialise the SQLite database**, and create the main window (still hidden).
5. Send splash status **Loading menu…** and wait until the main window finishes loading.
6. Close the splash, then maximize, show, and focus the main window.

There is no license gate. Closing the last window quits the app on Windows.

## Splash Screen

- Window: `src/main/windows/splash-window.js`. Frameless, fixed size, `contextIsolation: true`, preload `src/preload/splash-preload.js`.
- Page: `src/renderer/splash.html`, styles `src/renderer/styles/splash.css`, script `src/renderer/scripts/splash.js`.
- UI: logo, product name, spinner, status text, version label, close button.
- Close calls `window.cpilot.quitApp()`. Version comes from `getAppInfo()`.

## Application Layout

`src/renderer/index.html` is the single-page application shell:

```
.app-layout (flex column, full height)
├── .app-chrome-header   — frameless drag region; brand, breadcrumb, gear menu, window controls
└── .app-body (flex row)
    ├── .sidebar #sidebar        — populated by sidebar.js; left nav
    └── .screen-container #screen-container   — screens render here
```

Styles:
- `src/renderer/styles/app.css`     — base layout, header, sidebar, toast; dark tokens on `:root`, light tokens on `[data-theme="light"]`
- `src/renderer/styles/screens.css` — all screen-specific styles (wizard, forms, tables, badges, etc.)

The gear menu Preferences item opens the Settings screen. That screen shows the theme dropdown (Dark or Light); Apply sets `data-theme` and saves the choice.

## Screens and Router

**Router** (`src/renderer/scripts/router.js`):
- Maintains `window.Screens` registry (each screen exports `{ render(container, params), destroy() }`).
- `window.cpilotRouter.navigateTo(name, params)` — destroys current screen, renders new one, fires `cpilot:routechanged` custom event.
- Navigates to `dashboard` on initial load (last script loaded).
- `window.cpilotRouter.WIZARD_STEPS` — array of wizard step names in order.

**Sidebar** (`src/renderer/scripts/sidebar.js`):
- Listens for `cpilot:routechanged` to update active item.
- Nav items: Dashboard, New Operation, Saved Configurations, Operation History.

**Wizard state** (`src/renderer/scripts/wizard-state.js`):
- `window.wizardState` — in-memory store for the active wizard operation.
- Fields: `connection`, `moduleInfo`, `jsonSource`, `fieldMappings`, `syncSettings`, `comparisonResult`, `selectedRecordIds`, `operationId`, `operationName`, `savedConfigId`.
- Cleared by `window.wizardState.reset()`.

**Wizard progress bar** (`window.buildWizardProgress(activeStepName)` — exported from `connection.js`):
- Renders a 8-step horizontal progress bar at the top of every wizard screen.
- Steps: Connection → JSON Source → Field Mapping → Sync Settings → Comparison → Confirmation → Execution → Results.

**Screens** (in `src/renderer/screens/`):
- `dashboard.js`     — stats cards, quick actions, recent operations table
- `connection.js`    — API endpoint entry, test connection, auth config (None, Basic, Session / Cookie, Access Key), save connection
- `json-source.js`   — file upload / paste, auto-parse, record path selection
- `field-mapping.js` — mapping table with auto-suggestions and manual overrides
- `sync-settings.js` — matching key, sync mode radio cards, deletion config, advanced options
- `comparison.js`    — fetches existing records, runs comparison engine, shows filterable table + detail drawer
- `confirmation.js`  — summary before execution, operation name field
- `execution.js`     — live progress bar, log stream, cancel button
- `results.js`       — summary cards, filterable results table, CSV/JSON export, save config
- `saved-configs.js` — list, run, delete saved configurations
- `history.js`       — operation history table with details link
- `settings.js`      — manage connections, Preferences (Dark / Light theme), data directory

**Script load order** in `index.html`:
`theme.js` → `wizard-state.js` → `toast.js` → `window-controls.js` → `about-modal.js` → all screens → `sidebar.js` → `router.js` (last, triggers initial navigation). `theme.js` sets `data-theme` on the document from saved settings (`light`, otherwise dark, including `system`).

## IPC

Channel names live in `src/shared/ipc/channels.js`. Preload (`src/preload/index.js`) must list the same names. Keep the two files in sync.

**Core**: PING, OPEN_DEVTOOLS, GET_APP_INFO, OPEN_EXTERNAL_URL, GET_SETTINGS, SAVE_SETTINGS, SPLASH_STATUS, SPLASH_LOG, QUIT_APP, window controls.

**File I/O**: OPEN_JSON_FILE (dialog), SAVE_REPORT_FILE (dialog).

**Connection**: TEST_CONNECTION, FETCH_MODULE.

**JSON**: PARSE_JSON, GET_FIELD_SUGGESTIONS.

**Sync**: COMPARE_DATA, EXECUTE_SYNC, CANCEL_SYNC; SYNC_PROGRESS (main→renderer push). RENDERER_FETCH (main→renderer) and RENDERER_FETCH_RESULT (renderer→main) carry each Sitefinity HTTP call. They are not exposed on `window.cpilot`.

**Connections CRUD**: LIST_CONNECTIONS, SAVE_CONNECTION, DELETE_CONNECTION.

**Configurations CRUD**: LIST_CONFIGS, GET_CONFIG, SAVE_CONFIG, DELETE_CONFIG.

**History**: LIST_OPERATIONS, GET_OPERATION, GET_OPERATION_ITEMS, GET_DASHBOARD_STATS.

IPC handlers are registered in `src/main/ipc/register.js` which imports:
- `connection-handlers.js`, `json-handlers.js`, `sync-handlers.js`, `config-handlers.js`, `history-handlers.js`.

## Services (main process)

`src/main/services/`:

| File | Purpose |
|------|---------|
| `sitefinity-client.js`  | Sitefinity HTTP client. Calls run as `fetch` in the main window (so they show in DevTools) after main-process URL checks. Basic auth sends `Authorization`. Cookie auth uses the window session cookie jar. testConnection, fetchAllRecords, createItem, updateItem, deleteItem; OData pagination |
| `json-parser.js`        | Parse, validate, detect root type, infer field types, find duplicates |
| `field-mapper.js`       | autoMap (exact + case-insensitive), applyMappings, getMatchingKeyValue, validateMappings |
| `comparison-engine.js`  | compare() — normalise, index existing, classify each source record, detect missing |
| `sync-executor.js`      | Sequential API execution with IPC progress events; cancel support; DB persistence |
| `app-logger.js`         | electron-log wrapper |
| `app-paths.js`          | Resolves data directory |
| `settings-store.js`     | Reads/writes settings.json |

## Storage and logging

- `src/main/services/app-paths.js` resolves the data directory once per process. Precedence: `CPILOT_DATA_DIR`, otherwise `Documents/Sitefinity CPilot`. On startup, `migrateLegacyData()` copies `db` and `Logs` from `Documents/Sitefinity C-Pilot`, and `settings.json` from the Electron user-data folder, when the new files are missing.
- `src/main/services/settings-store.js` reads and writes `settings.json` inside the data directory (`theme`, `reducedMotion`, `dataDir`). The renderer applies `theme` as `data-theme` on the document.
- `src/main/services/app-logger.js` and `log-file-store.js` write `Logs/dump.log` under the data directory via `electron-log`. Renderer logs go through `SPLASH_LOG`.

## Database (SQLite)

Uses `better-sqlite3` (synchronous API). Database file: `{dataDir}/db/cpilot.db`.

**Tables:**
- `sync_connections` — saved Sitefinity connection configs (passwords stored via `safeStorage`, not plain text)
- `sync_configurations` — saved sync configurations (field mappings, settings as JSON columns)
- `sync_operations` — operation history (counts, status, timestamps)
- `sync_operation_items` — per-record results (action, status, error, timing)

Schema managed by `src/main/services/db/database.js` (versioned migrations via `PRAGMA user_version`).

Repositories:
- `src/main/services/db/config-repository.js` — connections + configurations CRUD
- `src/main/services/db/operation-repository.js` — operations + items CRUD + getDashboardStats

> **After fresh install:** Run `npm install` — the `postinstall` script automatically rebuilds `better-sqlite3` for Electron's Node.js ABI. `better-sqlite3` must be **12.8.0 or newer** (this project uses `^12.11.1`) so it compiles as C++20 against Electron 41. Older 9.x releases fail that build and leave no bindings file. If a rebuild is ever needed again explicitly, run `npm run rebuild`.

## Tests and tooling

- `npm start` runs `scripts/start-electron.js`.
- `npm test` runs `tests/run-all.js`, which executes `tests/unit/*.test.js`.
- `npm run lint` runs ESLint.
- `npm run sync:vendor` copies Font Awesome into `src/renderer/vendor`.
- `npm run generate:icon` writes `build/icon.ico`, `build/icon.png`, and `src/renderer/assets/logo.png`.
- `npm run build:win` builds an NSIS installer with electron-builder. App id `com.softasium.sitefinity-cpilot`.

Unit tests cover: `json-parser`, `field-mapper`, `comparison-engine` (37 tests, all passing).

## Versioning a new release

Current version: **0.1.0**.

When asked to create or generate a release, edit files only:

1. Bump `package.json` `"version"`.
2. Bump the root `"version"` fields in `package-lock.json` only.
3. Move `CHANGELOG.md` `[Unreleased]` entries into a dated version section.
4. Update the version mentioned in this file and refresh the index line numbers.

Do not run git. Tell the user which files changed.
