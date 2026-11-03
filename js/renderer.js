const STATUS_LABELS = {
  added: "Added",
  removed: "Removed",
  changed: "Modified",
  unchanged: "Unchanged"
};

const CONTAINER_LABELS = {
  object: "Object",
  array: "Array"
};

const DEFAULT_EXPAND_LIMIT = 1500;

function makeElement(tag, className, text) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
}

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function describeContainer(value) {
  if (Array.isArray(value)) {
    return `${value.length} ${value.length === 1 ? "item" : "items"}`;
  }
  const count = isObject(value) ? Object.keys(value).length : 0;
  return `${count} ${count === 1 ? "property" : "properties"}`;
}

function primitiveText(value) {
  if (value === undefined) return "—";
  if (typeof value === "string") return JSON.stringify(value);
  if (typeof value === "number" && Object.is(value, -0)) return "-0";
  if (value === null) return "null";
  return String(value);
}

function primitiveClass(value) {
  if (value === undefined) return "is-missing";
  if (value === null) return "value-null";
  if (typeof value === "string") return "value-string";
  if (typeof value === "number") return "value-number";
  if (typeof value === "boolean") return "value-boolean";
  return "value-other";
}

function appendHighlightedText(element, text, query) {
  if (!query) {
    element.textContent = text;
    return;
  }

  const source = text.toLowerCase();
  const needle = query.toLowerCase();
  let cursor = 0;
  let found = source.indexOf(needle);

  while (found !== -1) {
    if (found > cursor) {
      element.appendChild(document.createTextNode(text.slice(cursor, found)));
    }
    const mark = makeElement("mark", "search-highlight", text.slice(found, found + needle.length));
    element.appendChild(mark);
    cursor = found + needle.length;
    found = source.indexOf(needle, cursor);
  }

  if (cursor < text.length) {
    element.appendChild(document.createTextNode(text.slice(cursor)));
  }
}

function countNodes(root) {
  let count = 0;
  const stack = [root];
  while (stack.length) {
    const node = stack.pop();
    count += 1;
    for (const child of node.children) stack.push(child);
  }
  return count;
}

function collectContainerPaths(root, target) {
  const stack = [root];
  while (stack.length) {
    const node = stack.pop();
    if (node.children.length > 0) target.add(node.path);
    for (const child of node.children) stack.push(child);
  }
}

export function renderSummary(container, summary) {
  const cards = [
    ["added", "Added"],
    ["removed", "Removed"],
    ["changed", "Modified"],
    ["unchanged", "Unchanged"]
  ];
  const fragment = document.createDocumentFragment();

  for (const [key, label] of cards) {
    const card = makeElement("div", `summary-card ${key}`);
    const value = makeElement("strong", "", String(summary[key]));
    const caption = makeElement("span", "", label);
    card.append(value, caption);
    card.setAttribute("aria-label", `${label}: ${summary[key]}`);
    fragment.appendChild(card);
  }

  container.replaceChildren(fragment);
}

export class ResultsRenderer {
  constructor({ container, count, empty, hint, onCopyPath }) {
    this.container = container;
    this.count = count;
    this.empty = empty;
    this.hint = hint;
    this.onCopyPath = onCopyPath;
    this.root = null;
    this.expanded = new Set();
    this.options = { filter: "all", query: "", hideUnchanged: false };

    this.container.addEventListener("click", event => this.handleClick(event));
  }

  setRoot(root, options = null) {
    if (options) this.options = { ...this.options, ...options };
    this.root = root;
    this.expanded.clear();

    const nodeCount = countNodes(root);
    if (nodeCount <= DEFAULT_EXPAND_LIMIT) {
      collectContainerPaths(root, this.expanded);
    } else if (root.children.length > 0) {
      this.expanded.add(root.path);
    }

    this.largeComparison = nodeCount > DEFAULT_EXPAND_LIMIT;
    this.render();
  }

