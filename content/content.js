// content.js — DOM observation, column detection, direct DOM hiding

const browser = globalThis.browser || globalThis.chrome;

// --- URL parsing ---

function getBoardIdFromUrl() {
  // Asana board URLs can be:
  //   /0/PROJECT_ID/...  (legacy)
  //   /1/SHARD_ID/project/PROJECT_ID/board/BOARD_ID  (current)
  const boardMatch = window.location.pathname.match(/\/project\/(\d+)\/board/);
  if (boardMatch) return boardMatch[1];
  const legacyMatch = window.location.pathname.match(/^\/0\/(\d+)/);
  return legacyMatch ? legacyMatch[1] : null;
}

// --- State ---

let currentBoardId = null;
let showAllMode = false;
let lastRightClickedColumn = null;
let boardChangeInFlight = false;

// --- Board detection ---

function getBoardContainer() {
  return document.querySelector(".BoardBody-dragSelectContainer");
}

function isBoardView() {
  return getBoardContainer() !== null;
}

function getColumns() {
  const headerWrappers = document.querySelectorAll(
    ".BoardBody-headerDraggableItemWrapper",
  );
  const bodyWrappers = document.querySelectorAll(
    ".BoardBody-columnDraggableItemWrapper",
  );

  const columns = [];
  headerWrappers.forEach((el, index) => {
    const h2 = el.querySelector(".BoardGroupHeaderContents h2");
    const name = h2 ? h2.textContent.trim() : null;
    if (name) {
      columns.push({
        name,
        headerElement: el,
        bodyElement: bodyWrappers[index] || null,
      });
    }
  });
  return columns;
}

function getBoardName() {
  const heading =
    document.querySelector('h1[class*="Typography"]') ||
    document.querySelector('[class*="ProjectHeader"] h1');
  return heading ? heading.textContent.trim() : "Unknown Board";
}

// --- Direct DOM hiding for columns ---

function applyHiddenColumns(hiddenColumnNames) {
  const columns = getColumns();

  columns.forEach((col) => {
    const shouldHide = !showAllMode && hiddenColumnNames.includes(col.name);
    const display = shouldHide ? "none" : "";
    col.headerElement.style.display = display;
    if (col.bodyElement) {
      col.bodyElement.style.display = display;
    }
  });
}

function removeAllHiding() {
  const columns = getColumns();
  columns.forEach((col) => {
    col.headerElement.style.display = "";
    if (col.bodyElement) {
      col.bodyElement.style.display = "";
    }
  });
}

// --- Main observation loop ---

let debounceTimer = null;

async function onBoardChanged() {
  if (boardChangeInFlight) return;
  boardChangeInFlight = true;

  try {
    const boardId = getBoardIdFromUrl();
    if (!boardId || !isBoardView()) {
      currentBoardId = null;
      removeAllHiding();
      browser.runtime
        .sendMessage({ type: "UPDATE_BADGE", count: 0 })
        .catch(() => {});
      return;
    }

    currentBoardId = boardId;

    const boardData = await browser.runtime.sendMessage({
      type: "GET_BOARD_DATA",
      boardId,
    });

    applyHiddenColumns(boardData.hiddenColumns || []);

    browser.runtime
      .sendMessage({
        type: "UPDATE_BADGE",
        count: (boardData.hiddenColumns || []).length,
      })
      .catch(() => {});
  } catch (e) {
    console.warn("[Asana Personal View] board check failed:", e.message);
  } finally {
    boardChangeInFlight = false;
  }
}

function debouncedBoardCheck() {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(onBoardChanged, 300);
}

// --- MutationObserver (scoped to board container when possible) ---

let observer = null;

function startObserver() {
  if (observer) observer.disconnect();

  const target = getBoardContainer() || document.body;
  observer = new MutationObserver(debouncedBoardCheck);
  observer.observe(target, { childList: true, subtree: true });
}

startObserver();

// Initial check
onBoardChanged();

// --- SPA navigation detection ---

let lastUrl = window.location.href;

window.addEventListener("popstate", () => {
  if (window.location.href !== lastUrl) {
    lastUrl = window.location.href;
    startObserver();
    debouncedBoardCheck();
  }
});

// Asana uses pushState/replaceState for navigation — intercept them
for (const method of ["pushState", "replaceState"]) {
  const original = history[method];
  history[method] = function (...args) {
    const result = original.apply(this, args);
    if (window.location.href !== lastUrl) {
      lastUrl = window.location.href;
      startObserver();
      debouncedBoardCheck();
    }
    return result;
  };
}

