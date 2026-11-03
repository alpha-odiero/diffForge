import { countLines, HIGHLIGHT_INPUT_LIMIT, parseJson } from "./parser.js";
import { highlightJson } from "./highlighter.js";

const MAX_RENDERED_LINE_NUMBERS = 20_000;
const REFRESH_DELAY = 140;

/**
 * JSON editor with a highlighted layer, line numbers, validation and
 * editor-specific counts.
 */
export class JsonEditor {
  constructor({ root, input, highlight, lineNumbers, placeholder, status, count, onChange }) {
    this.root = root;
    this.input = input;
    this.highlight = highlight;
    this.lineNumbers = lineNumbers;
    this.placeholder = placeholder;
    this.status = status;
    this.count = count;
    this.onChange = onChange;
    this.lastLineCount = -1;
    this.refreshTimer = 0;

    this.input.addEventListener("input", () => this.handleInput());
    this.input.addEventListener("scroll", () => this.syncScroll(), { passive: true });
    this.input.addEventListener("keydown", event => this.handleKeydown(event));

    this.refreshNow({ highlightNow: false });
  }

  get value() {
    return this.input.value;
  }

  set value(nextValue) {
    this.setValue(nextValue);
  }

  getValue() {
    return this.input.value;
  }

  setValue(nextValue) {
    const previous = this.input.value;
    this.input.value = typeof nextValue === "string" ? nextValue : "";
    this.refreshNow();
    if (this.input.value !== previous) this.onChange?.(this);
  }

  focus() {
    this.input.focus();
  }

  validate() {
    const parsed = parseJson(this.input.value);
    this.applyValidation(parsed);
    return parsed;
  }

  handleInput() {
    this.updateMeta();
    window.clearTimeout(this.refreshTimer);
    this.refreshTimer = window.setTimeout(() => this.refreshNow(), REFRESH_DELAY);
    this.onChange?.(this);
  }

  handleKeydown(event) {
    if (
      event.key === "Tab" &&
      !event.shiftKey &&
      !event.ctrlKey &&
      !event.altKey &&
      !event.metaKey
    ) {
      event.preventDefault();
      this.input.setRangeText("  ", this.input.selectionStart, this.input.selectionEnd, "end");
      this.input.dispatchEvent(new Event("input", { bubbles: true }));
    }
  }

  refreshNow({ highlightNow = true } = {}) {
    this.updateMeta();
    const parsed = parseJson(this.input.value);
    this.applyValidation(parsed);

    if (highlightNow) {
      this.renderHighlight();
    } else {
      window.clearTimeout(this.refreshTimer);
      this.refreshTimer = window.setTimeout(() => this.renderHighlight(), REFRESH_DELAY);
    }

    return parsed;
  }

  updateMeta() {
    const text = this.input.value;
    const lines = countLines(text);
    const characters = text.length;

    this.count.textContent = `${characters.toLocaleString()} ${characters === 1 ? "char" : "chars"} · ${lines.toLocaleString()} ${lines === 1 ? "line" : "lines"}`;
    this.placeholder.hidden = text.length > 0;

    if (lines !== this.lastLineCount) {
      this.renderLineNumbers(lines);
      this.lastLineCount = lines;
    }
  }

  renderLineNumbers(lineCount) {
    const canRender = lineCount > 0 && lineCount <= MAX_RENDERED_LINE_NUMBERS;
    this.lineNumbers.parentElement.hidden = !canRender;

    if (!canRender) {
      this.lineNumbers.replaceChildren();
      return;
    }

    const fragment = document.createDocumentFragment();
    for (let line = 1; line <= lineCount; line += 1) {
      const item = document.createElement("div");
      item.className = "line-number";
      item.textContent = String(line);
      fragment.appendChild(item);
    }

    this.lineNumbers.replaceChildren(fragment);
    const digits = Math.max(2, String(lineCount).length);
    this.lineNumbers.parentElement.style.setProperty("--line-digits", String(digits));
    this.syncScroll();
  }

  renderHighlight() {
    const text = this.input.value;

    if (!text) {
      this.highlight.replaceChildren();
      return;
    }

    if (text.length > HIGHLIGHT_INPUT_LIMIT) {
      this.highlight.textContent = text;
      this.highlight.classList.add("is-plain");
      return;
    }

    this.highlight.classList.remove("is-plain");
    highlightJson(this.highlight, text);
    this.syncScroll();
  }

  applyValidation(parsed) {
    const invalid = !parsed.ok && !parsed.empty;
    this.root.classList.toggle("is-invalid", invalid);
    this.root.classList.toggle("is-valid", parsed.ok);
    this.input.setAttribute("aria-invalid", String(invalid));

    if (parsed.ok) {
      this.status.textContent = "Valid JSON";
      this.status.title = "Valid JSON";
      this.status.dataset.state = "valid";
      return;
    }

    if (parsed.empty) {
      this.status.textContent = "Waiting for input";
      this.status.title = "Paste or type JSON to begin.";
      this.status.dataset.state = "empty";
      return;
    }

    this.status.dataset.state = "invalid";
    if (parsed.tooLarge) {
      this.status.textContent = "Document too large";
      this.status.title = parsed.error;
      return;
    }

    this.status.textContent = `Invalid JSON · line ${parsed.line}, column ${parsed.column}`;
    this.status.title = parsed.error;
  }

  syncScroll() {
    this.highlight.scrollTop = this.input.scrollTop;
    this.highlight.scrollLeft = this.input.scrollLeft;
    if (!this.lineNumbers.parentElement.hidden) {
      this.lineNumbers.parentElement.scrollTop = this.input.scrollTop;
    }
  }
}
