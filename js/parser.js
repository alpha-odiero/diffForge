/**
 * JSON parsing, validation and formatting helpers.
 *
 * All parsing uses JSON.parse. Nothing is evaluated and no third-party
 * parser is required, so the behaviour matches the browser's native JSON
 * implementation.
 */

export const MAX_INPUT_CHARS = 5_000_000;
export const HIGHLIGHT_INPUT_LIMIT = 100_000;

function stripByteOrderMark(text) {
  return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
}

function lineColumnAt(text, position) {
  const clamped = Math.max(0, Math.min(position, text.length));
  const before = text.slice(0, clamped);
  const line = (before.match(/\n/g) || []).length + 1;
  const lastNewline = before.lastIndexOf("\n");
  return { line, column: clamped - lastNewline };
}

function describeParseError(error, text) {
  const rawMessage = typeof error?.message === "string" ? error.message : "Invalid JSON";
  const positionMatch = rawMessage.match(/position\s+(\d+)/i);
  const position = positionMatch ? Number(positionMatch[1]) : text.length;
  const { line, column } = lineColumnAt(text, position);
  const message = rawMessage
    .replace(/\s+at position\s+\d+/i, "")
    .replace(/\s*\(line\s+\d+\s+column\s+\d+\)/i, "")
    .trim() || "Invalid JSON";

  return {
    message,
    position,
    line,
    column,
    error: `${message} at line ${line}, column ${column}.`
  };
}

/**
 * Parse text as JSON without throwing.
 * @returns {{ok: true, value: unknown} | {ok: false, error: string, message?: string, line?: number, column?: number, position?: number, empty?: boolean, tooLarge?: boolean}}
 */
export function parseJson(text) {
  if (typeof text !== "string") {
    return { ok: false, error: "Input must be text.", empty: true };
  }

  if (!text.trim()) {
    return { ok: false, error: "This editor is empty.", empty: true };
  }

  if (text.length > MAX_INPUT_CHARS) {
    return {
      ok: false,
      error: `This document is too large. The limit is ${MAX_INPUT_CHARS.toLocaleString()} characters per editor.`,
      tooLarge: true
    };
  }

  const source = stripByteOrderMark(text);

  try {
    return { ok: true, value: JSON.parse(source) };
  } catch (error) {
    return { ok: false, ...describeParseError(error, source) };
  }
}

export function formatJson(text, indent = 2) {
  const parsed = parseJson(text);
  if (!parsed.ok) return parsed;
  return { ok: true, value: JSON.stringify(parsed.value, null, indent) };
}

export function minifyJson(text) {
  const parsed = parseJson(text);
  if (!parsed.ok) return parsed;
  return { ok: true, value: JSON.stringify(parsed.value) };
}

export function countLines(text) {
  if (!text) return 0;
  return text.split("\n").length;
}