  setOptions(nextOptions) {
    const previousFilter = this.options.filter;
    const previousQuery = this.options.query;
    const previousHide = this.options.hideUnchanged;
    this.options = { ...this.options, ...nextOptions };

    if (
      this.root &&
      (this.options.filter !== previousFilter ||
        this.options.query !== previousQuery ||
        this.options.hideUnchanged !== previousHide) &&
      this.isFiltering()
    ) {
      const analysis = this.analyze();
      for (const path of analysis.ancestors) this.expanded.add(path);
    }

    this.render();
  }

  expandAll() {
    if (!this.root) return;
    collectContainerPaths(this.root, this.expanded);
    this.render();
  }

  collapseAll() {
    this.expanded.clear();
    this.render();
  }

  isFiltering() {
    return this.options.filter !== "all" || this.options.query.trim() !== "";
  }

  matchesEntry(node) {
    if (!node.isDiffEntry) return false;
    if (this.options.hideUnchanged && node.status === "unchanged") return false;
    if (this.options.filter !== "all" && node.status !== this.options.filter) return false;

    const query = this.options.query.trim().toLowerCase();
    if (query && !node.path.toLowerCase().includes(query)) return false;
    return true;
  }

  analyze() {
    const result = { count: 0, relevant: new Set(), ancestors: new Set() };

    const visit = (node, ancestorPaths) => {
      const selfMatch = this.matchesEntry(node);
      if (selfMatch) {
        result.count += 1;
        result.relevant.add(node.path);
        for (const path of ancestorPaths) result.ancestors.add(path);
      }

      let childMatch = false;
      if (node.children.length > 0) {
        const nextAncestors = [...ancestorPaths, node.path];
        for (const child of node.children) {
          if (visit(child, nextAncestors)) childMatch = true;
        }
      }

      if (selfMatch || childMatch) result.relevant.add(node.path);
      return selfMatch || childMatch;
    };

    visit(this.root, []);
    return result;
  }

  render() {
    if (!this.root) return;

    const analysis = this.analyze();
    const fragment = document.createDocumentFragment();
    const header = makeElement("div", "diff-header");
    header.setAttribute("role", "row");
    header.append(
      makeElement("span", "diff-header-cell", "Path"),
      makeElement("span", "diff-header-cell", "Original"),
      makeElement("span", "diff-header-cell", "Updated")
    );
    fragment.appendChild(header);

    const filtering = this.isFiltering();

    const visit = node => {
      if (filtering) {
        if (!analysis.relevant.has(node.path)) return;
      } else if (this.options.hideUnchanged && node.status === "unchanged") {
        return;
      }

      fragment.appendChild(this.renderRow(node));

      if (node.children.length > 0 && this.expanded.has(node.path)) {
        for (const child of node.children) visit(child);
      }
    };

    visit(this.root);
    this.container.replaceChildren(fragment);

    const label = analysis.count === 1 ? "1 entry" : `${analysis.count} entries`;
    this.count.textContent = label;
    this.empty.hidden = analysis.count !== 0;
    this.empty.textContent = this.emptyMessage();
    this.hint.hidden = !this.largeComparison || filtering;
  }

  emptyMessage() {
    if (this.options.query.trim()) {
      return "No entries match your search.";
    }
    if (this.options.hideUnchanged) {
      return "No changed entries to show. Turn off “Hide unchanged” to inspect identical values.";
    }
    if (this.options.filter !== "all") {
      return "No entries in this category.";
    }
    return "No difference entries to display.";
  }

