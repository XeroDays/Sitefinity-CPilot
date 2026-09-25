/**
 * database.js — SQLite initialisation and schema management.
 *
 * Uses better-sqlite3 (synchronous API). The database file lives inside
 * the user's data directory so it survives app updates.
 *
 * Migration strategy: a simple integer user_version pragma. Each migration
 * runs once and increments the version.
 */

const path = require("path");
const fs   = require("fs");

let _db = null;

// ── Lazy open ──────────────────────────────────────────────────────────────
function getDb() {
  if (_db) return _db;
  throw new Error("Database not initialised. Call initDatabase() first.");
}

// ── Initialise ─────────────────────────────────────────────────────────────
function initDatabase(dataDir) {
  if (_db) return _db;

  let Database;
  try {
    Database = require("better-sqlite3");
  } catch (err) {
    throw new Error(
      "better-sqlite3 is not installed or failed to load. " +
      "Run `npm install` in the project root. Original error: " + err.message
    );
  }

  const dbDir = path.join(dataDir, "db");
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }

  const dbPath = path.join(dbDir, "cpilot.db");
  _db = new Database(dbPath);
  _db.pragma("journal_mode = WAL");
  _db.pragma("foreign_keys = ON");

  runMigrations(_db);
  return _db;
}

// ── Migrations ─────────────────────────────────────────────────────────────
const MIGRATIONS = [
  // v1 — initial schema
  function v1(db) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS sync_connections (
        id           TEXT PRIMARY KEY,
        name         TEXT NOT NULL,
        base_url     TEXT NOT NULL,
        api_endpoint TEXT NOT NULL,
        auth_type    TEXT NOT NULL DEFAULT 'none',
        credential_ref TEXT,
        created_at   INTEGER NOT NULL,
        updated_at   INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS sync_configurations (
        id                   TEXT PRIMARY KEY,
        name                 TEXT NOT NULL,
        connection_id        TEXT,
        module_endpoint      TEXT NOT NULL,
        json_structure_path  TEXT,
        field_mappings_json  TEXT,
        matching_key         TEXT NOT NULL DEFAULT 'ExternalId',
        sync_mode            TEXT NOT NULL DEFAULT 'upsert',
        deletion_settings_json TEXT,
        options_json         TEXT,
        created_at           INTEGER NOT NULL,
        updated_at           INTEGER NOT NULL,
        FOREIGN KEY (connection_id) REFERENCES sync_connections(id) ON DELETE SET NULL
      );

      CREATE TABLE IF NOT EXISTS sync_operations (
        id               TEXT PRIMARY KEY,
        config_id        TEXT,
        operation_name   TEXT,
        source_file      TEXT,
        module_endpoint  TEXT NOT NULL,
        status           TEXT NOT NULL DEFAULT 'pending',
        started_at       INTEGER,
        completed_at     INTEGER,
        total            INTEGER NOT NULL DEFAULT 0,
        created_count    INTEGER NOT NULL DEFAULT 0,
        updated_count    INTEGER NOT NULL DEFAULT 0,
        skipped_count    INTEGER NOT NULL DEFAULT 0,
        deleted_count    INTEGER NOT NULL DEFAULT 0,
        failed_count     INTEGER NOT NULL DEFAULT 0,
        FOREIGN KEY (config_id) REFERENCES sync_configurations(id) ON DELETE SET NULL
      );

      CREATE TABLE IF NOT EXISTS sync_operation_items (
        id                TEXT PRIMARY KEY,
        operation_id      TEXT NOT NULL,
        external_id       TEXT,
        sitefinity_item_id TEXT,
        action            TEXT NOT NULL,
        status            TEXT NOT NULL DEFAULT 'pending',
        changed_fields_json TEXT,
        error_message     TEXT,
        started_at        INTEGER,
        completed_at      INTEGER,
        FOREIGN KEY (operation_id) REFERENCES sync_operations(id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_op_items_operation ON sync_operation_items(operation_id);
      CREATE INDEX IF NOT EXISTS idx_operations_status  ON sync_operations(status);
      CREATE INDEX IF NOT EXISTS idx_operations_started ON sync_operations(started_at DESC);
    `);
  },
  // v2 — strip any previously stored auth secrets from saved connections
  function v2(db) {
    db.exec(`UPDATE sync_connections SET credential_ref = NULL WHERE credential_ref IS NOT NULL`);
  },
];

function runMigrations(db) {
  const version = db.pragma("user_version", { simple: true });
  const pending = MIGRATIONS.slice(version);
  if (pending.length === 0) return;

  for (let i = 0; i < pending.length; i++) {
    const migrate = db.transaction(pending[i]);
    migrate(db);
    db.pragma(`user_version = ${version + i + 1}`);
  }
}

// ── Close ──────────────────────────────────────────────────────────────────
function closeDatabase() {
  if (_db) {
    _db.close();
    _db = null;
  }
}

module.exports = { initDatabase, getDb, closeDatabase };
