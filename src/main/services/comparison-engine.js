/**
 * comparison-engine.js — Pure data comparison logic.
 *
 * This module is completely stateless and does NOT communicate with any API.
 * It receives existing Sitefinity records and JSON source records, then
 * classifies each record and produces a detailed operation plan.
 *
 * Action types:
 *   'create'   — record is in JSON but not in Sitefinity
 *   'update'   — record exists in both but mapped fields differ
 *   'skip'     — record is unchanged OR mode does not permit the operation
 *   'delete'   — record is in Sitefinity but not in JSON (full sync + deletion enabled)
 *   'conflict' — duplicate matching keys, missing keys, or unmappable records
 */

"use strict";

const fieldMapper = require("./field-mapper");

// ── Normalise helpers ──────────────────────────────────────────────────────

/**
 * Normalise a value for comparison: coerce to string, trim, optionally lower.
 */
function normalise(value, caseSensitive) {
  if (value === null || value === undefined) return "";
  var str = String(value).trim();
  return caseSensitive ? str : str.toLowerCase();
}

/**
 * Compare two mapped objects and return names of fields that differ.
 * @param {object} existing - current Sitefinity values (keyed by sitefinityField)
 * @param {object} proposed - proposed mapped values (keyed by sitefinityField)
 * @param {boolean} caseSensitive
 * @returns {string[]} changed field names
 */
function diffFields(existing, proposed, caseSensitive) {
  var changed = [];
  var allKeys = new Set([...Object.keys(existing), ...Object.keys(proposed)]);
  allKeys.forEach(function (key) {
    var existingNorm = normalise(existing[key], caseSensitive);
    var proposedNorm = normalise(proposed[key], caseSensitive);
    if (existingNorm !== proposedNorm) {
      changed.push(key);
    }
  });
  return changed;
}

// ── Build existing index ────────────────────────────────────────────────────

/**
 * Build a lookup index of existing Sitefinity records keyed by the matching key value.
 * Returns { index: Map<string, object>, duplicates: string[] }.
 */
function buildExistingIndex(existingRecords, matchingKey) {
  var index      = new Map();
  var duplicates = [];

  existingRecords.forEach(function (rec) {
    var keyVal = rec[matchingKey];
    if (keyVal === null || keyVal === undefined) return;
    var key = String(keyVal);
    if (index.has(key)) {
      if (!duplicates.includes(key)) duplicates.push(key);
    } else {
      index.set(key, rec);
    }
  });

  return { index, duplicates };
}

// ── Main compare function ──────────────────────────────────────────────────

/**
 * Compare JSON source records against existing Sitefinity records.
 *
 * @param {object} opts
 * @param {object[]}  opts.sourceRecords      - raw JSON records
 * @param {object[]}  opts.existingRecords     - records from Sitefinity
 * @param {object[]}  opts.mappings            - field mapping array
 * @param {string}    opts.matchingKey         - Sitefinity field name used as key
 * @param {string}    opts.syncMode            - 'create' | 'update' | 'upsert' | 'full'
 * @param {boolean}   [opts.deletionEnabled]   - true = mark missing records for deletion
 * @param {boolean}   [opts.skipUnchanged]     - true = skip unchanged records (default true)
 * @param {boolean}   [opts.caseSensitive]     - case-sensitive string comparison
 *
 * @returns {{
 *   records: object[],
 *   summary: object,
 *   existingSitefinityCount: number,
 * }}
 */
