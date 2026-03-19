import { browser } from "../lib/browser";

// --- Types ---

interface Column {
  name: string;
  headerElement: HTMLElement;
  bodyElement: HTMLElement | null;
}

// --- State ---

let currentBoardId: string | null = null;
let showAllMode = false;
let lastRightClickedColumn: string | null = null;
let boardChangeInFlight = false;

// --- URL parsing ---

function getBoardIdFromUrl(): string | null {
  const boardMatch = window.location.pathname.match(
    /\/project\/(\d+)\/board/,
  );
  if (boardMatch) return boardMatch[1];
  const legacyMatch = window.location.pathname.match(/^\/0\/(\d+)/);
  return legacyMatch ? legacyMatch[1] : null;
}

// --- Board detection ---

function getBoardContainer(): Element | null {
  return document.querySelector(".BoardBody-dragSelectContainer");
}

function isBoardView(): boolean {
  return getBoardContainer() !== null;
}

function getColumns(): Column[] {
  const headerWrappers = document.querySelectorAll(
    ".BoardBody-headerDraggableItemWrapper",
  );
  const bodyWrappers = document.querySelectorAll(
    ".BoardBody-columnDraggableItemWrapper",
  );

  const columns: Column[] = [];
  headerWrappers.forEach((el, index) => {
    const h2 = el.querySelector(".BoardGroupHeaderContents h2");
    const name = h2 ? h2.textContent!.trim() : null;
    if (name) {
      columns.push({
        name,
        headerElement: el as HTMLElement,
        bodyElement: (bodyWrappers[index] as HTMLElement) || null,
      });
    }
  });
  return columns;
}

function getBoardName(): string {
  const heading =
    document.querySelector('h1[class*="Typography"]') ||
    document.querySelector('[class*="ProjectHeader"] h1');
  return heading ? heading.textContent!.trim() : "Unknown Board";
}

// --- Direct DOM hiding for columns ---

function applyHiddenColumns(hiddenColumnNames: string[]): void {
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

function removeAllHiding(): void {
  const columns = getColumns();
  columns.forEach((col) => {
    col.headerElement.style.display = "";
    if (col.bodyElement) {
      col.bodyElement.style.display = "";
    }
  });
}

// --- Main observation loop ---

let debounceTimer: ReturnType<typeof setTimeout> | null = null;

async function onBoardChanged(): Promise<void> {
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
  } catch (e: any) {
    console.warn("[Asana Personal View] board check failed:", e.message);
  } finally {
    boardChangeInFlight = false;
  }
}

export function debouncedBoardCheck(): void {
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(onBoardChanged, 300);
}

// --- MutationObserver (scoped to board container when possible) ---

let observer: MutationObserver | null = null;

function startObserver(): void {
  if (observer) observer.disconnect();

  const target = getBoardContainer() || document.body;
  observer = new MutationObserver(debouncedBoardCheck);
  observer.observe(target, { childList: true, subtree: true });
}

// --- SPA navigation detection (shared by all features) ---

let lastUrl = window.location.href;
let spaCallbacks: Array<() => void> = [];

export function setupSpaNavigation(callback: () => void): void {
  spaCallbacks.push(callback);

  // Only patch history once (on first call)
  if (spaCallbacks.length > 1) return;

  const onNavigate = () => {
    if (window.location.href !== lastUrl) {
      lastUrl = window.location.href;
      startObserver();
      debouncedBoardCheck();
      spaCallbacks.forEach((cb) => cb());
    }
  };

  window.addEventListener("popstate", onNavigate);

  const originalPushState = history.pushState.bind(history);
  const originalReplaceState = history.replaceState.bind(history);

  history.pushState = function (...args: Parameters<typeof history.pushState>) {
    const result = originalPushState(...args);
    onNavigate();
    return result;
  };

  history.replaceState = function (
    ...args: Parameters<typeof history.replaceState>
  ) {
    const result = originalReplaceState(...args);
    onNavigate();
    return result;
  };
}

// --- Right-click tracking ---

function setupContextMenuTracking(): void {
  document.addEventListener("contextmenu", (e) => {
    const target = e.target as HTMLElement;
    const headerWrapper = target.closest(
      ".BoardBody-headerDraggableItemWrapper",
    );
    const columnWrapper = target.closest(
      ".BoardBody-columnDraggableItemWrapper",
    );
    const matched = headerWrapper || columnWrapper;

    if (matched) {
      const h2 = headerWrapper
        ? headerWrapper.querySelector(".BoardGroupHeaderContents h2")
        : null;
      if (h2) {
        lastRightClickedColumn = h2.textContent!.trim();
      } else if (columnWrapper) {
        const parent = columnWrapper.parentElement;
        if (parent) {
          const siblings = Array.from(parent.children).filter((el) =>
            el.classList.contains("BoardBody-columnDraggableItemWrapper"),
          );
          const idx = siblings.indexOf(columnWrapper);
          const columns = getColumns();
          const col = idx >= 0 && idx < columns.length ? columns[idx] : null;
          lastRightClickedColumn = col ? col.name : null;
        }
      }
    } else {
      lastRightClickedColumn = null;
    }
  });
}

// --- Message listener (from background/popup) ---

function setupColumnMessageHandler(): void {
  function handleContentMessage(
    message: any,
    _sender: chrome.runtime.MessageSender,
    sendResponse: (response: any) => void,
  ): boolean {
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
}

// --- Init ---

export function initColumns(): void {
  startObserver();
  onBoardChanged();
  setupContextMenuTracking();
  setupColumnMessageHandler();
}
