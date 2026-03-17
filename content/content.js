// content.js — DOM observation, column detection, CSS hiding

// --- URL parsing ---

function getBoardIdFromUrl() {
  // Asana board URLs: https://app.asana.com/0/PROJECT_ID/...
  const match = window.location.pathname.match(/^\/0\/(\d+)/);
  return match ? match[1] : null;
}

// --- State ---

let currentBoardId = null;
let showAllMode = false;
let lastRightClickedColumn = null;

// --- Board detection ---

function isBoardView() {
  return document.querySelector('[class*="BoardBody"], [class*="BoardColumn"]') !== null;
}

function getColumns() {
  const columnElements = document.querySelectorAll(
    '[class*="BoardColumn"]:not([class*="BoardColumnAdd"])'
  );

  return Array.from(columnElements)
    .map((el) => {
      const headerEl = el.querySelector('[class*="BoardColumnHeader"] textarea, [class*="BoardColumnHeader"] [class*="SectionName"]');
      const name = headerEl ? headerEl.textContent.trim() : "";
      return { name, element: el };
    })
    .filter((col) => col.name !== "");
}

function getBoardName() {
  const heading = document.querySelector('[class*="ProjectHeader"] h1, [class*="TopbarPageHeaderStructure"] [class*="NavigationLink"]');
  return heading ? heading.textContent.trim() : "Unknown Board";
}

// --- CSS injection for hiding columns ---

const STYLE_ID = "asana-personal-view-styles";

function getOrCreateStyleElement() {
  let style = document.getElementById(STYLE_ID);
  if (!style) {
    style = document.createElement("style");
    style.id = STYLE_ID;
    document.head.appendChild(style);
  }
  return style;
}

function applyHiddenColumns(hiddenColumnNames) {
  const style = getOrCreateStyleElement();

  if (showAllMode || hiddenColumnNames.length === 0) {
    style.textContent = "";
    return;
  }

  const columns = getColumns();
  const rules = [];

  columns.forEach((col, index) => {
    if (hiddenColumnNames.includes(col.name)) {
      rules.push(
        `[class*="BoardBody"] > :nth-child(${index + 1}) { display: none !important; }`
      );
    }
  });

  style.textContent = rules.join("\n");
}

function removeAllHiding() {
  const style = document.getElementById(STYLE_ID);
  if (style) {
    style.textContent = "";
  }
}

// --- Main observation loop ---

let debounceTimer = null;

async function onBoardChanged() {
  const boardId = getBoardIdFromUrl();
  if (!boardId || !isBoardView()) {
    currentBoardId = null;
    removeAllHiding();
    browser.runtime.sendMessage({ type: "UPDATE_BADGE", count: 0 }).catch(() => {});
    return;
  }

  currentBoardId = boardId;

  try {
    const boardData = await browser.runtime.sendMessage({
      type: "GET_BOARD_DATA",
      boardId,
    });

    applyHiddenColumns(boardData.hiddenColumns || []);

    browser.runtime.sendMessage({
      type: "UPDATE_BADGE",
      count: (boardData.hiddenColumns || []).length,
    }).catch(() => {});
  } catch (e) {
    // Background script may not be ready yet
  }
}

function debouncedBoardCheck() {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(onBoardChanged, 300);
}

// --- MutationObserver ---

const observer = new MutationObserver(debouncedBoardCheck);

observer.observe(document.body, {
  childList: true,
  subtree: true,
});

// Initial check
onBoardChanged();

// --- URL change detection for SPA navigation ---
let lastUrl = window.location.href;

setInterval(() => {
  if (window.location.href !== lastUrl) {
    lastUrl = window.location.href;
    debouncedBoardCheck();
  }
}, 500);

// --- Right-click tracking ---

document.addEventListener("contextmenu", (e) => {
  const columnEl = e.target.closest('[class*="BoardColumn"]');
  if (columnEl) {
    const headerEl = columnEl.querySelector(
      '[class*="BoardColumnHeader"] textarea, [class*="BoardColumnHeader"] [class*="SectionName"]'
    );
    lastRightClickedColumn = headerEl ? headerEl.textContent.trim() : null;
  } else {
    lastRightClickedColumn = null;
  }
});

// --- Message listener (from background/popup) ---

browser.runtime.onMessage.addListener(async (message) => {
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
      return { columns, boardId: currentBoardId, boardName: getBoardName() };
    }
    case "APPLY_HIDING": {
      applyHiddenColumns(message.hiddenColumns);
      return true;
    }
    case "SET_SHOW_ALL": {
      showAllMode = message.enabled;
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
});
