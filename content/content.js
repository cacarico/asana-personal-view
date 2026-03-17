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
  return document.querySelector('.BoardBody-dragSelectContainer');
}

function isBoardView() {
  return getBoardContainer() !== null;
}

function getColumns() {
  const headerWrappers = document.querySelectorAll(
    '.BoardBody-headerDraggableItemWrapper'
  );
  const bodyWrappers = document.querySelectorAll(
    '.BoardBody-columnDraggableItemWrapper'
  );

  const columns = [];
  headerWrappers.forEach((el, index) => {
    const h2 = el.querySelector('.BoardGroupHeaderContents h2');
    const name = h2 ? h2.textContent.trim() : null;
    if (name) {
      columns.push({ name, headerElement: el, bodyElement: bodyWrappers[index] || null });
    }
  });
  return columns;
}

function getBoardName() {
  const heading = document.querySelector('h1[class*="Typography"]') ||
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
      browser.runtime.sendMessage({ type: "UPDATE_BADGE", count: 0 }).catch(() => {});
      return;
    }

    currentBoardId = boardId;

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
  const headerWrapper = e.target.closest('.BoardBody-headerDraggableItemWrapper');
  const columnWrapper = e.target.closest('.BoardBody-columnDraggableItemWrapper');
  const target = headerWrapper || columnWrapper;

  if (target) {
    const h2 = headerWrapper
      ? headerWrapper.querySelector('.BoardGroupHeaderContents h2')
      : null;
    if (h2) {
      lastRightClickedColumn = h2.textContent.trim();
    } else if (columnWrapper) {
      const parent = columnWrapper.parentElement;
      const siblings = Array.from(parent.children).filter(
        (el) => el.classList.contains('BoardBody-columnDraggableItemWrapper')
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
        return { columns, boardId: currentBoardId, boardName: getBoardName(), showAllMode };
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

  handler().then(sendResponse).catch(() => sendResponse(false));
  return true;
}

browser.runtime.onMessage.addListener(handleContentMessage);
