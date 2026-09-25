"use strict";

const assert = require("assert");
const jsonParser = require("../../src/main/services/json-parser");

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

// ── parseJson ──────────────────────────────────────────────────────────────
console.log("\njson-parser tests");

test("parses root array", function () {
  var r = jsonParser.parseJson('[{"ExternalId":"A1","Title":"Test"}]');
  assert.strictEqual(r.ok, true);
  assert.strictEqual(r.rootType, "array");
  assert.strictEqual(r.totalRecords, 1);
  assert.strictEqual(r.recordPath, null);
  assert.strictEqual(r.records[0].ExternalId, "A1");
});

test("parses wrapped object (items key)", function () {
  var json = JSON.stringify({ module: "test", items: [{ ExternalId: "B1" }, { ExternalId: "B2" }] });
  var r = jsonParser.parseJson(json);
  assert.strictEqual(r.ok, true);
  assert.strictEqual(r.recordPath, "items");
  assert.strictEqual(r.totalRecords, 2);
});

test("parses OData wrapped object (value key)", function () {
  var json = JSON.stringify({ "@odata.count": 1, value: [{ Id: "GUID", Title: "Hello" }] });
  var r = jsonParser.parseJson(json);
  assert.strictEqual(r.ok, true);
  assert.strictEqual(r.recordPath, "value");
  assert.strictEqual(r.totalRecords, 1);
});

test("returns error for invalid JSON", function () {
  var r = jsonParser.parseJson("{bad json");
  assert.strictEqual(r.ok, false);
  assert.ok(r.error.includes("JSON"));
});

test("returns error for empty input", function () {
  var r = jsonParser.parseJson("   ");
  assert.strictEqual(r.ok, false);
});

test("returns error for primitive root", function () {
  var r = jsonParser.parseJson('"just a string"');
  assert.strictEqual(r.ok, false);
});

test("returns error for empty array path", function () {
  var r = jsonParser.parseJson(JSON.stringify({ meta: "x" }));
  assert.strictEqual(r.ok, false);
});

test("respects forced record path", function () {
  var json = JSON.stringify({ a: [{ id: 1 }], b: [{ id: 2 }, { id: 3 }] });
  var r = jsonParser.parseJson(json, "b");
  assert.strictEqual(r.ok, true);
  assert.strictEqual(r.totalRecords, 2);
  assert.strictEqual(r.recordPath, "b");
});

test("null forced path still auto-detects", function () {
  var json = JSON.stringify({ items: [{ ExternalId: "X1", Title: "One" }] });
  var r = jsonParser.parseJson(json, null);
  assert.strictEqual(r.ok, true);
  assert.strictEqual(r.recordPath, "items");
  assert.strictEqual(r.totalRecords, 1);
});

test("detects array under arbitrary top-level key", function () {
  var json = JSON.stringify({
    Sitefinity: [
      { Code: "US", Country: "United States" },
      { Code: "CA", Country: "Canada" },
    ],
  });
  var r = jsonParser.parseJson(json);
  assert.strictEqual(r.ok, true);
  assert.strictEqual(r.recordPath, "Sitefinity");
  assert.strictEqual(r.totalRecords, 2);
  assert.strictEqual(r.detectedFields.length, 2);
});

test("detects array nested under parent then child", function () {
  var json = JSON.stringify({
    test: {
      items: [
        { question: "Q1", answer: "A1" },
        { question: "Q2", answer: "A2" },
      ],
    },
  });
  var r = jsonParser.parseJson(json);
  assert.strictEqual(r.ok, true);
  assert.strictEqual(r.recordPath, "test.items");
  assert.strictEqual(r.totalRecords, 2);
});

test("detects array under nested parent object with arbitrary key", function () {
  var json = JSON.stringify({
    container: {
      MobileFaqs: [
        { question: "Q1", answer: "A1" },
        { question: "Q2", answer: "A2" },
        { question: "Q3", answer: "A3" },
      ],
    },
  });
  var r = jsonParser.parseJson(json);
  assert.strictEqual(r.ok, true);
  assert.strictEqual(r.recordPath, "container.MobileFaqs");
  assert.strictEqual(r.totalRecords, 3);
});

test("prefers item collection over nested field arrays inside records", function () {
  var json = JSON.stringify({
    value: [
      { Id: "1", Title: "One", Tags: [{ name: "a" }, { name: "b" }] },
      { Id: "2", Title: "Two", Tags: [{ name: "c" }] },
    ],
  });
  var r = jsonParser.parseJson(json);
  assert.strictEqual(r.ok, true);
  assert.strictEqual(r.recordPath, "value");
  assert.strictEqual(r.totalRecords, 2);
});

test("prefers richer item list when multiple arrays exist", function () {
  var json = JSON.stringify({
    meta: [{ note: "x" }],
    payload: {
      rows: [
        { ExternalId: "1", Title: "A", Active: true },
        { ExternalId: "2", Title: "B", Active: false },
        { ExternalId: "3", Title: "C", Active: true },
      ],
    },
  });
  var r = jsonParser.parseJson(json);
  assert.strictEqual(r.ok, true);
  assert.strictEqual(r.recordPath, "payload.rows");
  assert.strictEqual(r.totalRecords, 3);
});

test("treats single root object record as one item", function () {
  var json = JSON.stringify({ ExternalId: "solo", Title: "Only one", Active: true });
  var r = jsonParser.parseJson(json);
  assert.strictEqual(r.ok, true);
  assert.strictEqual(r.totalRecords, 1);
  assert.strictEqual(r.records[0].ExternalId, "solo");
});

// ── inferFields ────────────────────────────────────────────────────────────

test("infers field types correctly", function () {
  var records = [
    { name: "Alice", active: true, score: 99, date: "2026-01-15T12:00:00Z", meta: null }
  ];
  var fields = jsonParser.inferFields(records);
  var map = {};
  fields.forEach(function (f) { map[f.name] = f.type; });
  assert.strictEqual(map.name, "string");
  assert.strictEqual(map.active, "boolean");
  assert.strictEqual(map.score, "number");
  assert.strictEqual(map.date, "datetime");
  assert.strictEqual(map.meta, "null");
});

// ── findDuplicates ─────────────────────────────────────────────────────────

test("findDuplicates detects duplicate keys", function () {
  var records = [
    { ExternalId: "A1" },
    { ExternalId: "A2" },
    { ExternalId: "A1" },
  ];
  var dups = jsonParser.findDuplicates(records, "ExternalId");
  assert.deepStrictEqual(dups, ["A1"]);
});

test("findDuplicates returns empty when no duplicates", function () {
  var records = [{ ExternalId: "A1" }, { ExternalId: "A2" }];
  var dups = jsonParser.findDuplicates(records, "ExternalId");
  assert.strictEqual(dups.length, 0);
});

// ── Summary ────────────────────────────────────────────────────────────────
console.log(`\n  ${passed} passed, ${failed} failed\n`);
if (failed > 0) process.exit(1);
