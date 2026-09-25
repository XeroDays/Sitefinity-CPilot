/**
 * field-mapper.js — Map JSON properties to Sitefinity module fields.
 *
 * Matching priority:
 *   1. Exact name match (case-sensitive)
 *   2. Case-insensitive name match
 *   3. No automatic match — user must select manually
 *
 * A "mapping" object has this shape:
 * {
 *   sitefinityField: string,    // target field name in Sitefinity
 *   fieldType:       string,    // Sitefinity field type (from module metadata)
 *   jsonProperty:    string|null, // mapped JSON property name (null = unmapped)
 *   ignore:          boolean,   // true = skip this field during sync
 *   defaultValue:    any,       // value to use when jsonProperty is null/missing
 * }
 */

"use strict";

// ── Auto-map ───────────────────────────────────────────────────────────────

/**
 * Automatically map JSON properties to Sitefinity fields.
 *
 * @param {{ name: string, type: string }[]} sitefinityFields
 * @param {{ name: string, type: string }[]} jsonFields
 * @returns {object[]} mapping array
 */
function autoMap(sitefinityFields, jsonFields) {
  var jsonNames = jsonFields.map(function (f) { return f.name; });

  return sitefinityFields.map(function (sf) {
    // 1. Exact match
    var exact = jsonNames.find(function (jn) { return jn === sf.name; });
    if (exact !== undefined) {
      return buildMapping(sf, exact, "exact");
    }

    // 2. Case-insensitive match
    var lower = sf.name.toLowerCase();
    var caseMatch = jsonNames.find(function (jn) { return jn.toLowerCase() === lower; });
    if (caseMatch !== undefined) {
      return buildMapping(sf, caseMatch, "case-insensitive");
    }

    // 3. No match
    return buildMapping(sf, null, "none");
  });
}

function buildMapping(sfField, jsonProperty, matchType) {
  return {
    sitefinityField: sfField.name,
    fieldType:       sfField.type || "string",
    jsonProperty:    jsonProperty || null,
    ignore:          false,
    defaultValue:    null,
    matchType:       matchType, // 'exact' | 'case-insensitive' | 'none'
  };
}

// ── Resolve mapped value ───────────────────────────────────────────────────

/**
 * Given a mapping configuration and a source record, resolve the final value
 * to be sent to Sitefinity.
 *
 * @param {object} mapping
 * @param {object} record
 * @returns {any}
 */
function resolveValue(mapping, record) {
  if (mapping.ignore) return undefined; // signal: omit this field

  var raw = mapping.jsonProperty !== null && mapping.jsonProperty !== undefined
    ? record[mapping.jsonProperty]
    : undefined;

  if (raw === undefined || raw === null) {
    return mapping.defaultValue !== undefined ? mapping.defaultValue : null;
  }

  return raw;
}

/**
 * Apply mappings to a source record, returning an object of Sitefinity field
 * values. Fields with mapping.ignore = true are omitted.
 *
 * @param {object[]} mappings
 * @param {object} record
 * @returns {object}
 */
function applyMappings(mappings, record) {
  var result = {};
  mappings.forEach(function (m) {
    if (m.ignore) return;
    var val = resolveValue(m, record);
    result[m.sitefinityField] = val;
  });
  return result;
}

/**
 * Get the value of the matching key from a source record.
 * @param {object} record
 * @param {string} matchingKey - Sitefinity field name
 * @param {object[]} mappings
 * @returns {string|null}
 */
function getMatchingKeyValue(record, matchingKey, mappings) {
  // Find the mapping for the matching key
  var mapping = mappings.find(function (m) { return m.sitefinityField === matchingKey; });
  if (!mapping) {
    // Fall back to direct lookup
    return record[matchingKey] !== undefined ? String(record[matchingKey]) : null;
  }
  var val = resolveValue(mapping, record);
  return val !== null && val !== undefined ? String(val) : null;
}

/**
 * Validate all mappings and return an array of validation issues.
 * @param {object[]} mappings
 * @param {string} matchingKey
 * @returns {{ field: string, issue: string }[]}
 */
function validateMappings(mappings, matchingKey) {
  var issues = [];

  // Check matching key is mapped
  var keyMapping = mappings.find(function (m) {
    return m.sitefinityField === matchingKey && !m.ignore;
  });

  if (!keyMapping) {
    issues.push({ field: matchingKey, issue: "The matching key field '" + matchingKey + "' has no active mapping. Records cannot be matched without it." });
  } else if (!keyMapping.jsonProperty) {
    issues.push({ field: matchingKey, issue: "The matching key field '" + matchingKey + "' is not mapped to any JSON property." });
  }

  return issues;
}

module.exports = {
  autoMap,
  resolveValue,
  applyMappings,
  getMatchingKeyValue,
  validateMappings,
};
