import { parseJson, formatJson, minifyJson } from "./parser.js";
import { compareJson, summarizeDifferences } from "./comparator.js";
import { renderSummary, ResultsRenderer } from "./renderer.js";
import { buildTextReport } from "./report.js";
import { copyText } from "./clipboard.js";
import { downloadFile } from "./download.js";
import { JsonEditor } from "./editor.js";
import { samples, getSample } from "./samples.js";

const WORKER_THRESHOLD = 200_000;
const SEARCH_DELAY = 120;

const $ = selector => document.querySelector(selector);

const elements = {
  leftInput: $("#leftInput"),
  rightInput: $("#rightInput"),
  leftHighlight: $("#leftHighlight"),
  rightHighlight: $("#rightHighlight"),
  leftLineNumbers: $("#leftLineNumbers"),
  rightLineNumbers: $("#rightLineNumbers"),
  leftPlaceholder: $("#leftPlaceholder"),
  rightPlaceholder: $("#rightPlaceholder"),
  leftStatus: $("#leftStatus"),
  rightStatus: $("#rightStatus"),
  leftCount: $("#leftCount"),
  rightCount: $("#rightCount"),
  validationMessage: $("#validationMessage"),
  resultsSection: $("#resultsSection"),
  resultsStale: $("#resultsStale"),
  resultsContext: $("#resultsContext"),
  summaryGrid: $("#summaryGrid"),
  resultsList: $("#resultsList"),
  resultCount: $("#resultCount"),
  emptyFilter: $("#emptyFilter"),
  resultsHint: $("#resultsHint"),
  resultsSearch: $("#resultsSearch"),
  searchClear: $("#searchClear"),
  hideUnchanged: $("#hideUnchanged"),
  compareButton: $("#compareButton"),
  formatJsonButton: $("#formatJson"),
  validateButton: $("#validateButton"),
  clearAllButton: $("#clearAll"),
  swapInputsButton: $("#swapInputs"),
  sampleSelect: $("#sampleSelect"),
  copyReport: $("#copyReport"),
  downloadReport: $("#downloadReport"),
  expandAll: $("#expandAll"),
  collapseAll: $("#collapseAll")
};

const state = {
  root: null,
  summary: null,
  busy: false,
  filter: "all",
  query: "",
  hideUnchanged: false,
  sampleLabel: null,
  stale: false
};

let compareToken = 0;
let searchTimer = 0;

const leftEditor = new JsonEditor({
  root: $("#originalEditor"),
  input: elements.leftInput,
  highlight: elements.leftHighlight,
  lineNumbers: elements.leftLineNumbers,
  placeholder: elements.leftPlaceholder,
  status: elements.leftStatus,
  count: elements.leftCount,
  onChange: handleEditorChange
});

const rightEditor = new JsonEditor({
  root: $("#updatedEditor"),
  input: elements.rightInput,
  highlight: elements.rightHighlight,
  lineNumbers: elements.rightLineNumbers,
  placeholder: elements.rightPlaceholder,
  status: elements.rightStatus,
  count: elements.rightCount,
  onChange: handleEditorChange
});

const resultsRenderer = new ResultsRenderer({
  container: elements.resultsList,
  count: elements.resultCount,
  empty: elements.emptyFilter,
  hint: elements.resultsHint,
  onCopyPath: copyPath
});

for (const sample of samples) {
  const option = document.createElement("option");
  option.value = sample.id;
  option.textContent = sample.label;
  option.title = sample.description;
  elements.sampleSelect.appendChild(option);
}

function setMessage(message, type = "") {
  elements.validationMessage.textContent = message;
  elements.validationMessage.className = `validation-message ${type}`.trim();
}

function nextFrame() {
  return new Promise(resolve => requestAnimationFrame(() => resolve()));
}

function setBusy(busy) {
  state.busy = busy;
  elements.compareButton.disabled = busy;
  elements.compareButton.setAttribute("aria-busy", String(busy));
  document.body.classList.toggle("is-comparing", busy);
}

function cancelPendingComparison() {
  compareToken += 1;
  if (state.busy) setBusy(false);
}

function markResultsStale() {
  if (!state.root || state.busy) return;
  state.stale = true;
  elements.resultsStale.hidden = false;
  elements.resultsContext.textContent = "Inputs changed — compare again";
}

function handleEditorChange() {
  state.sampleLabel = null;
  markResultsStale();
}

function hideResults() {
  state.root = null;
  state.summary = null;
  state.stale = false;
  elements.resultsSection.hidden = true;
  elements.resultsStale.hidden = true;
}

function describeErrors(leftError, rightError) {
  const messages = [];
  if (leftError) messages.push(`Original JSON: ${leftError.error}`);
  if (rightError) messages.push(`Updated JSON: ${rightError.error}`);
  return messages.join(" ");
}