function compare(opts) {
  var sourceRecords    = opts.sourceRecords    || [];
  var existingRecords  = opts.existingRecords  || [];
  var mappings         = opts.mappings         || [];
  var matchingKey      = opts.matchingKey      || "ExternalId";
  var syncMode         = opts.syncMode         || "upsert";
  var deletionEnabled  = opts.deletionEnabled  || false;
  var skipUnchanged    = opts.skipUnchanged !== false; // default true
  var caseSensitive    = opts.caseSensitive    || false;

  var { index: existingIndex, duplicates: existingDups } = buildExistingIndex(existingRecords, matchingKey);

  // Track which existing keys we've seen (for missing detection)
  var seenExistingKeys = new Set();
  var sourceKeysSeen   = new Map(); // key → first record idx for duplicate detection

  var results = [];
  var summary = {
    total:          sourceRecords.length,
    newCount:        0,
    modifiedCount:   0,
    unchangedCount:  0,
    missingCount:    0,
    conflictCount:   0,
    deleteCount:     0,
    skipCount:       0,
  };

  sourceRecords.forEach(function (rec, recIdx) {
    if (!rec || typeof rec !== "object" || Array.isArray(rec)) {
      results.push({
        externalId:      "(index " + recIdx + ")",
        sitefinityItemId: null,
        action:          "conflict",
        warnings:        ["Record is not a plain object."],
        changedFields:   [],
        originalValues:  {},
        newValues:       {},
        validationStatus: "invalid",
      });
      summary.conflictCount++;
      return;
    }

    // Resolve matching key from the source record
    var keyValue = fieldMapper.getMatchingKeyValue(rec, matchingKey, mappings);

    if (!keyValue) {
      results.push({
        externalId:       "(no key at index " + recIdx + ")",
        sitefinityItemId:  null,
        action:            "conflict",
        warnings:          ["Missing or empty matching key '" + matchingKey + "'."],
        changedFields:     [],
        originalValues:    {},
        newValues:         {},
        validationStatus:  "invalid",
      });
      summary.conflictCount++;
      return;
    }

    // Duplicate in source
    if (sourceKeysSeen.has(keyValue)) {
      results.push({
        externalId:       keyValue,
        sitefinityItemId:  null,
        action:            "conflict",
        warnings:          ["Duplicate matching key '" + keyValue + "' in JSON source. First occurrence was at record " + sourceKeysSeen.get(keyValue) + "."],
        changedFields:     [],
        originalValues:    {},
        newValues:         {},
        validationStatus:  "invalid",
      });
      summary.conflictCount++;
      return;
    }
    sourceKeysSeen.set(keyValue, recIdx);

    var existingRec = existingIndex.get(keyValue);

    if (!existingRec) {
      // Record does not exist in Sitefinity
      var canCreate = syncMode === "create" || syncMode === "upsert" || syncMode === "full";
      if (!canCreate) {
        results.push(buildResult(keyValue, null, "skip", [], {}, fieldMapper.applyMappings(mappings, rec), []));
        summary.skipCount++;
        return;
      }
      results.push(buildResult(keyValue, null, "create", [], {}, fieldMapper.applyMappings(mappings, rec), []));
      summary.newCount++;
      return;
    }

    seenExistingKeys.add(keyValue);

    // Record exists — map source and compare
    var proposed = fieldMapper.applyMappings(mappings, rec);
    var existing = {};
    mappings.forEach(function (m) {
      if (!m.ignore && m.jsonProperty) {
        existing[m.sitefinityField] = existingRec[m.sitefinityField];
      }
    });

    var changedFields = diffFields(existing, proposed, caseSensitive);

    if (changedFields.length === 0) {
      // Unchanged
      var action = (skipUnchanged) ? "skip" : "update";
      results.push(buildResult(keyValue, existingRec.Id || existingRec.id || null, action, changedFields, existing, proposed, []));
      if (action === "skip") summary.unchangedCount++;
      else summary.modifiedCount++;
      return;
    }

    // Changed
    var canUpdate = syncMode === "update" || syncMode === "upsert" || syncMode === "full";
    if (!canUpdate) {
      results.push(buildResult(keyValue, existingRec.Id || existingRec.id || null, "skip", changedFields, existing, proposed, ["Update not permitted in current sync mode."]));
      summary.skipCount++;
      return;
    }

    results.push(buildResult(keyValue, existingRec.Id || existingRec.id || null, "update", changedFields, existing, proposed, []));
    summary.modifiedCount++;
  });

  // ── Identify missing records ─────────────────────────────────────────────
  if (syncMode === "full") {
    existingIndex.forEach(function (rec, key) {
      if (seenExistingKeys.has(key)) return;
      if (deletionEnabled) {
        results.push({
          externalId:        key,
          sitefinityItemId:  rec.Id || rec.id || null,
          action:            "delete",
          changedFields:     [],
          originalValues:    rec,
          newValues:         {},
          warnings:          [],
          validationStatus:  "valid",
        });
        summary.deleteCount++;
      } else {
        results.push({
          externalId:        key,
          sitefinityItemId:  rec.Id || rec.id || null,
          action:            "missing",
          changedFields:     [],
          originalValues:    rec,
          newValues:         {},
          warnings:          ["Record exists in Sitefinity but is absent from the JSON source. Deletion is disabled."],
          validationStatus:  "info",
        });
        summary.missingCount++;
      }
    });
  } else {
    // Non-full sync: still report missing for informational purposes
    existingIndex.forEach(function (rec, key) {
      if (!seenExistingKeys.has(key)) {
        summary.missingCount++;
      }
    });
  }

  return {
    records:                results,
    summary:                summary,
    existingSitefinityCount: existingRecords.length,
  };
}

function buildResult(externalId, sitefinityItemId, action, changedFields, originalValues, newValues, warnings) {
  return {
    externalId,
    sitefinityItemId,
    action,
    changedFields,
    originalValues: originalValues || {},
    newValues:      newValues || {},
    warnings:       warnings || [],
    validationStatus: "valid",
  };
}

module.exports = { compare, buildExistingIndex, diffFields, normalise };
