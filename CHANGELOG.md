# Changelog

All notable changes to Sitefinity C-Pilot are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## Versioning Policy

Sitefinity C-Pilot uses **Semantic Versioning** (`MAJOR.MINOR.PATCH`):

- **MAJOR** — incompatible changes to saved data or user-facing behavior
- **MINOR** — backward-compatible new features
- **PATCH** — backward-compatible bug fixes

The version must match the `"version"` field in `package.json`.

## [Unreleased]

### Added

- Identity field picker in Field Mapping: a new Identity radio-button column lets users designate any mapped Sitefinity field as the matching key directly on the Field Mapping screen; auto-selects the best candidate (prefers existing key → id-like field name → first mapped field); blocks "Next" and shows an alert when no identity is selected; persists the choice to Sync Settings which now shows a hint that the value was set in Field Mapping
- Preferences in the gear menu opens the Settings screen. The Preferences section there shows the theme dropdown (Dark or Light) directly, and Apply switches the app appearance immediately and keeps the choice for the next launch

### Changed

- Database, logs, and settings are stored together in Documents\Sitefinity CPilot. On startup, files already written under Documents\Sitefinity C-Pilot or in the Electron user-data folder are copied into the new folder when the destination file is missing.

### Fixed

- Database failed to initialise because `better-sqlite3` 9.x could not compile for Electron 41 (C++20 required). The app now uses `better-sqlite3` 12.11 or newer, which builds for Electron's native module and loads on startup.
- Startup now shows an actionable error dialog when the native database module fails to load, instead of silently continuing and producing cryptic IPC errors throughout the session
- Dashboard screen with operation stats, quick-action cards, and recent operations table
- Connection screen: enter Sitefinity API endpoint, test connection, discover module fields, save connections
- JSON Source screen: upload JSON files (drag-and-drop or file picker), paste JSON, auto-detect record arrays, show record count and field preview
- Field Mapping screen: auto-map JSON properties to Sitefinity fields (exact + case-insensitive), manual override dropdowns, 5-record preview
- Sync Settings screen: matching key selector, four sync modes (Create / Update / Upsert / Full), deletion config with explicit warning, advanced options
- Comparison screen: fetch all Sitefinity records, classify each source record (New / Modified / Unchanged / Missing / Conflict), per-record selection, detail drawer with field diff table
- Confirmation screen: full summary of planned operations with destructive action warnings
- Execution screen: live progress bar, per-record log stream, cancel support
- Results screen: filterable summary table, CSV and JSON export, Save Configuration button
- Saved Configurations screen: list, run, and delete saved sync configurations
- Operation History screen: searchable list of all past operations with details link
- Settings screen: manage saved Sitefinity connections, theme preference, data directory
- Sidebar navigation with active-state highlighting
- Wizard step progress bar across all 8 wizard screens
- Toast notification system (success, error, info, warning)
- SQLite database (better-sqlite3) for saved connections, configurations, and operation history
- Comparison engine: normalise values, build matching-key index, classify records, detect conflicts and duplicates
- Sync executor: sequential API create/update/delete with real-time IPC progress events
- Sitefinity REST API client: Node.js built-in https, Basic Auth, Cookie/Session auth, OData pagination, SSRF URL guard
- JSON parser: root array and wrapped object detection, field type inference, duplicate key detection
- Field mapper: exact, case-insensitive, and manual mapping with validation
- 37 unit tests for json-parser, field-mapper, and comparison-engine (all passing)
- Developer Tools shortcut in the gear menu

## [0.1.0] - 2026-09-25

### Added

- Desktop shell with a splash screen and a single main menu for Sitefinity C-Pilot
- About dialog with product version and license text
