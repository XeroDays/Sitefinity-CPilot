"use strict";

const assert = require("assert");
const fieldMapper = require("../../src/main/services/field-mapper");

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log("  ✓", name);
    passed++;
  } catch (err) {
    console.error("  ✗", name);
    console.error("   ", err.message);
    failed++;
  }
}

console.log("\nfield-mapper tests");

var sfFields   = [
  { name: "ExternalId", type: "string" },
  { name: "Title",      type: "string" },
  { name: "IsActive",   type: "boolean" },
  { name: "Price",      type: "number" },
];

var jsonFields = [
  { name: "ExternalId",   type: "string" },
  { name: "title",        type: "string" },  // different case
  { name: "isActive",     type: "boolean" }, // different case
  { name: "price",        type: "number" },  // different case
];

// ── autoMap ────────────────────────────────────────────────────────────────

test("exact match maps ExternalId", function () {
  var mappings = fieldMapper.autoMap(sfFields, jsonFields);
  var m = mappings.find(function (m) { return m.sitefinityField === "ExternalId"; });
  assert.strictEqual(m.jsonProperty, "ExternalId");
  assert.strictEqual(m.matchType, "exact");
});

test("case-insensitive match maps Title to title", function () {
  var mappings = fieldMapper.autoMap(sfFields, jsonFields);
  var m = mappings.find(function (m) { return m.sitefinityField === "Title"; });
  assert.strictEqual(m.jsonProperty, "title");
  assert.strictEqual(m.matchType, "case-insensitive");
});

test("case-insensitive match maps IsActive to isActive", function () {
  var mappings = fieldMapper.autoMap(sfFields, jsonFields);
  var m = mappings.find(function (m) { return m.sitefinityField === "IsActive"; });
  assert.strictEqual(m.jsonProperty, "isActive");
});

test("no match produces null jsonProperty", function () {
  var mappings = fieldMapper.autoMap(
    [{ name: "Description", type: "string" }],
    [{ name: "title", type: "string" }]
  );
  var m = mappings[0];
  assert.strictEqual(m.jsonProperty, null);
  assert.strictEqual(m.matchType, "none");
});

// ── applyMappings ──────────────────────────────────────────────────────────

test("applyMappings maps values using jsonProperty", function () {
  var mappings = [
    { sitefinityField: "Title", jsonProperty: "title", ignore: false },
    { sitefinityField: "Price", jsonProperty: "price", ignore: false },
  ];
  var record = { title: "Summer Collection", price: 99.99 };
  var result = fieldMapper.applyMappings(mappings, record);
  assert.strictEqual(result.Title, "Summer Collection");
  assert.strictEqual(result.Price, 99.99);
});

test("applyMappings skips ignored fields", function () {
  var mappings = [
    { sitefinityField: "Title", jsonProperty: "title", ignore: false },
    { sitefinityField: "Hidden", jsonProperty: "hidden", ignore: true },
  ];
  var record = { title: "T", hidden: "X" };
  var result = fieldMapper.applyMappings(mappings, record);
  assert.strictEqual(result.Title, "T");
  assert.strictEqual(result.Hidden, undefined);
});

test("applyMappings uses defaultValue when jsonProperty is null", function () {
  var mappings = [
    { sitefinityField: "Status", jsonProperty: null, ignore: false, defaultValue: "active" },
  ];
  var result = fieldMapper.applyMappings(mappings, {});
  assert.strictEqual(result.Status, "active");
});

// ── getMatchingKeyValue ────────────────────────────────────────────────────

test("getMatchingKeyValue resolves via mapping", function () {
  var mappings = [
    { sitefinityField: "ExternalId", jsonProperty: "externalId", ignore: false },
  ];
  var record = { externalId: "MLC-001" };
  var val = fieldMapper.getMatchingKeyValue(record, "ExternalId", mappings);
  assert.strictEqual(val, "MLC-001");
});

test("getMatchingKeyValue falls back to direct lookup when no mapping", function () {
  var val = fieldMapper.getMatchingKeyValue({ ExternalId: "MLC-002" }, "ExternalId", []);
  assert.strictEqual(val, "MLC-002");
});

// ── validateMappings ───────────────────────────────────────────────────────

test("validateMappings returns issue when matching key unmapped", function () {
  var mappings = [
    { sitefinityField: "Title", jsonProperty: "title", ignore: false },
  ];
  var issues = fieldMapper.validateMappings(mappings, "ExternalId");
  assert.strictEqual(issues.length, 1);
  assert.ok(issues[0].issue.includes("ExternalId"));
});

test("validateMappings returns no issues when matching key is mapped", function () {
  var mappings = [
    { sitefinityField: "ExternalId", jsonProperty: "ExternalId", ignore: false },
  ];
  var issues = fieldMapper.validateMappings(mappings, "ExternalId");
  assert.strictEqual(issues.length, 0);
});

// ── Summary ────────────────────────────────────────────────────────────────
console.log(`\n  ${passed} passed, ${failed} failed\n`);
if (failed > 0) process.exit(1);
