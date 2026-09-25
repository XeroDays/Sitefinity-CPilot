/**
 * operation-repository.js — CRUD for SyncOperations and SyncOperationItems.
 *
 * Operations are created at the start of execution and updated as records
 * are processed. Items store per-record results.
 */

const { getDb } = require("./database");

// ── Helpers ────────────────────────────────────────────────────────────────
function uid() {
  return Date.now().toString(16) + Math.random().toString(16).slice(2, 10);
}

function safeJsonParse(str, fallback) {
  try { return JSON.parse(str) || fallback; } catch { return fallback; }
}

// ── Operations ─────────────────────────────────────────────────────────────

/**
 * List operations with optional limit/offset.
 * @param {{ limit?: number, offset?: number, status?: string }} opts
 * @returns {object[]}
 */
function listOperations(opts) {
  opts = opts || {};
  const limit  = opts.limit  || 50;
  const offset = opts.offset || 0;

  let sql = "SELECT * FROM sync_operations";
  const params = [];

  if (opts.status) {
    sql += " WHERE status = ?";
    params.push(opts.status);
  }

  sql += " ORDER BY started_at DESC LIMIT ? OFFSET ?";
  params.push(limit, offset);

  return getDb().prepare(sql).all(...params);
}

/**
 * Get a single operation by id.
 * @param {string} id
 * @returns {object|null}
 */
function getOperation(id) {
  return getDb().prepare("SELECT * FROM sync_operations WHERE id = ?").get(id) || null;
}

/**
 * Create a new operation record and return it.
 * @param {object} data
 * @returns {object}
 */
function createOperation(data) {
  const db = getDb();
  const id = data.id || uid();
  const ts = data.startedAt || Date.now();

  db.prepare(`
    INSERT INTO sync_operations
      (id, config_id, operation_name, source_file, module_endpoint, status, started_at,
       total, created_count, updated_count, skipped_count, deleted_count, failed_count)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, 0, 0, 0, 0)
  `).run(
    id,
    data.configId || null,
    data.operationName || null,
    data.sourceFile || null,
    data.moduleEndpoint,
    "running",
    ts,
    data.total || 0,
  );

  return getOperation(id);
}

/**
 * Update operation counters and/or status.
 * @param {string} id
 * @param {object} patch - { status?, created?, updated?, skipped?, deleted?, failed?, completedAt? }
 */
function updateOperation(id, patch) {
  const db = getDb();
  const sets = [];
  const vals = [];

  if (patch.status !== undefined)      { sets.push("status=?");        vals.push(patch.status); }
  if (patch.completedAt !== undefined) { sets.push("completed_at=?");  vals.push(patch.completedAt); }
  if (patch.total !== undefined)       { sets.push("total=?");         vals.push(patch.total); }

  // Increment counters
  if (patch.created)  { sets.push("created_count=created_count+?");  vals.push(patch.created); }
  if (patch.updated)  { sets.push("updated_count=updated_count+?");  vals.push(patch.updated); }
  if (patch.skipped)  { sets.push("skipped_count=skipped_count+?");  vals.push(patch.skipped); }
  if (patch.deleted)  { sets.push("deleted_count=deleted_count+?");  vals.push(patch.deleted); }
  if (patch.failed)   { sets.push("failed_count=failed_count+?");    vals.push(patch.failed); }

  if (sets.length === 0) return;
  vals.push(id);
  db.prepare(`UPDATE sync_operations SET ${sets.join(",")} WHERE id=?`).run(...vals);
}

// ── Operation Items ────────────────────────────────────────────────────────

/**
 * Get all items for an operation.
 * @param {string} operationId
 * @returns {object[]}
 */
function getOperationItems(operationId) {
  return getDb()
    .prepare("SELECT * FROM sync_operation_items WHERE operation_id = ? ORDER BY rowid")
    .all(operationId)
    .map(deserializeItem);
}

/**
 * Insert a single operation item.
 * @param {object} data
 * @returns {string} id
 */
function insertOperationItem(data) {
  const id = uid();
  getDb().prepare(`
    INSERT INTO sync_operation_items
      (id, operation_id, external_id, sitefinity_item_id, action, status, changed_fields_json,
       error_message, started_at, completed_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    data.operationId,
    data.externalId || null,
    data.sitefinityItemId || null,
    data.action || "unknown",
    data.status || "completed",
    data.changedFields ? JSON.stringify(data.changedFields) : null,
    data.errorMessage || null,
    data.startedAt || null,
    data.completedAt || null,
  );
  return id;
}

/**
 * Bulk-insert multiple items (in a transaction).
 * @param {object[]} items
 */
function insertOperationItems(items) {
  if (!items || items.length === 0) return;
  const insert = getDb().prepare(`
    INSERT INTO sync_operation_items
      (id, operation_id, external_id, sitefinity_item_id, action, status, changed_fields_json,
       error_message, started_at, completed_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const insertMany = getDb().transaction(function (rows) {
    for (var r of rows) {
      insert.run(
        uid(),
        r.operationId,
        r.externalId || null,
        r.sitefinityItemId || null,
        r.action || "unknown",
        r.status || "completed",
        r.changedFields ? JSON.stringify(r.changedFields) : null,
        r.errorMessage || null,
        r.startedAt || null,
        r.completedAt || null,
      );
    }
  });
  insertMany(items);
}

// ── Dashboard Stats ────────────────────────────────────────────────────────

/**
 * Return aggregate stats for the dashboard.
 * @returns {object}
 */
function getDashboardStats() {
  const db = getDb();

  const totals = db.prepare(`
    SELECT
      COUNT(*)          AS total_operations,
      SUM(CASE WHEN status='completed' THEN 1 ELSE 0 END) AS successful,
      SUM(CASE WHEN status='failed'    THEN 1 ELSE 0 END) AS failed,
      SUM(created_count) AS total_created,
      SUM(updated_count) AS total_updated,
      SUM(deleted_count) AS total_deleted
    FROM sync_operations
  `).get();

  const recent = db.prepare(`
    SELECT id, operation_name, module_endpoint, source_file, status,
           started_at, completed_at, created_count, updated_count, failed_count
    FROM sync_operations
    ORDER BY started_at DESC
    LIMIT 10
  `).all();

  return {
    totalOperations: totals.total_operations || 0,
    successful:      totals.successful || 0,
    failed:          totals.failed || 0,
    totalCreated:    totals.total_created || 0,
    totalUpdated:    totals.total_updated || 0,
    totalDeleted:    totals.total_deleted || 0,
    recentOperations: recent,
  };
}

// ── Deserialize ────────────────────────────────────────────────────────────
function deserializeItem(row) {
  return {
    id: row.id,
    operationId: row.operation_id,
    externalId: row.external_id,
    sitefinityItemId: row.sitefinity_item_id,
    action: row.action,
    status: row.status,
    changedFields: safeJsonParse(row.changed_fields_json, null),
    errorMessage: row.error_message,
    startedAt: row.started_at,
    completedAt: row.completed_at,
  };
}

module.exports = {
  listOperations,
  getOperation,
  createOperation,
  updateOperation,
  getOperationItems,
  insertOperationItem,
  insertOperationItems,
  getDashboardStats,
};
