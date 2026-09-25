/**
 * sync-executor.js — Sequential API execution engine.
 *
 * Iterates the operation plan produced by comparison-engine, calls the
 * Sitefinity REST API for each record, streams progress events back to the
 * renderer via the supplied onProgress callback, and persists results to the
 * SQLite database.
 */

"use strict";

const sfClient = require("./sitefinity-client");
const opRepo   = require("../services/db/operation-repository");

var _cancelRequested = false;

/**
 * Request cancellation of the current execution.
 */
function requestCancel() {
  _cancelRequested = true;
}

/**
 * Execute the synchronisation plan.
 *
 * @param {object} opts
 * @param {object[]}  opts.records         - comparison plan records
 * @param {string[]}  [opts.selectedIds]   - subset of externalIds to process (null = all actionable)
 * @param {object}    opts.connection       - { apiEndpoint, authType, username, password, cookie, accessKey }
 * @param {object[]}  opts.mappings         - field mapping array
 * @param {string}    opts.matchingKey      - Sitefinity field name
 * @param {string}    [opts.operationName]
 * @param {string}    [opts.configId]
 * @param {boolean}   [opts.continueOnErrors]
 *
 * @param {function}  onProgress - called with progress object on each record
 * @returns {object} operation summary
 */
async function execute(opts, onProgress) {
  _cancelRequested = false;

  var records      = opts.records || [];
  var selectedSet  = opts.selectedIds ? new Set(opts.selectedIds) : null;
  var conn         = opts.connection || {};
  var mappings     = opts.mappings || [];
  var continueOnErr = opts.continueOnErrors !== false;

  // Filter to actionable records
  var toProcess = records.filter(function (r) {
    if (r.action !== "create" && r.action !== "update" && r.action !== "delete") return false;
    if (selectedSet && !selectedSet.has(r.externalId)) return false;
    return true;
  });

  // Create operation record in DB
  var opRecord = opRepo.createOperation({
    configId:       opts.configId || null,
    operationName:  opts.operationName || null,
    sourceFile:     opts.sourceFileName || null,
    moduleEndpoint: conn.apiEndpoint || "",
    total:          toProcess.length,
    startedAt:      Date.now(),
  });

  var counters = { created: 0, updated: 0, deleted: 0, skipped: 0, failed: 0 };
  var itemResults = [];

  function emit(extra) {
    if (onProgress) {
      onProgress(Object.assign({
        type:       "exec-progress",
        operationId: opRecord.id,
        total:      toProcess.length,
        processed:  counters.created + counters.updated + counters.deleted + counters.failed,
        ...counters,
      }, extra || {}));
    }
  }

  emit({ message: "Operation started." });

  for (var i = 0; i < toProcess.length; i++) {
    if (_cancelRequested) {
      emit({ message: "Operation cancelled by user." });
      break;
    }

    var rec      = toProcess[i];
    var startedAt = Date.now();

    emit({ message: "Processing " + rec.externalId + "…" });

    var itemResult = {
      operationId:      opRecord.id,
      externalId:       rec.externalId,
      sitefinityItemId: rec.sitefinityItemId,
      action:           rec.action,
      status:           "pending",
      changedFields:    rec.changedFields,
      errorMessage:     null,
      startedAt,
      completedAt:      null,
    };

    try {
      if (rec.action === "create") {
        var created = await sfClient.createItem(conn, rec.newValues);
        itemResult.sitefinityItemId = created && (created.Id || created.id) ? (created.Id || created.id) : null;
        itemResult.status = "completed";
        counters.created++;
        opRepo.updateOperation(opRecord.id, { created: 1 });
        emit({ message: "Created " + rec.externalId + " successfully." });

      } else if (rec.action === "update") {
        await sfClient.updateItem(conn, rec.sitefinityItemId, rec.newValues);
        itemResult.status = "completed";
        counters.updated++;
        opRepo.updateOperation(opRecord.id, { updated: 1 });
        emit({ message: "Updated " + rec.externalId + " successfully." });

      } else if (rec.action === "delete") {
        await sfClient.deleteItem(conn, rec.sitefinityItemId);
        itemResult.status = "completed";
        counters.deleted++;
        opRepo.updateOperation(opRecord.id, { deleted: 1 });
        emit({ message: "Deleted " + rec.externalId + " successfully." });
      }
    } catch (err) {
      itemResult.status       = "failed";
      itemResult.errorMessage = err.message;
      counters.failed++;
      opRepo.updateOperation(opRecord.id, { failed: 1 });
      emit({ message: "Failed: " + rec.externalId + " — " + err.message, level: "error" });

      if (!continueOnErr) {
        emit({ message: "Stopping due to error (continueOnErrors is disabled)." });
        break;
      }
    } finally {
      itemResult.completedAt = Date.now();
      itemResults.push(itemResult);
    }
  }

  // Bulk insert item results
  opRepo.insertOperationItems(itemResults);

  // Finalise operation
  var finalStatus = _cancelRequested ? "cancelled" : (counters.failed > 0 && !continueOnErr ? "partial" : "completed");
  opRepo.updateOperation(opRecord.id, {
    status:      finalStatus,
    completedAt: Date.now(),
  });

  emit({
    message: "Operation " + finalStatus + ". Created: " + counters.created + ", Updated: " + counters.updated + ", Deleted: " + counters.deleted + ", Failed: " + counters.failed + ".",
    level: counters.failed > 0 ? "error" : "success",
  });

  return {
    operationId: opRecord.id,
    status:      finalStatus,
    total:       toProcess.length,
    ...counters,
    items:       itemResults,
  };
}

module.exports = { execute, requestCancel };