  renderRow(node) {
    const row = makeElement(
      "div",
      `diff-row status-${node.status}${node.children.length > 0 ? " is-container" : ""}`
    );
    row.setAttribute("role", "row");

    const pathCell = makeElement("div", "diff-cell diff-path-cell");
    pathCell.setAttribute("role", "rowheader");
    const pathLine = makeElement("div", "diff-path-line");
    pathLine.style.setProperty("--depth", String(node.depth));

    const toggleSlot = makeElement("span", "tree-toggle-slot");
    if (node.children.length > 0) {
      const expanded = this.expanded.has(node.path);
      const toggle = makeElement("button", "tree-toggle", expanded ? "▾" : "▸");
      toggle.type = "button";
      toggle.dataset.togglePath = node.path;
      toggle.setAttribute("aria-expanded", String(expanded));
      toggle.setAttribute("aria-label", `${expanded ? "Collapse" : "Expand"} ${node.path}`);
      toggle.title = `${expanded ? "Collapse" : "Expand"} ${node.path}`;
      toggleSlot.appendChild(toggle);
    }

    const isTraversalContainer = !node.isDiffEntry && node.children.length > 0;
    const pillLabel = node.isDiffEntry
      ? STATUS_LABELS[node.status]
      : CONTAINER_LABELS[node.kind] || "Value";
    const pillClass = isTraversalContainer ? "container" : node.status;
    const pill = makeElement("span", `diff-pill ${pillClass}`, pillLabel);

    const pathCode = makeElement("code", "diff-path");
    appendHighlightedText(pathCode, node.path, this.options.query.trim());

    const copy = makeElement("button", "path-copy", "Copy");
    copy.type = "button";
    copy.dataset.copyPath = node.path;
    copy.setAttribute("aria-label", `Copy path ${node.path}`);
    copy.title = `Copy path ${node.path}`;

    pathLine.append(toggleSlot, pill, pathCode, copy);
    pathCell.appendChild(pathLine);

    const oldCell = this.renderValueCell(node, "old");
    const newCell = this.renderValueCell(node, "new");

    row.append(pathCell, oldCell, newCell);
    return row;
  }

  renderValueCell(node, side) {
    const present = side === "old" ? node.oldPresent : node.newPresent;
    const value = side === "old" ? node.oldValue : node.newValue;
    const cell = makeElement("div", "diff-cell diff-value-cell");
    cell.setAttribute("role", "cell");
    cell.dataset.label = side === "old" ? "Original" : "Updated";

    if (node.status === "added") {
      cell.classList.add(side === "old" ? "is-missing" : "is-added");
    } else if (node.status === "removed") {
      cell.classList.add(side === "old" ? "is-removed" : "is-missing");
    } else if (node.status === "changed") {
      cell.classList.add(side === "old" ? "is-removed" : "is-added");
    }

    if (!present) {
      cell.appendChild(makeElement("span", "value-missing", "—"));
      cell.setAttribute("aria-label", side === "old" ? "Not present in original" : "Not present in updated");
      return cell;
    }

    if ((node.kind === "object" || node.kind === "array") && node.oldPresent && node.newPresent) {
      const summary = makeElement("div", "value-container");
      summary.append(
        makeElement("span", "value-container-kind", CONTAINER_LABELS[node.kind]),
        makeElement("span", "value-container-count", describeContainer(value))
      );
      cell.appendChild(summary);
      return cell;
    }

    if (value !== null && typeof value === "object") {
      const pre = makeElement("pre", "value-json");
      pre.textContent = JSON.stringify(value, null, 2);
      cell.appendChild(pre);
      return cell;
    }

    const primitive = makeElement("code", `value-primitive ${primitiveClass(value)}`, primitiveText(value));
    cell.appendChild(primitive);
    return cell;
  }

  handleClick(event) {
    const toggle = event.target.closest(".tree-toggle");
    if (toggle && this.container.contains(toggle)) {
      const path = toggle.dataset.togglePath;
      if (this.expanded.has(path)) this.expanded.delete(path);
      else this.expanded.add(path);
      this.render();
      return;
    }

    const copyButton = event.target.closest(".path-copy");
    if (copyButton && this.container.contains(copyButton)) {
      const path = copyButton.dataset.copyPath;
      Promise.resolve(this.onCopyPath?.(path)).then(copied => {
        if (!copied || !copyButton.isConnected) return;
        const original = copyButton.textContent;
        copyButton.textContent = "Copied";
        window.setTimeout(() => {
          if (copyButton.isConnected) copyButton.textContent = original;
        }, 1200);
      });
    }
  }
}
