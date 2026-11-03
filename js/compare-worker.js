import { parseJson } from "./parser.js";
import { compareJson, summarizeDifferences } from "./comparator.js";

self.onmessage = event => {
  const { leftText, rightText } = event.data || {};
  const left = parseJson(leftText);
  const right = parseJson(rightText);

  if (!left.ok || !right.ok) {
    self.postMessage({
      ok: false,
      leftError: left.ok ? null : left,
      rightError: right.ok ? null : right
    });
    return;
  }

  try {
    const root = compareJson(left.value, right.value);
    self.postMessage({
      ok: true,
      root,
      summary: summarizeDifferences(root)
    });
  } catch (error) {
    self.postMessage({
      ok: false,
      fatalError: error instanceof Error ? error.message : "Comparison failed."
    });
  }
};
