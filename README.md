# DiffForge

A private, browser-based JSON diff tool. It compares two JSON documents recursively and reports added, removed, modified and unchanged values with stable difference paths.

The app is static HTML, CSS and vanilla JavaScript. There is no backend, no build step, no framework and no runtime dependency.

## Screenshots

### Compare view

![DiffForge compare view showing side-by-side JSON results](assets/compare%20screenshot.png)

### Documentation

![DiffForge documentation page with syntax-highlighted examples](assets/documentation%20sreenshot.png)

### Keyboard shortcuts

![DiffForge keyboard shortcuts reference](assets/keyboard%20shortcut%20screenshot.png)

## Quick start

ES modules must be served over HTTP; opening `index.html` from the filesystem will not load the application modules.

```bash
python -m http.server 8000
```

Open <http://localhost:8000>.

Alternatively, with Node.js:

```bash
npm start
```

`npm start` runs `npx serve .` and prints the local URL.

## Features

- Recursive comparison of nested objects and arrays.
- Arrays compared by index, including added and removed elements.
- Type-sensitive comparison: `1`, `"1"` and `null` are distinct values.
- Explicit handling of missing properties versus properties set to `null`.
- Stable JSONPath-style paths, including bracket notation for special keys.
- Syntax-highlighted editors with line numbers, counts and live validation.
- Side-by-side results with summary counts.
- Filter by status, search by path, hide unchanged entries and expand or collapse branches.
- Copy individual paths, copy a text report or download a report.
- Format, minify, validate, copy, download or clear either document.
- Five built-in sample comparisons.
- Light and dark themes with a persisted preference.
- Large comparisons moved to a Web Worker when supported.
- Local processing with safe DOM rendering.

## Keyboard shortcuts

| Shortcut | Action |
| --- | --- |
| `Ctrl`/`Cmd` + `Enter` | Compare both documents |
| `Ctrl`/`Cmd` + `Shift` + `F` | Format both editors |
| `Alt` + `S` | Swap original and updated inputs |
| `Alt` + `Shift` + `C` | Clear all inputs and results |
| `Alt` + `V` | Validate both editors |
| `Alt` + `1` | Focus the original editor |
| `Alt` + `2` | Focus the updated editor |
| `Alt` + `Shift` + `T` | Toggle the theme |
| `Tab` | Insert two spaces in an editor |
| `Esc` | Clear the results search |

## Comparison model

Paths start at `$`. Object keys use dot notation when they are valid identifiers and bracket notation otherwise:

```text
$.user.role
$.items[2].price
$["delivery.window"]
```

Objects are compared by key. Arrays are compared strictly by index. The summary counts difference entries rather than every nested value:

- An added or removed object or array counts as one entry for the property that was added or removed.
- A container present in both documents is traversed, and its changed leaf values are counted separately.
- An unchanged empty object or array counts as one unchanged entry.
- A missing property is not the same as a property whose value is `null`.

Key sorting in the result is deterministic, not an indication that key order changed.

## Project structure

```text
diffforge/
├── index.html               Compare application
├── docs.html                Documentation
├── features.html            Feature overview
├── about.html               Project and architecture notes
├── privacy.html             Data-handling description
├── css/
│   ├── style.css            Shared design system, navigation and content pages
│   └── compare.css          Editor and results styling
├── js/
│   ├── app.js               Application wiring and interactions
│   ├── parser.js            Parsing, validation, formatting and limits
│   ├── comparator.js        Recursive diff tree and summary counts
│   ├── renderer.js          Summary cards and side-by-side results
│   ├── editor.js            Editor state, validation and line numbers
│   ├── highlighter.js       Safe JSON syntax highlighting
│   ├── compare-worker.js    Large-comparison Web Worker
│   ├── report.js            Text report generation
│   ├── clipboard.js         Clipboard API with fallback
│   ├── download.js          Local Blob downloads
│   ├── samples.js           Built-in examples
│   └── site.js              Shared theme and navigation behavior
├── tests/
│   ├── comparator.test.mjs
│   └── parser.test.mjs
├── assets/                  Logo, favicon, screenshots and social preview image
├── robots.txt
├── sitemap.xml
└── package.json
```

## Tests

Node.js 18 or newer is required for the test runner.

```bash
npm test
```

The suite covers parser behavior and comparison semantics, including nested objects, arrays, type changes, `null` versus missing properties, empty containers, special keys, deep nesting, invalid JSON and input limits.

There is no browser test runner configured. After changing the UI, run the site through a local server and check the compare page, all navigation links, both themes, filters, search, samples, reports, keyboard shortcuts and narrow-screen layouts.

## Limits and performance

- Each editor accepts up to 5,000,000 characters.
- Comparisons of 200,000 combined characters or more are sent to a module Web Worker when available; failure falls back to the main thread.
- Syntax highlighting is disabled above 100,000 characters per editor.
- Line numbers are omitted above 20,000 lines.
- Result trees above 1,500 nodes start collapsed below the root.
- Deeply nested input is still bounded by browser call stack and memory.

The app does not persist editor contents, has no file picker and does not match array elements by identity or sequence alignment. See [docs.html](docs.html) for the detailed behavior.

## Privacy and security

Parsing and comparison happen in the browser. Editor contents are not uploaded and are not written to storage. The only persisted preference is the theme, stored under the `diffforge-theme` key in `localStorage`.

Input is parsed with `JSON.parse`, never `eval`. Untrusted values are rendered using DOM text nodes and `textContent`; the app does not inject user JSON as HTML. Clipboard and storage failures are handled without being reported as success.

See [privacy.html](privacy.html) for the full description.

## Deployment

Deploy the repository directory to any static host, including Cloudflare Pages, GitHub Pages, Netlify or an object-storage static site. No build command or output directory is required.

Before deploying:

1. Replace `https://diffforge.example/` in `sitemap.xml` and `robots.txt` with the production origin.
2. Replace the relative `og:image` paths in the HTML pages with absolute production URLs before relying on social previews.
3. Confirm that the host serves `.js` files with a JavaScript MIME type and `.mjs` files are not needed in production.

The Web Worker uses a relative module URL, so it works from a subdirectory as well as a domain root.

## Browser support

Current evergreen Chrome, Edge, Firefox and Safari are supported. Older browsers without ES modules or module workers can still use the main-thread comparison path, but they may not support every modern CSS feature used by the interface.