function compareSync(leftText, rightText) {
  const left = parseJson(leftText);
  const right = parseJson(rightText);

  if (!left.ok || !right.ok) {
    return {
      ok: false,
      leftError: left.ok ? null : left,
      rightError: right.ok ? null : right
    };
  }

  try {
    const root = compareJson(left.value, right.value);
    return { ok: true, root, summary: summarizeDifferences(root) };
  } catch (error) {
    return {
      ok: false,
      fatalError: error instanceof Error ? error.message : "The comparison could not be completed."
    };
  }
}

function compareInWorker(leftText, rightText) {
  return new Promise((resolve, reject) => {
    let worker;
    try {
      worker = new Worker(new URL("./compare-worker.js", import.meta.url), { type: "module" });
    } catch (error) {
      reject(error);
      return;
    }

    let settled = false;

    const finish = callback => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timeout);
      worker.terminate();
      callback();
    };

    const timeout = window.setTimeout(() => {
      const error = new Error("The comparison worker timed out.");
      error.code = "WORKER_TIMEOUT";
      finish(() => reject(error));
    }, 30_000);

    worker.onmessage = event => finish(() => resolve(event.data));
    worker.onmessageerror = () => finish(() => reject(new Error("The comparison worker returned unreadable data.")));
    worker.onerror = event => {
      event.preventDefault?.();
      finish(() => reject(new Error(event.message || "The comparison worker failed to start.")));
    };

    worker.postMessage({ leftText, rightText });
  });
}

async function runComparison(leftText, rightText) {
  if (leftText.length + rightText.length >= WORKER_THRESHOLD) {
    try {
      return await compareInWorker(leftText, rightText);
    } catch (error) {
      if (error?.code === "WORKER_TIMEOUT") throw error;
      // Older browsers or restrictive deployments may not support module
      // workers. Fall back to the same comparison code on the main thread.
    }
  }

  return compareSync(leftText, rightText);
}

function updateFilterButtons() {
  for (const button of document.querySelectorAll(".filter-button")) {
    const active = button.dataset.filter === state.filter;
    button.classList.toggle("active", active);
    button.setAttribute("aria-pressed", String(active));
  }
}

function updateFilterCounts(summary) {
  const total = summary.added + summary.removed + summary.changed + summary.unchanged;
  for (const counter of document.querySelectorAll("[data-count-for]")) {
    const key = counter.dataset.countFor;
    counter.textContent = String(key === "all" ? total : summary[key] ?? 0);
  }
}

function resetResultControls() {
  state.filter = "all";
  state.query = "";
  state.hideUnchanged = elements.hideUnchanged.checked;
  elements.resultsSearch.value = "";
  elements.searchClear.hidden = true;
  updateFilterButtons();
}

function showSuccessfulResult(result, leftText, rightText) {
  const inputChanged = leftEditor.getValue() !== leftText || rightEditor.getValue() !== rightText;
  state.root = result.root;
  state.summary = result.summary;
  state.stale = inputChanged;

  resetResultControls();
  renderSummary(elements.summaryGrid, result.summary);
  updateFilterCounts(result.summary);
  resultsRenderer.setRoot(result.root, {
    filter: "all",
    query: "",
    hideUnchanged: state.hideUnchanged
  });

  elements.resultsContext.textContent = state.sampleLabel
    ? `Sample · ${state.sampleLabel}`
    : "Current comparison";
  elements.resultsStale.hidden = !inputChanged;
  elements.resultsSection.hidden = false;

  const totalChanges = result.summary.added + result.summary.removed + result.summary.changed;

  if (inputChanged) {
    setMessage("Comparison finished for an earlier version of the inputs. Compare again to refresh the results.", "error");
    return;
  }

  if (totalChanges === 0) {
    setMessage("No differences found. Both documents are identical.", "success");
    return;
  }

  setMessage(
    `Comparison complete: ${result.summary.added} added, ${result.summary.removed} removed, ${result.summary.changed} modified.`,
    "success"
  );
}

function handleFailedResult(result) {
  if (result.leftError) leftEditor.applyValidation(result.leftError);
  if (result.rightError) rightEditor.applyValidation(result.rightError);

  const errors = describeErrors(result.leftError, result.rightError);
  if (errors) {
    hideResults();
    setMessage(errors, "error");
    return;
  }

  hideResults();
  setMessage(
    result.fatalError
      ? `Comparison failed: ${result.fatalError}`
      : "Comparison failed for an unknown reason.",
    "error"
  );
}

