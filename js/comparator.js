/**
 * Recursive JSON comparison.
 *
 * Arrays are compared by index. Objects are compared by key. Every node in
 * the returned tree has a stable path such as `$.user.name` or `$.tags[0]`.
 *
 * Difference entries:
 * - added: present only in the updated document
 * - removed: present only in the original document
 * - changed: present in both documents with a different value or type
 * - unchanged: present in both documents with an identical value
 *
 * Objects and arrays that exist in both documents are traversal containers;
 * their changed descendants are counted as entries, not the container itself.
 * Added or removed subtrees are represented by their root property entry,
 * which keeps the summary focused on user-visible changes.
 */

const SAFE_KEY = /^[A-Za-z_$][A-Za-z0-9_$]*$/;

export const ROOT_PATH = "$";

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function hasOwn(value, key) {
  return Object.prototype.hasOwnProperty.call(value, key);
}

function pathForKey(basePath, key) {
  return SAFE_KEY.test(key)
    ? `${basePath}.${key}`
    : `${basePath}[${JSON.stringify(key)}]`;
}

function pathForIndex(basePath, index) {
  return `${basePath}[${index}]`;
}

function kindOf(value) {
  if (Array.isArray(value)) return "array";
  if (isRecord(value)) return "object";
  return "value";
}

function createNode({
  path,
  key,
  depth,
  kind,
  status,
  oldValue,
  newValue,
  oldPresent,
  newPresent,
  children = []
}) {
  return {
    path,
    key,
    depth,
    kind,
    status,
    oldValue,
    newValue,
    oldPresent,
    newPresent,
    children,
    isDiffEntry: false
  };
}

function buildComparison(oldValue, newValue, path, key, depth, oldPresent, newPresent) {
  if (!oldPresent) {
    const node = createNode({
      path,
      key,
      depth,
      kind: kindOf(newValue),
      status: "added",
      oldValue: undefined,
      newValue,
      oldPresent: false,
      newPresent: true
    });
    node.isDiffEntry = true;
    return node;
  }

  if (!newPresent) {
    const node = createNode({
      path,
      key,
      depth,
      kind: kindOf(oldValue),
      status: "removed",
      oldValue,
      newValue: undefined,
      oldPresent: true,
      newPresent: false
    });
    node.isDiffEntry = true;
    return node;
  }

  const oldIsObject = isRecord(oldValue);
  const newIsObject = isRecord(newValue);
  const oldIsArray = Array.isArray(oldValue);
  const newIsArray = Array.isArray(newValue);

  if (oldIsObject && newIsObject) {
    const keys = [...new Set([...Object.keys(oldValue), ...Object.keys(newValue)])].sort();
    const children = keys.map(childKey => {
      const childPath = pathForKey(path, childKey);
      return buildComparison(
        oldValue[childKey],
        newValue[childKey],
        childPath,
        childKey,
        depth + 1,
        hasOwn(oldValue, childKey),
        hasOwn(newValue, childKey)
      );
    });

    const node = createNode({
      path,
      key,
      depth,
      kind: "object",
      status: children.some(child => child.status !== "unchanged") ? "changed" : "unchanged",
      oldValue,
      newValue,
      oldPresent: true,
      newPresent: true,
      children
    });
    node.isDiffEntry = children.length === 0;
    return node;
  }

  if (oldIsArray && newIsArray) {
    const length = Math.max(oldValue.length, newValue.length);
    const children = [];

    for (let index = 0; index < length; index += 1) {
      children.push(buildComparison(
        oldValue[index],
        newValue[index],
        pathForIndex(path, index),
        String(index),
        depth + 1,
        index < oldValue.length,
        index < newValue.length
      ));
    }

    const node = createNode({
      path,
      key,
      depth,
      kind: "array",
      status: children.some(child => child.status !== "unchanged") ? "changed" : "unchanged",
      oldValue,
      newValue,
      oldPresent: true,
      newPresent: true,
      children
    });
    node.isDiffEntry = children.length === 0;
    return node;
  }

  const unchanged = Object.is(oldValue, newValue);
  const node = createNode({
    path,
    key,
    depth,
    kind: "value",
    status: unchanged ? "unchanged" : "changed",
    oldValue,
    newValue,
    oldPresent: true,
    newPresent: true
  });
  node.isDiffEntry = true;
  return node;
}

/**
 * Compare two parsed JSON values and return the root of a difference tree.
 */
export function compareJson(oldValue, newValue) {
  return buildComparison(oldValue, newValue, ROOT_PATH, null, 0, true, true);
}

function walkEntries(root, callback) {
  const stack = [root];

  while (stack.length > 0) {
    const node = stack.pop();
    if (!node) continue;
    callback(node);
    for (let index = node.children.length - 1; index >= 0; index -= 1) {
      stack.push(node.children[index]);
    }
  }
}

/**
 * Count difference entries. Unchanged values are included so the summary can
 * show how much identical data was traversed.
 */
export function summarizeDifferences(root) {
  const summary = { added: 0, removed: 0, changed: 0, unchanged: 0 };

  walkEntries(root, node => {
    if (node.isDiffEntry && Object.prototype.hasOwnProperty.call(summary, node.status)) {
      summary[node.status] += 1;
    }
  });

  return summary;
}

/**
 * Return a flat, depth-first list of difference entries.
 * Unchanged values are excluded by default for reports.
 */
export function collectDifferenceEntries(root, { includeUnchanged = false } = {}) {
  const entries = [];

  walkEntries(root, node => {
    if (!node.isDiffEntry) return;
    if (!includeUnchanged && node.status === "unchanged") return;
    entries.push(node);
  });

  return entries;
}

/* Backwards-compatible alias for callers that used the original module. */
export { summarizeDifferences as summarize };
