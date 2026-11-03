import { highlightJson } from "./highlighter.js";

const LABEL_PATTERN = /^([A-Za-z][A-Za-z ]*:)([ \t]*)(.*)$/;

function makeToken(className, text) {
  const token = document.createElement("span");
  token.className = className;
  token.textContent = text;
  return token;
}

function appendJson(container, text) {
  if (!text) return;
  const temporary = document.createElement("code");
  highlightJson(temporary, text);
  while (temporary.firstChild) container.appendChild(temporary.firstChild);
}

function appendPath(container, path) {
  let index = 0;

  while (index < path.length) {
    const character = path[index];

    if (character === "$") {
      container.appendChild(makeToken("tok-literal", character));
      index += 1;
      continue;
    }

    if (character === ".") {
      container.appendChild(makeToken("tok-punct", character));
      index += 1;
      const start = index;
      while (index < path.length && /[A-Za-z0-9_$]/.test(path[index])) index += 1;
      if (index > start) container.appendChild(makeToken("tok-key", path.slice(start, index)));
      continue;
    }

    if (character === "[") {
      container.appendChild(makeToken("tok-punct", character));
      index += 1;

      if (path[index] === '"' || path[index] === "'") {
        const quote = path[index];
        const start = index;
        index += 1;
        while (index < path.length) {
          if (path[index] === "\\") {
            index += 2;
            continue;
          }
          if (path[index] === quote) {
            index += 1;
            break;
          }
          index += 1;
        }
        container.appendChild(makeToken("tok-key", path.slice(start, index)));
      } else {
        const start = index;
        while (index < path.length && path[index] !== "]") index += 1;
        const value = path.slice(start, index);
        container.appendChild(makeToken(/^-?\d+$/.test(value) ? "tok-number" : "tok-key", value));
      }

      if (path[index] === "]") {
        container.appendChild(makeToken("tok-punct", "]"));
        index += 1;
      }
      continue;
    }

    container.appendChild(makeToken("tok-punct", character));
    index += 1;
  }
}

function highlightBlock(code) {
  const lines = code.textContent.split("\n");
  const fragment = document.createDocumentFragment();

  lines.forEach((line, lineIndex) => {
    const match = line.match(LABEL_PATTERN);

    if (match) {
      fragment.appendChild(makeToken("code-label", match[1]));
      if (match[2]) fragment.appendChild(document.createTextNode(match[2]));

      const rest = match[3];
      if (/path:/i.test(match[1])) appendPath(fragment, rest);
      else appendJson(fragment, rest);
    } else if (line) {
      appendJson(fragment, line);
    }

    if (lineIndex < lines.length - 1) {
      fragment.appendChild(document.createTextNode("\n"));
    }
  });

  code.replaceChildren(fragment);
}

for (const code of document.querySelectorAll("pre code[data-highlight]")) {
  highlightBlock(code);
}