// --- Right-click tracking ---

document.addEventListener("contextmenu", (e) => {
  const headerWrapper = e.target.closest(
    ".BoardBody-headerDraggableItemWrapper",
  );
  const columnWrapper = e.target.closest(
    ".BoardBody-columnDraggableItemWrapper",
  );
  const target = headerWrapper || columnWrapper;

  if (target) {
    const h2 = headerWrapper
      ? headerWrapper.querySelector(".BoardGroupHeaderContents h2")
      : null;
    if (h2) {
      lastRightClickedColumn = h2.textContent.trim();
    } else if (columnWrapper) {
      const parent = columnWrapper.parentElement;
      const siblings = Array.from(parent.children).filter((el) =>
        el.classList.contains("BoardBody-columnDraggableItemWrapper"),
      );
      const idx = siblings.indexOf(columnWrapper);
      const columns = getColumns();
      const matched = idx >= 0 && idx < columns.length ? columns[idx] : null;
      lastRightClickedColumn = matched ? matched.name : null;
    }
  } else {
    lastRightClickedColumn = null;
  }
});

// --- Message listener (from background/popup) ---

function handleContentMessage(message, _sender, sendResponse) {
  if (!message || typeof message.type !== "string") {
    sendResponse(false);
    return false;
  }

  const handler = async () => {
    switch (message.type) {
      case "GET_RIGHT_CLICKED_COLUMN": {
        if (lastRightClickedColumn && currentBoardId) {
          await browser.runtime.sendMessage({
            type: "HIDE_COLUMN",
            boardId: currentBoardId,
            boardName: getBoardName(),
            columnName: lastRightClickedColumn,
          });
          await onBoardChanged();
        }
        return true;
      }
      case "GET_COLUMNS": {
        const columns = getColumns().map((c) => c.name);
        return {
          columns,
          boardId: currentBoardId,
          boardName: getBoardName(),
          showAllMode,
        };
      }
      case "APPLY_HIDING": {
        applyHiddenColumns(message.hiddenColumns || []);
        return true;
      }
      case "SET_SHOW_ALL": {
        showAllMode = !!message.enabled;
        if (showAllMode) {
          removeAllHiding();
        } else {
          await onBoardChanged();
        }
        return true;
      }
      default:
        return false;
    }
  };

  handler()
    .then(sendResponse)
    .catch(() => sendResponse(false));
  return true;
}

browser.runtime.onMessage.addListener(handleContentMessage);

// --- Git Branch Inject Button ---

const INJECT_BTN_ID = "asana-pv-git-inject-btn";
const DROPDOWN_ID = "asana-pv-git-dropdown";

