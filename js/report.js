import { collectDifferenceEntries, summarizeDifferences } from "./comparator.js";

const LABELS = {
  added: "ADDED",
  removed: "REMOVED",
  changed: "MODIFIED",
  unchanged: "UNCHANGED"
};

function printable(value) {
  if (value === undefined) return "(missing)";
  if (typeof value === "string") return JSON.stringify(value);
  if (typeof value === "number" && Object.is(value, -0)) return "-0";
  if (value === null || typeof value !== "object") return String(value);

  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return "[unserializable value]";
  }
}

function indentBlock(text, prefix) {
  return text.split("\n").map(line => `${prefix}${line}`).join("\n");
}

function formatValue(value) {
  const text = printable(value);
  if (text === "(missing)") return text;
  return indentBlock(text, "    ");
}

/**
 * Build a plain-text comparison report. Unchanged values are intentionally
 * omitted; the summary keeps their total.
 */
export function buildTextReport(root) {
  const summary = summarizeDifferences(root);
  const entries = collectDifferenceEntries(root, { includeUnchanged: false });
  const lines = [
    "DiffForge — comparison report",
    `Generated: ${new Date().toISOString()}`,
    "",
    "Summary",
    `  Added:     ${summary.added}`,
    `  Removed:   ${summary.removed}`,
    `  Modified:  ${summary.changed}`,
    `  Unchanged: ${summary.unchanged}`,
    ""
  ];

  if (entries.length === 0) {
    lines.push("No differences found.");
    if (summary.unchanged > 0) {
      lines.push("All compared values are unchanged.");
    }
    return lines.join("\n");
  }

  lines.push("Differences");
  lines.push("Unchanged values are omitted.");
  lines.push("");

  for (const entry of entries) {
    lines.push(`${LABELS[entry.status]} ${entry.path}`);
    lines.push(`  Original: ${formatValue(entry.oldValue)}`);
    lines.push(`  Updated:  ${formatValue(entry.newValue)}`);
    lines.push("");
  }

  return lines.join("\n").trimEnd() + "\n";
}

export { printable };