async function compare() {
  if (state.busy) return;

  const token = ++compareToken;
  const leftText = leftEditor.getValue();
  const rightText = rightEditor.getValue();

  setBusy(true);
  setMessage("Comparing documents…");

  await nextFrame();
  if (token !== compareToken) return;

  let result;
  try {
    result = await runComparison(leftText, rightText);
  } catch (error) {
    if (token !== compareToken) return;
    hideResults();
    setMessage(
      `Comparison failed: ${error instanceof Error ? error.message : "unknown error."}`,
      "error"
    );
    setBusy(false);
    return;
  }

  if (token !== compareToken) return;

  try {
    if (!result.ok) {
      handleFailedResult(result);
    } else {
      showSuccessfulResult(result, leftText, rightText);
    }
  } finally {
    if (token === compareToken) setBusy(false);
  }
}

function formatEditor(editor, label) {
  const text = editor.getValue();
  if (!text.trim()) {
    setMessage(`${label} is empty.`, "error");
    return false;
  }

  const formatted = formatJson(text);
  if (!formatted.ok) {
    editor.applyValidation(formatted);
    setMessage(`${label}: ${formatted.error}`, "error");
    return false;
  }

  editor.setValue(formatted.value);
  return true;
}

function minifyEditor(editor, label) {
  const text = editor.getValue();
  if (!text.trim()) {
    setMessage(`${label} is empty.`, "error");
    return false;
  }

  const minified = minifyJson(text);
  if (!minified.ok) {
    editor.applyValidation(minified);
    setMessage(`${label}: ${minified.error}`, "error");
    return false;
  }

  editor.setValue(minified.value);
  return true;
}

function formatBoth() {
  const results = [
    formatEditor(leftEditor, "Original JSON"),
    formatEditor(rightEditor, "Updated JSON")
  ];

  if (results.every(Boolean)) {
    setMessage("Both editors formatted.", "success");
    return;
  }

  if (results.some(Boolean)) {
    setMessage("Formatted the valid editor. Fix the invalid JSON and try again.", "error");
  }
}

function validateAll() {
  const left = leftEditor.validate();
  const right = rightEditor.validate();
  const errors = describeErrors(left.ok ? null : left, right.ok ? null : right);

  if (errors) {
    setMessage(errors, "error");
  } else {
    setMessage("Both editors contain valid JSON.", "success");
  }
}

function clearAll() {
  cancelPendingComparison();
  leftEditor.setValue("");
  rightEditor.setValue("");
  state.sampleLabel = null;
  elements.sampleSelect.value = "";
  hideResults();
  updateFilterCounts({ added: 0, removed: 0, changed: 0, unchanged: 0 });
  setMessage("Paste JSON into both editors, then choose Compare JSON.");
  leftEditor.focus();
}

function swapInputs() {
  const hadResults = !elements.resultsSection.hidden;
  cancelPendingComparison();

  const previousLeft = leftEditor.getValue();
  leftEditor.setValue(rightEditor.getValue());
  rightEditor.setValue(previousLeft);
  state.sampleLabel = null;

  if (hadResults) {
    compare();
  } else {
    setMessage("Original and updated inputs swapped.");
  }
}

function loadSample() {
  const sample = getSample(elements.sampleSelect.value);
  if (!sample) return;

  cancelPendingComparison();
  leftEditor.setValue(JSON.stringify(sample.left, null, 2));
  rightEditor.setValue(JSON.stringify(sample.right, null, 2));
  state.sampleLabel = sample.label;
  elements.sampleSelect.value = "";
  compare();
}

async function copyPath(path) {
  const result = await copyText(path);
  if (result.ok) {
    setMessage("Difference path copied to clipboard.", "success");
    return true;
  }

  setMessage(`Could not copy the path. ${result.error}`, "error");
  return false;
}

async function copyReport() {
  if (!state.root) {
    setMessage("Compare two documents before copying a report.", "error");
    return;
  }

  const report = buildTextReport(state.root);
  const result = await copyText(report);

  if (result.ok) {
    setMessage("Comparison report copied to clipboard.", "success");
  } else {
    setMessage(`Could not copy the report. ${result.error}`, "error");
  }
}

function downloadReport() {
  if (!state.root) {
    setMessage("Compare two documents before downloading a report.", "error");
    return;
  }

  const date = new Date().toISOString().slice(0, 10);
  const report = buildTextReport(state.root);
  downloadFile(`diffforge-report-${date}.txt`, report, "text/plain");
  setMessage("Comparison report downloaded.", "success");
}

async function copyEditorJson(editor, label) {
  const text = editor.getValue();
  if (!text.trim()) {
    setMessage(`${label} is empty.`, "error");
    return;
  }

  const result = await copyText(text);
  if (result.ok) {
    setMessage(`${label} copied to clipboard.`, "success");
  } else {
    setMessage(`Could not copy ${label.toLowerCase()}. ${result.error}`, "error");
  }
}

