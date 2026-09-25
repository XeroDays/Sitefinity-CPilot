/**
 * json-parser.js — Parse, validate, and analyse JSON source data.
 *
 * Finds the content-item array by walking nested objects (any property name,
 * any depth), not only fixed keys like value/items/data. Returns a flat list
 * of item objects for the mapping UI.
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

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

/** Mild boost for common collection property names; detection does not require them. */
var PREFERRED_LEAF_KEYS = {
  value: 15,
  items: 12,
  data: 12,
  records: 10,
  results: 10,
  content: 8,
};

var CONTENT_HINT_KEYS = [
  "Id", "id", "Title", "title", "ExternalId", "externalId",
  "UrlName", "urlName", "Name", "name", "Code", "code",
];

/**
 * Score an array as a content-item collection.
 *
 * Selection rule (higher wins):
 *   + object count (prefer real lists)
 *   + key homogeneity across sampled elements
 *   + average key count (richer record shapes)
 *   + mild bonus for preferred leaf names (value/items/data/…)
 *   + mild bonus for content-like shared keys (Id, Title, …)
 *   − depth (slight preference for shallower arrays)
 *   − wrapper-ish elements (single key whose value is object/array)
 *
 * Nested arrays inside individual items are not walked as siblings of the
 * parent collection; only object properties are traversed, so item fields
 * that happen to be arrays are not competing item lists.
 *
 * @param {any[]} arr
 * @param {string|null} path
 * @param {number} depth
 * @returns {number|null} score, or null if not a viable item array
 */
function scoreArrayCandidate(arr, path, depth) {
  if (!Array.isArray(arr) || arr.length === 0) return null;

  var objects = arr.filter(isPlainObject);
  if (objects.length === 0) return null;

  var sampleSize = Math.min(10, objects.length);
  var sample = objects.slice(0, sampleSize);
  var keySets = sample.map(function (o) { return Object.keys(o); });
  var shared = keySets[0].slice();
  for (var i = 1; i < keySets.length; i++) {
    shared = shared.filter(function (k) { return keySets[i].indexOf(k) !== -1; });
  }

  var avgKeys = keySets.reduce(function (sum, keys) { return sum + keys.length; }, 0) / keySets.length;
  if (avgKeys < 1) return null;

  var homogeneity = shared.length / avgKeys;

  var wrapperish = 0;
  sample.forEach(function (obj, idx) {
    var keys = keySets[idx];
    if (keys.length !== 1) return;
    var only = obj[keys[0]];
    if (only !== null && typeof only === "object") wrapperish += 1;
  });
  wrapperish = wrapperish / sampleSize;

  var leaf = path ? path.split(".").pop() : "";
  var preferredBonus = PREFERRED_LEAF_KEYS[leaf] || 0;

  var hintBonus = 0;
  shared.forEach(function (k) {
    if (CONTENT_HINT_KEYS.indexOf(k) !== -1) hintBonus += 5;
  });

  var score =
    objects.length * 10 +
    homogeneity * 25 +
    avgKeys * 3 +
    preferredBonus +
    hintBonus -
    depth * 4 -
    wrapperish * 40;

  if (objects.length === 1 && avgKeys >= 2) score += 5;
  if (objects.length === 1 && avgKeys < 2) score -= 10;

  return score;
}

/**
 * Walk objects (not into array elements) and collect scored array candidates.
 * @param {any} node
 * @param {string|null} path
 * @param {number} depth
 * @param {{ path: string|null, records: any[], depth: number, score: number }[]} out
 */
function collectArrayCandidates(node, path, depth, out) {
  if (Array.isArray(node)) {
    var rootScore = scoreArrayCandidate(node, path, depth);
    if (rootScore !== null) {
      out.push({ path: path, records: node, depth: depth, score: rootScore });
    }
    return;
  }

  if (!isPlainObject(node)) return;

  Object.keys(node).forEach(function (key) {
    var val = node[key];
    var childPath = path ? path + "." + key : key;
    if (Array.isArray(val)) {
      var score = scoreArrayCandidate(val, childPath, depth + 1);
      if (score !== null) {
        out.push({ path: childPath, records: val, depth: depth + 1, score: score });
      }
      // Do not recurse into array elements — nested object fields stay item fields.
    } else if (isPlainObject(val)) {
      collectArrayCandidates(val, childPath, depth + 1, out);
    }
  });
}

/**
 * True when a root object looks like a single content record (no item array).
 * @param {object} obj
 * @returns {boolean}
 */
function looksLikeSingleRecord(obj) {
  var keys = Object.keys(obj);
  if (keys.length < 2) return false;
  var primitiveOrSimple = 0;
  keys.forEach(function (k) {
    var v = obj[k];
    if (v === null || typeof v !== "object") {
      primitiveOrSimple += 1;
    } else if (Array.isArray(v) && (v.length === 0 || typeof v[0] !== "object")) {
      primitiveOrSimple += 1;
    }
  });
  return primitiveOrSimple >= Math.ceil(keys.length / 2);
}

/**
 * Automatically detect which path holds the record array.
 * Walks nested objects; property names are not fixed.
 * @param {any} parsed
 * @returns {{ path: string|null, records: any[], candidates: string[] }}
 */
function detectRecordPath(parsed) {
  if (Array.isArray(parsed)) {
    return { path: null, records: parsed, candidates: [] };
  }

  if (!isPlainObject(parsed)) {
    return { path: null, records: [], candidates: [] };
  }

  var found = [];
  collectArrayCandidates(parsed, null, 0, found);

  if (found.length === 0) {
    if (looksLikeSingleRecord(parsed)) {
      return { path: null, records: [parsed], candidates: [] };
    }
    return { path: null, records: [], candidates: [] };
  }

  found.sort(function (a, b) {
    if (b.score !== a.score) return b.score - a.score;
    if (a.depth !== b.depth) return a.depth - b.depth;
    return (b.records.length || 0) - (a.records.length || 0);
  });

  var best = found[0];
  var candidates = found.map(function (c) { return c.path; }).filter(Boolean);

  return {
    path: best.path,
    records: best.records,
    candidates: candidates,
  };
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
  // null/undefined recordPath from the UI means auto-detect (not "root array only")
  var useForced = forcedPath !== undefined && forcedPath !== null && forcedPath !== "";
  var path      = useForced ? forcedPath : detected.path;
  var records   = useForced ? getRecordsByPath(parsed, forcedPath) : detected.records;

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
