const THEME_KEY = "diffforge-theme";
const DARK_THEME_COLOR = "#0d1117";
const LIGHT_THEME_COLOR = "#f6f8fa";

function currentTheme() {
  return document.documentElement.dataset.theme === "light" ? "light" : "dark";
}

function syncThemeControls() {
  const theme = currentTheme();
  const nextLabel = theme === "dark" ? "Switch to light theme" : "Switch to dark theme";

  for (const button of document.querySelectorAll("[data-theme-toggle]")) {
    button.setAttribute("aria-label", nextLabel);
    button.setAttribute("title", `${nextLabel} (Alt+Shift+T)`);
  }

  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) {
    meta.setAttribute("content", theme === "dark" ? DARK_THEME_COLOR : LIGHT_THEME_COLOR);
  }
}

function applyTheme(theme, { persist = true } = {}) {
  document.documentElement.dataset.theme = theme;
  syncThemeControls();

  if (!persist) return;
  try {
    localStorage.setItem(THEME_KEY, theme);
  } catch {
    // Theme persistence is optional. The active theme still applies.
  }
}

function toggleTheme() {
  applyTheme(currentTheme() === "dark" ? "light" : "dark");
}

function initializeTheme() {
  let stored = null;
  try {
    stored = localStorage.getItem(THEME_KEY);
  } catch {
    stored = null;
  }

  if (stored === "light" || stored === "dark") {
    applyTheme(stored, { persist: false });
    return;
  }

  const prefersLight = window.matchMedia?.("(prefers-color-scheme: light)").matches;
  applyTheme(prefersLight ? "light" : "dark", { persist: false });
}

function initializeNavigation() {
  const toggle = document.querySelector("[data-nav-toggle]");
  const nav = document.querySelector("#siteNav");
  if (!toggle || !nav) return;

  const setOpen = open => {
    toggle.setAttribute("aria-expanded", String(open));
    nav.classList.toggle("is-open", open);
    document.body.classList.toggle("nav-open", open);
  };

  toggle.addEventListener("click", () => {
    setOpen(toggle.getAttribute("aria-expanded") !== "true");
  });

  nav.addEventListener("click", event => {
    if (event.target.closest("a")) setOpen(false);
  });

  document.addEventListener("click", event => {
    if (!document.body.classList.contains("nav-open")) return;
    if (nav.contains(event.target) || toggle.contains(event.target)) return;
    setOpen(false);
  });

  document.addEventListener("keydown", event => {
    if (event.key === "Escape" && document.body.classList.contains("nav-open")) {
      setOpen(false);
      toggle.focus();
    }
  });

  window.addEventListener("resize", () => {
    if (window.innerWidth > 840) setOpen(false);
  });
}

function initializeDocsToc() {
  const links = [...document.querySelectorAll(".docs-toc a[href^='#']")];
  if (links.length === 0 || !("IntersectionObserver" in window)) return;

  const sections = links
    .map(link => document.querySelector(link.getAttribute("href")))
    .filter(Boolean);

  const setActive = id => {
    for (const link of links) {
      const active = link.getAttribute("href") === `#${id}`;
      link.classList.toggle("is-active", active);
      if (active) link.setAttribute("aria-current", "true");
      else link.removeAttribute("aria-current");
    }
  };

  const observer = new IntersectionObserver(entries => {
    const visible = entries
      .filter(entry => entry.isIntersecting)
      .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
    if (visible[0]) setActive(visible[0].target.id);
  }, {
    rootMargin: "-90px 0px -66% 0px",
    threshold: [0, 1]
  });

  for (const section of sections) observer.observe(section);
}

document.addEventListener("click", event => {
  const button = event.target.closest("[data-theme-toggle]");
  if (button) toggleTheme();
});

document.addEventListener("keydown", event => {
  if (event.altKey && event.shiftKey && event.key.toLowerCase() === "t") {
    event.preventDefault();
    toggleTheme();
  }
});

initializeTheme();
initializeNavigation();
initializeDocsToc();
