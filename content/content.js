// content.js — DOM observation, column detection, CSS hiding

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

// --- Board detection ---

function isBoardView() {
  // BoardBody-dragSelectContainer is the main board area
  return document.querySelector('.BoardBody-dragSelectContainer') !== null;
}

function getColumns() {
  // Headers are in BoardBody-headerDraggableItemWrapper elements.
  // Each contains a BoardGroupHeader with an H2 for the column name.
  // Exclude the BoardAddSection (add column button).
  const headerWrappers = document.querySelectorAll(
    '.BoardBody-headerDraggableItemWrapper'
  );

  return Array.from(headerWrappers)
    .map((el, index) => {
      const h2 = el.querySelector('.BoardGroupHeaderContents h2');
      const name = h2 ? h2.textContent.trim() : "";
      return { name, element: el, index };
    })
    .filter((col) => col.name !== "");
}

function getBoardName() {
  // Try common project header selectors
  const heading = document.querySelector('h1[class*="Typography"]') ||
    document.querySelector('[class*="ProjectHeader"] h1');
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

  columns.forEach((col) => {
    if (hiddenColumnNames.includes(col.name)) {
      // nth-child is 1-based; col.index is 0-based position among header wrappers.
      // Headers and column bodies are in separate SortableLists but share the same index.
      const nth = col.index + 1;
      // Hide the header wrapper (in the header sortable list)
      rules.push(
        `.BoardBody-columnSortableList > .BoardBody-headerDraggableItemWrapper:nth-child(${nth}) { display: none !important; }`
      );
      // Hide the column body wrapper (in the column sortable list)
      rules.push(
        `.BoardBody-columnSortableList > .BoardBody-columnDraggableItemWrapper:nth-child(${nth}) { display: none !important; }`
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
  // Check if right-click is on a column header area or column body
  const headerWrapper = e.target.closest('.BoardBody-headerDraggableItemWrapper');
  const columnWrapper = e.target.closest('.BoardBody-columnDraggableItemWrapper');
  const target = headerWrapper || columnWrapper;

  if (target) {
    // If clicked on header, get name directly; if on column body, find matching header by index
    const h2 = headerWrapper
      ? headerWrapper.querySelector('.BoardGroupHeaderContents h2')
      : null;
    if (h2) {
      lastRightClickedColumn = h2.textContent.trim();
    } else if (columnWrapper) {
      // Find the index of this column wrapper among its siblings
      const parent = columnWrapper.parentElement;
      const siblings = Array.from(parent.querySelectorAll('.BoardBody-columnDraggableItemWrapper'));
      const idx = siblings.indexOf(columnWrapper);
      // Match with the header at the same index
      const columns = getColumns();
      const matched = columns.find((c) => c.index === idx);
      lastRightClickedColumn = matched ? matched.name : null;
    }
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
