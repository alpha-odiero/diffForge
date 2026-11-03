import test from "node:test";
import assert from "node:assert/strict";
import {
  compareJson,
  collectDifferenceEntries,
  summarizeDifferences
} from "../js/comparator.js";

function entries(oldValue, newValue, includeUnchanged = false) {
  return collectDifferenceEntries(compareJson(oldValue, newValue), { includeUnchanged });
}

function byPath(root) {
  return new Map(entries(root[0], root[1], true).map(entry => [entry.path, entry]));
}

test("identical primitives are one unchanged entry", () => {
  const root = compareJson(42, 42);
  assert.deepEqual(summarizeDifferences(root), { added: 0, removed: 0, changed: 0, unchanged: 1 });
  assert.equal(root.path, "$");
  assert.equal(root.status, "unchanged");
});

test("detects added nested properties", () => {
  const result = entries({ user: { name: "Ada" } }, { user: { name: "Ada", role: "admin" } });
  assert.equal(result.length, 1);
  assert.equal(result[0].path, "$.user.role");
  assert.equal(result[0].status, "added");
  assert.equal(result[0].newValue, "admin");
});

test("detects removed nested properties", () => {
  const result = entries({ user: { name: "Ada", role: "admin" } }, { user: { name: "Ada" } });
  assert.equal(result.length, 1);
  assert.equal(result[0].path, "$.user.role");
  assert.equal(result[0].status, "removed");
  assert.equal(result[0].oldValue, "admin");
});

test("detects modified primitives including type changes", () => {
  const root = compareJson({ count: 1, enabled: false, name: "x" }, { count: "1", enabled: true, name: "x" });
  const summary = summarizeDifferences(root);
  assert.deepEqual(summary, { added: 0, removed: 0, changed: 2, unchanged: 1 });
  const map = byPath([{ count: 1, enabled: false, name: "x" }, { count: "1", enabled: true, name: "x" }]);
  assert.equal(map.get("$.count").status, "changed");
  assert.equal(map.get("$.enabled").status, "changed");
});

test("distinguishes a missing property from a null value", () => {
  const removed = entries({ value: null }, {});
  assert.equal(removed[0].status, "removed");
  assert.equal(removed[0].oldValue, null);
  assert.equal(removed[0].newValue, undefined);

  const added = entries({}, { value: null });
  assert.equal(added[0].status, "added");
  assert.equal(added[0].newValue, null);
  assert.equal(added[0].oldPresent, false);
  assert.equal(added[0].newPresent, true);
});

test("compares arrays by index", () => {
  const result = entries(
    { tags: ["a", "b", "c"], nested: [{ id: 1 }] },
    { tags: ["a", "B"], nested: [{ id: 2 }, { id: 3 }] }
  );
  const paths = result.map(entry => `${entry.status}:${entry.path}`).sort();
  assert.deepEqual(paths, [
    "added:$.nested[1]",
    "changed:$.nested[0].id",
    "changed:$.tags[1]",
    "removed:$.tags[2]"
  ]);
});

test("handles empty objects and arrays", () => {
  const emptyObjects = compareJson({}, {});
  assert.deepEqual(summarizeDifferences(emptyObjects), { added: 0, removed: 0, changed: 0, unchanged: 1 });

  const emptyArrays = compareJson([], []);
  assert.deepEqual(summarizeDifferences(emptyArrays), { added: 0, removed: 0, changed: 0, unchanged: 1 });

  const typeChange = compareJson({}, []);
  assert.equal(typeChange.status, "changed");
  assert.equal(typeChange.isDiffEntry, true);
});

test("added and removed containers count as one property entry", () => {
  const root = compareJson({}, { meta: { a: 1, b: 2 }, list: [1, 2] });
  assert.deepEqual(summarizeDifferences(root), { added: 2, removed: 0, changed: 0, unchanged: 0 });
  const result = collectDifferenceEntries(root, { includeUnchanged: false });
  assert.equal(result.length, 2);
  assert.equal(result.every(entry => entry.status === "added"), true);
  assert.deepEqual(result.map(entry => entry.path).sort(), ["$.list", "$.meta"]);
});

test("unchanged containers report unchanged leaves", () => {
  const root = compareJson({ a: { b: 1, c: [true, null] } }, { a: { b: 1, c: [true, null] } });
  assert.deepEqual(summarizeDifferences(root), { added: 0, removed: 0, changed: 0, unchanged: 3 });
});

test("uses bracket notation for keys that are not identifiers", () => {
  const result = entries({ "delivery.window": "09:00" }, { "delivery.window": "10:00", "a b": 1 });
  const paths = result.map(entry => entry.path).sort();
  assert.deepEqual(paths, ['$["a b"]', '$["delivery.window"]']);
});

test("detects deeply nested changes", () => {
  const oldValue = { a: { b: { c: { d: [{ e: 1 }] } } } };
  const newValue = { a: { b: { c: { d: [{ e: 2 }] } } } };
  const result = entries(oldValue, newValue);
  assert.equal(result.length, 1);
  assert.equal(result[0].path, "$.a.b.c.d[0].e");
  assert.equal(result[0].status, "changed");
});