function downloadEditorJson(editor, label, filename) {
  const text = editor.getValue();
  if (!text.trim()) {
    setMessage(`${label} is empty.`, "error");
    return;
  }

  if (!parseJson(text).ok) {
    setMessage(`${label} is not valid JSON. Fix it before downloading.`, "error");
    return;
  }

  downloadFile(filename, text, "application/json");
  setMessage(`${label} downloaded.`, "success");
}

function bindEditorTools(root, editor, label, filename) {
  root.addEventListener("click", event => {
    const button = event.target.closest("[data-editor-action]");
    if (!button) return;

    switch (button.dataset.editorAction) {
      case "format": {
        if (formatEditor(editor, label)) setMessage(`${label} formatted.`, "success");
        break;
      }
      case "minify": {
        if (minifyEditor(editor, label)) setMessage(`${label} minified.`, "success");
        break;
      }
      case "copy":
        copyEditorJson(editor, label);
        break;
      case "download":
        downloadEditorJson(editor, label, filename);
        break;
      case "clear":
        cancelPendingComparison();
        editor.setValue("");
        state.sampleLabel = null;
        hideResults();
        setMessage(`${label} cleared.`, "");
        editor.focus();
        break;
      default:
        break;
    }
  });
}

bindEditorTools($("#originalEditor"), leftEditor, "Original JSON", "original.json");
bindEditorTools($("#updatedEditor"), rightEditor, "Updated JSON", "updated.json");

elements.compareButton.addEventListener("click", () => compare());
elements.formatJsonButton.addEventListener("click", formatBoth);
elements.validateButton.addEventListener("click", validateAll);
elements.clearAllButton.addEventListener("click", clearAll);
elements.swapInputsButton.addEventListener("click", swapInputs);
elements.sampleSelect.addEventListener("change", loadSample);
elements.copyReport.addEventListener("click", copyReport);
elements.downloadReport.addEventListener("click", downloadReport);
elements.expandAll.addEventListener("click", () => resultsRenderer.expandAll());
elements.collapseAll.addEventListener("click", () => resultsRenderer.collapseAll());

for (const button of document.querySelectorAll(".filter-button")) {
  button.addEventListener("click", () => {
    state.filter = button.dataset.filter;
    updateFilterButtons();
    resultsRenderer.setOptions({ filter: state.filter });
  });
}

elements.hideUnchanged.addEventListener("change", () => {
  state.hideUnchanged = elements.hideUnchanged.checked;
  resultsRenderer.setOptions({ hideUnchanged: state.hideUnchanged });
});

elements.resultsSearch.addEventListener("input", () => {
  const hasQuery = elements.resultsSearch.value.length > 0;
  elements.searchClear.hidden = !hasQuery;
  window.clearTimeout(searchTimer);
  searchTimer = window.setTimeout(() => {
    state.query = elements.resultsSearch.value;
    resultsRenderer.setOptions({ query: state.query });
  }, SEARCH_DELAY);
});

elements.resultsSearch.addEventListener("keydown", event => {
  if (event.key === "Escape" && elements.resultsSearch.value) {
    event.preventDefault();
    elements.resultsSearch.value = "";
    elements.searchClear.hidden = true;
    state.query = "";
    resultsRenderer.setOptions({ query: "" });
  }
});

elements.searchClear.addEventListener("click", () => {
  elements.resultsSearch.value = "";
  elements.searchClear.hidden = true;
  state.query = "";
  resultsRenderer.setOptions({ query: "" });
  elements.resultsSearch.focus();
});

document.addEventListener("keydown", event => {
  if (event.repeat) return;
  const modifier = event.ctrlKey || event.metaKey;

  if (modifier && event.key === "Enter") {
    event.preventDefault();
    compare();
    return;
  }

  if (modifier && event.shiftKey && event.code === "KeyF") {
    event.preventDefault();
    formatBoth();
    return;
  }

  if (event.altKey && !event.shiftKey && event.code === "KeyS") {
    event.preventDefault();
    swapInputs();
    return;
  }

  if (event.altKey && event.shiftKey && event.code === "KeyC") {
    event.preventDefault();
    clearAll();
    return;
  }

  if (event.altKey && !event.shiftKey && event.code === "KeyV") {
    event.preventDefault();
    validateAll();
    return;
  }

  if (event.altKey && !event.shiftKey && event.code === "Digit1") {
    event.preventDefault();
    leftEditor.focus();
    return;
  }

  if (event.altKey && !event.shiftKey && event.code === "Digit2") {
    event.preventDefault();
    rightEditor.focus();
  }
});

updateFilterCounts({ added: 0, removed: 0, changed: 0, unchanged: 0 });
setMessage("Paste JSON into both editors, then choose Compare JSON.");
