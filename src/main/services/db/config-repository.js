/**
 * config-repository.js — CRUD for SitefinityConnections and SyncConfigurations.
 *
 * All IDs are generated here as random hex strings (no external uuid dep).
 * Timestamps are Unix milliseconds (Date.now()).
 */

const { getDb } = require("./database");

// ── Helpers ────────────────────────────────────────────────────────────────
function uid() {
  return Date.now().toString(16) + Math.random().toString(16).slice(2, 10);
}

function now() {
  return Date.now();
}

// ── Sitefinity Connections ─────────────────────────────────────────────────

/**
 * List all saved Sitefinity connections (credentials are NOT returned).
 * @returns {object[]}
 */
function listConnections() {
  return getDb()
    .prepare("SELECT id, name, base_url, api_endpoint, auth_type, created_at, updated_at FROM sync_connections ORDER BY updated_at DESC")
    .all();
}

/**
 * Get a single connection by id.
 * @param {string} id
 * @returns {object|null}
 */
function getConnection(id) {
  return getDb()
    .prepare("SELECT id, name, base_url, api_endpoint, auth_type, credential_ref, created_at, updated_at FROM sync_connections WHERE id = ?")
    .get(id) || null;
}

/**
 * Create or update a connection.
 * Returns the saved connection (without credential_ref).
 * @param {object} data - { id?, name, baseUrl, apiEndpoint, authType, credentialRef? }
 * @returns {object}
 */
function saveConnection(data) {
  const db = getDb();
  const id = data.id || uid();
  const ts = now();

  const existing = db.prepare("SELECT id FROM sync_connections WHERE id = ?").get(id);

  if (existing) {
    db.prepare(`
      UPDATE sync_connections
      SET name=?, base_url=?, api_endpoint=?, auth_type=?, credential_ref=COALESCE(?,credential_ref), updated_at=?
      WHERE id=?
    `).run(data.name, data.baseUrl, data.apiEndpoint, data.authType || "none", data.credentialRef || null, ts, id);
  } else {
    db.prepare(`
      INSERT INTO sync_connections (id, name, base_url, api_endpoint, auth_type, credential_ref, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, data.name, data.baseUrl, data.apiEndpoint, data.authType || "none", data.credentialRef || null, ts, ts);
  }

  return {
    id,
    name: data.name,
    baseUrl: data.baseUrl,
    apiEndpoint: data.apiEndpoint,
    authType: data.authType || "none",
    createdAt: existing ? existing.created_at : ts,
    updatedAt: ts,
  };
}

/**
 * Delete a connection by id.
 * @param {string} id
 */
function deleteConnection(id) {
  getDb().prepare("DELETE FROM sync_connections WHERE id = ?").run(id);
}

// ── Sync Configurations ────────────────────────────────────────────────────

/**
 * List all saved sync configurations (summary only).
 * @returns {object[]}
 */
function listConfigurations() {
  return getDb()
    .prepare(`
      SELECT c.id, c.name, c.connection_id, c.module_endpoint, c.matching_key, c.sync_mode,
             c.created_at, c.updated_at, sc.name AS connection_name
      FROM sync_configurations c
      LEFT JOIN sync_connections sc ON sc.id = c.connection_id
      ORDER BY c.updated_at DESC
    `)
    .all();
}

/**
 * Get full configuration by id.
 * @param {string} id
 * @returns {object|null}
 */
function getConfiguration(id) {
  const row = getDb()
    .prepare("SELECT * FROM sync_configurations WHERE id = ?")
    .get(id);
  if (!row) return null;
  return deserializeConfig(row);
}

/**
 * Save (create or update) a sync configuration.
 * @param {object} data
 * @returns {object}
 */
function saveConfiguration(data) {
  const db = getDb();
  const id = data.id || uid();
  const ts = now();

  const fieldMappingsJson = JSON.stringify(data.fieldMappings || []);
  const deletionSettingsJson = JSON.stringify(data.deletionSettings || {});
  const optionsJson = JSON.stringify(data.options || {});

  const existing = db.prepare("SELECT id FROM sync_configurations WHERE id = ?").get(id);

  if (existing) {
    db.prepare(`
      UPDATE sync_configurations
      SET name=?, connection_id=?, module_endpoint=?, json_structure_path=?,
          field_mappings_json=?, matching_key=?, sync_mode=?,
          deletion_settings_json=?, options_json=?, updated_at=?
      WHERE id=?
    `).run(
      data.name, data.connectionId || null, data.moduleEndpoint, data.jsonStructurePath || null,
      fieldMappingsJson, data.matchingKey || "ExternalId", data.syncMode || "upsert",
      deletionSettingsJson, optionsJson, ts, id
    );
  } else {
    db.prepare(`
      INSERT INTO sync_configurations
        (id, name, connection_id, module_endpoint, json_structure_path,
         field_mappings_json, matching_key, sync_mode, deletion_settings_json, options_json,
         created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id, data.name, data.connectionId || null, data.moduleEndpoint, data.jsonStructurePath || null,
      fieldMappingsJson, data.matchingKey || "ExternalId", data.syncMode || "upsert",
      deletionSettingsJson, optionsJson, ts, ts
    );
  }

  return getConfiguration(id);
}

/**
 * Delete a configuration by id.
 * @param {string} id
 */
function deleteConfiguration(id) {
  getDb().prepare("DELETE FROM sync_configurations WHERE id = ?").run(id);
}

// ── Deserialize ────────────────────────────────────────────────────────────
function deserializeConfig(row) {
  return {
    id: row.id,
    name: row.name,
    connectionId: row.connection_id,
    moduleEndpoint: row.module_endpoint,
    jsonStructurePath: row.json_structure_path,
    fieldMappings: safeJsonParse(row.field_mappings_json, []),
    matchingKey: row.matching_key,
    syncMode: row.sync_mode,
    deletionSettings: safeJsonParse(row.deletion_settings_json, {}),
    options: safeJsonParse(row.options_json, {}),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function safeJsonParse(str, fallback) {
  try { return JSON.parse(str) || fallback; } catch { return fallback; }
}

module.exports = {
  listConnections,
  getConnection,
  saveConnection,
  deleteConnection,
  listConfigurations,
  getConfiguration,
  saveConfiguration,
  deleteConfiguration,
};
