"use strict";

const assert = require("assert");
const compEngine = require("../../src/main/services/comparison-engine");

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

console.log("\ncomparison-engine tests");

var MAPPINGS = [
  { sitefinityField: "ExternalId", jsonProperty: "ExternalId", ignore: false },
  { sitefinityField: "Title",      jsonProperty: "title",      ignore: false },
  { sitefinityField: "Price",      jsonProperty: "price",      ignore: false },
];

function run(sourceRecords, existingRecords, extra) {
  return compEngine.compare(Object.assign({
    sourceRecords,
    existingRecords,
    mappings: MAPPINGS,
    matchingKey:  "ExternalId",
    syncMode:     "upsert",
    skipUnchanged: true,
  }, extra || {}));
}

// ── Create classification ──────────────────────────────────────────────────

test("classifies new record as create", function () {
  var result = run(
    [{ ExternalId: "A1", title: "New", price: 10 }],
    []
  );
  assert.strictEqual(result.records[0].action, "create");
  assert.strictEqual(result.summary.newCount, 1);
});

// ── Update classification ──────────────────────────────────────────────────

test("classifies changed record as update", function () {
  var result = run(
    [{ ExternalId: "A1", title: "Updated", price: 20 }],
    [{ ExternalId: "A1", Title: "Old",     Price: 10 }]
  );
  assert.strictEqual(result.records[0].action, "update");
  assert.strictEqual(result.summary.modifiedCount, 1);
  assert.ok(result.records[0].changedFields.includes("Title"));
});

// ── Unchanged classification ───────────────────────────────────────────────

test("classifies identical record as skip when skipUnchanged=true", function () {
  var result = run(
    [{ ExternalId: "A1", title: "Same", price: 99 }],
    [{ ExternalId: "A1", Title: "Same", Price: 99 }]
  );
  assert.strictEqual(result.records[0].action, "skip");
  assert.strictEqual(result.summary.unchangedCount, 1);
});

// ── Missing record detection ──────────────────────────────────────────────

test("reports missing count correctly in full sync mode (deletion disabled)", function () {
  var result = run(
    [{ ExternalId: "A1", title: "One", price: 1 }],
    [
      { ExternalId: "A1", Title: "One", Price: 1 },
      { ExternalId: "A2", Title: "Two", Price: 2 },
    ],
    { syncMode: "full", deletionEnabled: false }
  );
  assert.strictEqual(result.summary.missingCount, 1);
});

test("marks missing records for deletion when full sync + deletion enabled", function () {
  var result = run(
    [{ ExternalId: "A1", title: "One", price: 1 }],
    [
      { ExternalId: "A1", Title: "One", Price: 1 },
      { ExternalId: "A2", Title: "Two", Price: 2 },
    ],
    { syncMode: "full", deletionEnabled: true }
  );
  var deleted = result.records.find(function (r) { return r.action === "delete"; });
  assert.ok(deleted);
  assert.strictEqual(deleted.externalId, "A2");
  assert.strictEqual(result.summary.deleteCount, 1);
});

// ── Conflict: missing key ─────────────────────────────────────────────────

test("marks record as conflict when matching key is missing", function () {
  var result = run(
    [{ title: "No ID", price: 5 }],
    []
  );
  assert.strictEqual(result.records[0].action, "conflict");
  assert.strictEqual(result.summary.conflictCount, 1);
});

// ── Conflict: duplicate source keys ───────────────────────────────────────

test("marks second duplicate as conflict", function () {
  var result = run(
    [
      { ExternalId: "A1", title: "First", price: 1 },
      { ExternalId: "A1", title: "Dup",   price: 2 },
    ],
    []
  );
  var conflicts = result.records.filter(function (r) { return r.action === "conflict"; });
  assert.strictEqual(conflicts.length, 1);
  assert.strictEqual(result.records[0].action, "create");
});

// ── Mode restrictions ──────────────────────────────────────────────────────

test("skips new record in update-only mode", function () {
  var result = run(
    [{ ExternalId: "NEW", title: "New", price: 1 }],
    [],
    { syncMode: "update" }
  );
  assert.strictEqual(result.records[0].action, "skip");
});

test("skips changed record in create-only mode", function () {
  var result = run(
    [{ ExternalId: "A1", title: "Changed", price: 99 }],
    [{ ExternalId: "A1", Title: "Original", Price: 1 }],
    { syncMode: "create" }
  );
  assert.strictEqual(result.records[0].action, "skip");
});

// ── Case-insensitive comparison ───────────────────────────────────────────

test("case-insensitive comparison treats different cases as equal", function () {
  var result = run(
    [{ ExternalId: "A1", title: "SUMMER", price: 1 }],
    [{ ExternalId: "A1", Title: "summer", Price: 1 }],
    { caseSensitive: false }
  );
  assert.strictEqual(result.records[0].action, "skip");
});

test("case-sensitive comparison detects case difference", function () {
  var result = run(
    [{ ExternalId: "A1", title: "SUMMER", price: 1 }],
    [{ ExternalId: "A1", Title: "summer", Price: 1 }],
    { caseSensitive: true }
  );
  assert.strictEqual(result.records[0].action, "update");
});

// ── diffFields ────────────────────────────────────────────────────────────

test("diffFields detects changed fields", function () {
  var changed = compEngine.diffFields(
    { Title: "Old", Price: 10 },
    { Title: "New", Price: 10 },
    false
  );
  assert.deepStrictEqual(changed, ["Title"]);
});

// ── normalise ────────────────────────────────────────────────────────────

test("normalise trims whitespace", function () {
  assert.strictEqual(compEngine.normalise("  hello  ", false), "hello");
});

test("normalise lowercases when caseSensitive=false", function () {
  assert.strictEqual(compEngine.normalise("Hello", false), "hello");
});

test("normalise preserves case when caseSensitive=true", function () {
  assert.strictEqual(compEngine.normalise("Hello", true), "Hello");
});

// ── Summary ────────────────────────────────────────────────────────────────
console.log(`\n  ${passed} passed, ${failed} failed\n`);
if (failed > 0) process.exit(1);
