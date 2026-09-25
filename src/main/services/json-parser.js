/**
 * json-parser.js — Parse, validate, and analyse JSON source data.
 *
 * Supports two root structures:
 *   1. Root array:     [ { ExternalId: "...", ... }, ... ]
 *   2. Wrapped object: { "module": "...", "items": [ ... ] }
 *
 * Returns a structured analysis result; does not modify any Sitefinity data.
 */

"use strict";

// ── Type inference ─────────────────────────────────────────────────────────

function inferType(value) {
  if (value === null || value === undefined) return "null";
  if (typeof value === "boolean") return "boolean";
  if (typeof value === "number") return "number";
  if (typeof value === "string") {
    if (/^\d{4}-\d{2}-\d{2}T[\d:.Z+-]+$/.test(value)) return "datetime";
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return "date";
    return "string";
  }
  if (Array.isArray(value)) return "array";
  if (typeof value === "object") return "object";
  return "unknown";
}

/**
 * Infer fields from an array of records (union of all keys).
 * @param {object[]} records
 * @returns {{ name: string, type: string }[]}
 */
function inferFields(records) {
  var fieldMap = {};
  records.forEach(function (rec) {
    if (!rec || typeof rec !== "object" || Array.isArray(rec)) return;
    Object.keys(rec).forEach(function (key) {
      if (!fieldMap[key]) {
        fieldMap[key] = inferType(rec[key]);
      } else if (fieldMap[key] === "null" && inferType(rec[key]) !== "null") {
        fieldMap[key] = inferType(rec[key]);
      }
    });
  });
  return Object.keys(fieldMap).map(function (k) { return { name: k, type: fieldMap[k] }; });
}

// ── Nested path resolution ─────────────────────────────────────────────────

/**
 * Try to automatically detect which property of a root object holds the record array.
 * Returns the property path string or null if root is already an array.
 * @param {any} parsed
 * @returns {{ path: string|null, records: any[], candidates: string[] }}
 */
function detectRecordPath(parsed) {
  if (Array.isArray(parsed)) {
    return { path: null, records: parsed, candidates: [] };
  }

  if (!parsed || typeof parsed !== "object") {
    return { path: null, records: [], candidates: [] };
  }

  var candidates = [];
  Object.keys(parsed).forEach(function (key) {
    if (Array.isArray(parsed[key]) && parsed[key].length > 0) {
      candidates.push(key);
    }
  });

  // OData-style: prefer 'value'
  if (candidates.includes("value")) {
    return { path: "value", records: parsed.value, candidates };
  }

  // Common keys: items, data, records, results
  var preferred = ["items", "data", "records", "results", "content"];
  for (var i = 0; i < preferred.length; i++) {
    if (candidates.includes(preferred[i])) {
      return { path: preferred[i], records: parsed[preferred[i]], candidates };
    }
  }

  // Fall back to the first array property with the most elements
  if (candidates.length === 1) {
    return { path: candidates[0], records: parsed[candidates[0]], candidates };
  }
  if (candidates.length > 1) {
    // return the biggest
    var best = candidates.reduce(function (a, b) {
      return parsed[a].length >= parsed[b].length ? a : b;
    });
    return { path: best, records: parsed[best], candidates };
  }

  return { path: null, records: [], candidates: [] };
}

/**
 * Get records from a parsed object using a dot-delimited path.
 * @param {any} parsed
 * @param {string|null} path
 * @returns {any[]}
 */
function getRecordsByPath(parsed, path) {
  if (!path) {
    return Array.isArray(parsed) ? parsed : [];
  }
  var parts = path.split(".");
  var current = parsed;
  for (var i = 0; i < parts.length; i++) {
    if (!current || typeof current !== "object") return [];
    current = current[parts[i]];
  }
  return Array.isArray(current) ? current : [];
}

// ── Duplicate detection ─────────────────────────────────────────────────────

/**
 * Find duplicate values for a given field in a record array.
 * @param {object[]} records
 * @param {string} field
 * @returns {string[]} duplicate values
 */
function findDuplicates(records, field) {
  var seen = {};
  var dups = [];
  records.forEach(function (rec) {
    if (!rec || typeof rec !== "object") return;
    var val = rec[field];
    if (val === null || val === undefined) return;
    var key = String(val);
    if (seen[key]) {
      if (!dups.includes(key)) dups.push(key);
    }
    seen[key] = true;
  });
  return dups;
}

// ── Main parse function ────────────────────────────────────────────────────

/**
 * Parse and analyse a JSON string.
 *
 * @param {string} jsonText
 * @param {string|null} [forcedPath] - if provided, use this path instead of auto-detecting
 * @returns {{
 *   ok: boolean,
 *   error?: string,
 *   rootType?: 'array' | 'object',
 *   recordPath?: string | null,
 *   candidates?: string[],
 *   records?: object[],
 *   totalRecords?: number,
 *   detectedFields?: { name: string, type: string }[],
 *   warnings?: string[],
 * }}
 */
function parseJson(jsonText, forcedPath) {
  if (!jsonText || !jsonText.trim()) {
    return { ok: false, error: "JSON input is empty." };
  }

  var parsed;
  try {
    parsed = JSON.parse(jsonText);
  } catch (e) {
    return { ok: false, error: "Invalid JSON: " + e.message };
  }

  if (parsed === null || typeof parsed !== "object") {
    return { ok: false, error: "JSON must be an object or array, not a primitive value." };
  }

  var rootType = Array.isArray(parsed) ? "array" : "object";

  var detected = detectRecordPath(parsed);
  var path     = forcedPath !== undefined ? forcedPath : detected.path;
  var records  = forcedPath !== undefined
    ? getRecordsByPath(parsed, forcedPath)
    : detected.records;

  if (!Array.isArray(records) || records.length === 0) {
    return {
      ok: false,
      error: "No records found. " +
        (rootType === "object" && detected.candidates.length > 0
          ? "Available array properties: " + detected.candidates.join(", ") + "."
          : "The JSON does not contain a recognisable array of records."),
      rootType,
      candidates: detected.candidates,
    };
  }

  var detectedFields = inferFields(records);
  var warnings = [];

  // Check for non-object elements
  var nonObj = records.filter(function (r) { return !r || typeof r !== "object" || Array.isArray(r); });
  if (nonObj.length > 0) {
    warnings.push(nonObj.length + " record(s) are not plain objects and will be skipped.");
    records = records.filter(function (r) { return r && typeof r === "object" && !Array.isArray(r); });
  }

  return {
    ok: true,
    rootType,
    recordPath: path,
    candidates: detected.candidates,
    records,
    totalRecords: records.length,
    detectedFields,
    warnings,
  };
}

module.exports = {
  parseJson,
  inferFields,
  inferType,
  detectRecordPath,
  findDuplicates,
  getRecordsByPath,
};
