/**
 * Small, dependency-free JSON syntax highlighter.
 *
 * The highlighter builds DOM nodes directly and only assigns token text with
 * textContent. JSON input is never interpreted as HTML.
 */

const NUMBER_PATTERN = /^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?/;
const PUNCTUATION = new Set(["{", "}", "[", "]", ",", ":"]);
const LITERALS = new Set(["true", "false", "null"]);

function tokenizeLine(line) {
  const tokens = [];
  let index = 0;

  while (index < line.length) {
    const char = line[index];

    if (char === " " || char === "\t") {
      let end = index + 1;
      while (end < line.length && (line[end] === " " || line[end] === "\t")) end += 1;
      tokens.push({ type: "space", value: line.slice(index, end) });
      index = end;
      continue;
    }

    if (char === '"') {
      let end = index + 1;
      while (end < line.length) {
        if (line[end] === "\\") {
          end += 2;
          continue;
        }
        if (line[end] === '"') {
          end += 1;
          break;
        }
        end += 1;
      }
      tokens.push({ type: "string", value: line.slice(index, end) });
      index = end;
      continue;
    }

    if (char === "-" || (char >= "0" && char <= "9")) {
      const match = line.slice(index).match(NUMBER_PATTERN);
      if (match) {
        tokens.push({ type: "number", value: match[0] });
        index += match[0].length;
        continue;
      }
    }

    if (char >= "a" && char <= "z") {
      const word = line.slice(index).match(/^[a-z]+/)?.[0] || char;
      tokens.push({ type: LITERALS.has(word) ? "literal" : "invalid", value: word });
      index += word.length;
      continue;
    }

    if (PUNCTUATION.has(char)) {
      tokens.push({ type: "punct", value: char });
      index += 1;
      continue;
    }

    tokens.push({ type: "invalid", value: char });
    index += 1;
  }

  for (let tokenIndex = 0; tokenIndex < tokens.length; tokenIndex += 1) {
    const token = tokens[tokenIndex];
    if (token.type !== "string") continue;

    let lookahead = tokenIndex + 1;
    while (tokens[lookahead]?.type === "space") lookahead += 1;
    if (tokens[lookahead]?.value.startsWith(":")) {
      token.type = "key";
    }
  }

  return tokens;
}

function appendSpaces(parent, count) {
  if (count <= 0) return;
  parent.appendChild(document.createTextNode(" ".repeat(count)));
}

function renderIndentGuides(parent, whitespace) {
  let spaces = 0;

  const flushSpaces = () => {
    while (spaces >= 2) {
      const guide = document.createElement("span");
      guide.className = "indent-guide";
      guide.setAttribute("aria-hidden", "true");
      parent.appendChild(guide);
      spaces -= 2;
    }
  };

  for (const char of whitespace) {
    if (char === "\t") {
      flushSpaces();
      const guide = document.createElement("span");
      guide.className = "indent-guide";
      guide.setAttribute("aria-hidden", "true");
      parent.appendChild(guide);
    } else {
      spaces += 1;
    }
  }

  flushSpaces();
  appendSpaces(parent, spaces);
}

function makeToken(token) {
  const span = document.createElement("span");
  span.className = `tok-${token.type}`;
  span.textContent = token.value;
  return span;
}

export function highlightJson(container, text) {
  const fragment = document.createDocumentFragment();
  const lines = text.split("\n");

  lines.forEach((line, lineIndex) => {
    const leadingMatch = line.match(/^[ \t]+/);
    const indentation = leadingMatch ? leadingMatch[0] : "";
    const content = indentation ? line.slice(indentation.length) : line;

    if (indentation) renderIndentGuides(fragment, indentation);

    for (const token of tokenizeLine(content)) {
      if (token.type === "space") {
        fragment.appendChild(document.createTextNode(token.value));
      } else {
        fragment.appendChild(makeToken(token));
      }
    }

    if (lineIndex < lines.length - 1) {
      fragment.appendChild(document.createTextNode("\n"));
    }
  });

  container.replaceChildren(fragment);
}
