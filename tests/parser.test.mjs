import test from "node:test";
import assert from "node:assert/strict";
import { parseJson, formatJson, minifyJson, MAX_INPUT_CHARS } from "../js/parser.js";

test("parses valid JSON values", () => {
  assert.deepEqual(parseJson('{"a":1}'), { ok: true, value: { a: 1 } });
  const primitive = parseJson("null");
  assert.equal(primitive.ok, true);
  assert.equal(primitive.value, null);
});

test("rejects empty input", () => {
  const result = parseJson("   \n ");
  assert.equal(result.ok, false);
  assert.equal(result.empty, true);
});

test("reports invalid JSON line and column", () => {
  const result = parseJson('{\n  "a": }');
  assert.equal(result.ok, false);
  assert.equal(result.line, 2);
  assert.equal(typeof result.column, "number");
  assert.match(result.error, /line 2/);
});

test("strips a UTF-8 byte order mark", () => {
  const result = parseJson('\ufeff{"ok":true}');
  assert.equal(result.ok, true);
  assert.deepEqual(result.value, { ok: true });
});

test("formats and minifies valid JSON", () => {
  const formatted = formatJson('{"a":1,"b":[true,null]}');
  assert.equal(formatted.ok, true);
  assert.equal(formatted.value, '{\n  "a": 1,\n  "b": [\n    true,\n    null\n  ]\n}');

  const minified = minifyJson(formatted.value);
  assert.equal(minified.ok, true);
  assert.equal(minified.value, '{"a":1,"b":[true,null]}');
});

test("does not format invalid JSON", () => {
  const result = formatJson("{");
  assert.equal(result.ok, false);
  assert.equal(typeof result.error, "string");
});

test("blocks documents above the configured limit", () => {
  const result = parseJson("x".repeat(MAX_INPUT_CHARS + 1));
  assert.equal(result.ok, false);
  assert.equal(result.tooLarge, true);
});
