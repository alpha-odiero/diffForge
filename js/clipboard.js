/**
 * Clipboard helper with a graceful fallback for browsers or contexts that
 * block the async Clipboard API.
 */
export async function copyText(text) {
  const value = typeof text === "string" ? text : String(text);

  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(value);
      return { ok: true };
    } catch {
      // Fall through to the legacy selection-based approach.
    }
  }

  const previouslyFocused = document.activeElement;
  const helper = document.createElement("textarea");
  helper.value = value;
  helper.setAttribute("readonly", "");
  helper.setAttribute("aria-hidden", "true");
  helper.tabIndex = -1;
  helper.style.position = "fixed";
  helper.style.top = "0";
  helper.style.left = "-9999px";
  helper.style.opacity = "0";
  document.body.appendChild(helper);

  try {
    helper.select();
    helper.setSelectionRange(0, helper.value.length);
    const succeeded = document.execCommand("copy");
    return succeeded
      ? { ok: true }
      : { ok: false, error: "The browser blocked clipboard access." };
  } catch {
    return { ok: false, error: "The browser blocked clipboard access." };
  } finally {
    helper.remove();
    if (previouslyFocused && typeof previouslyFocused.focus === "function") {
      previouslyFocused.focus();
    }
  }
}