function getBranchNameFromTaskPane() {
  // Find the Masterboard Software Development project section
  const projectLink = document.querySelector(
    'a[aria-label="Masterboard Software Development"]',
  );
  const section = projectLink
    ? projectLink.closest(".TaskProjectWithCustomPropertyRows")
    : null;

  let idValue = "";
  let natureValue = "";

  if (section) {
    // ID field: disabled text input with aria-label like "ID ID-1514"
    const idEl = section.querySelector(
      '[data-testid="CustomPropertyTextValueInput-disabled"][aria-label^="ID "]',
    );
    if (idEl) {
      idValue = idEl
        .getAttribute("aria-label")
        .replace(/^ID\s+/, "")
        .trim();
    }

    // Nature of the ticket: enum button with aria-label like "Nature of the ticket Ad hoc"
    const natureEl = section.querySelector(
      '.CustomPropertyEnumValueInput[aria-label^="Nature of the ticket "]',
    );
    if (natureEl) {
      natureValue = natureEl
        .getAttribute("aria-label")
        .replace(/^Nature of the ticket\s+/, "")
        .trim();
    }
  }

  // Extract task title: first 5 words, stripped of formatting
  let titleSlug = "";
  const titleEl = document.querySelector(
    '.TaskPaneTitle textarea[aria-label="Task Name"]',
  );
  if (titleEl) {
    const titleText = (titleEl.value || titleEl.textContent || "").trim();
    titleSlug = titleText
      .replace(/[^a-zA-Z0-9\s-]/g, "")
      .split(/\s+/)
      .slice(0, 5)
      .join("-");
  }

  // Build branch name: nature/id-title (e.g. "ad-hoc/id-1514-classpass-adds-a-new-attribute")
  const sanitize = (s) =>
    s
      .toLowerCase()
      .replace(/[^a-z0-9/_-]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .replace(/-{2,}/g, "-");

  const idAndTitle = [idValue, titleSlug].filter(Boolean).join("/");

  if (natureValue && idAndTitle) {
    return `${sanitize(natureValue)}/${sanitize(idAndTitle)}`;
  }
  if (idAndTitle) return sanitize(idAndTitle);
  if (natureValue) return sanitize(natureValue);

  // Fallback: grab all text custom fields
  const inputs = document.querySelectorAll(
    ".TaskPaneFields .CustomPropertyTextValueInput",
  );
  const parts = [];
  inputs.forEach((input) => {
    const text = (input.innerText || input.textContent || "").trim();
    if (text) parts.push(text);
  });
  return sanitize(parts.join("-"));
}

function createDropdown(branchName) {
  removeDropdown();

  const dropdown = document.createElement("div");
  dropdown.id = DROPDOWN_ID;
  Object.assign(dropdown.style, {
    position: "absolute",
    top: "100%",
    right: "0",
    marginTop: "4px",
    background: "#fff",
    border: "1px solid #ccc",
    borderRadius: "6px",
    boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
    padding: "8px",
    zIndex: "99999",
    minWidth: "300px",
    fontFamily: "monospace",
    fontSize: "12px",
  });

  const command = `git checkout -b ${branchName}`;

  const code = document.createElement("div");
  Object.assign(code.style, {
    background: "#f4f4f4",
    padding: "8px 10px",
    borderRadius: "4px",
    cursor: "pointer",
    userSelect: "all",
    wordBreak: "break-all",
    color: "#333",
  });
  code.textContent = command;
  code.title = "Click to copy";
  code.addEventListener("click", (e) => {
    e.stopPropagation();
    navigator.clipboard.writeText(command).then(() => {
      code.textContent = "Copied!";
      setTimeout(() => {
        code.textContent = command;
      }, 1500);
    });
  });

  dropdown.appendChild(code);
  return dropdown;
}

function removeDropdown() {
  const existing = document.getElementById(DROPDOWN_ID);
  if (existing) existing.remove();
}

function injectGitButton() {
  // Don't add if already present
  if (document.getElementById(INJECT_BTN_ID)) return;

  const toolbar = document.querySelector(".TaskPaneToolbar.TaskPane-header");
  if (!toolbar) return;

  const wrapper = document.createElement("div");
  Object.assign(wrapper.style, {
    position: "relative",
    display: "inline-flex",
    alignItems: "center",
  });

  const btn = document.createElement("button");
  btn.id = INJECT_BTN_ID;
  btn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"/></svg>`;
  Object.assign(btn.style, {
    marginLeft: "8px",
    padding: "4px 6px",
    fontSize: "12px",
    border: "1px solid #6d6e6f",
    borderRadius: "6px",
    background: "#fff",
    cursor: "pointer",
    color: "#1e1f21",
    fontWeight: "500",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
  });

  btn.addEventListener("click", (e) => {
    e.stopPropagation();
    const existingDropdown = document.getElementById(DROPDOWN_ID);
    if (existingDropdown) {
      removeDropdown();
      return;
    }
    const branchName = getBranchNameFromTaskPane();
    if (!branchName) {
      alert("No branch name found in task custom fields.");
      return;
    }
    const dropdown = createDropdown(branchName);
    wrapper.appendChild(dropdown);
  });

  wrapper.appendChild(btn);
  toolbar.appendChild(wrapper);
}

// Close dropdown when clicking outside
document.addEventListener("click", (e) => {
  const dropdown = document.getElementById(DROPDOWN_ID);
  if (
    dropdown &&
    !dropdown.contains(e.target) &&
    e.target.id !== INJECT_BTN_ID
  ) {
    removeDropdown();
  }
});

// Observe for task pane appearing/disappearing
const taskPaneObserver = new MutationObserver(() => {
  const toolbar = document.querySelector(".TaskPaneToolbar.TaskPane-header");
  if (toolbar && !document.getElementById(INJECT_BTN_ID)) {
    injectGitButton();
  }
  if (!toolbar) {
    removeDropdown();
  }
});

taskPaneObserver.observe(document.body, { childList: true, subtree: true });

// Initial injection attempt
injectGitButton();
