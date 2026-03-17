// background.js — Storage management, context menu, message routing

const browser = globalThis.browser || globalThis.chrome;

// --- Validation helpers ---

function isValidBoardId(boardId) {
  return typeof boardId === "string" && /^\d+$/.test(boardId);
}

function isValidColumnName(name) {
  return typeof name === "string" && name.length > 0 && name.length <= 500;
}

// --- Storage helpers ---

async function getBoards() {
  const data = await browser.storage.local.get("boards");
  return data.boards || {};
}

async function getBoardData(boardId) {
  const boards = await getBoards();
  return boards[boardId] || { name: "", hiddenColumns: [], lastVisited: null };
}

async function saveBoardData(boardId, boardData) {
  const boards = await getBoards();
  boards[boardId] = {
    ...boardData,
    lastVisited: new Date().toISOString(),
  };
  await browser.storage.local.set({ boards });
}

async function hideColumn(boardId, boardName, columnName) {
  const boardData = await getBoardData(boardId);
  boardData.name = boardName;
  if (!boardData.hiddenColumns.includes(columnName)) {
    boardData.hiddenColumns.push(columnName);
  }
  await saveBoardData(boardId, boardData);
  return boardData.hiddenColumns;
}

async function showColumn(boardId, columnName) {
  const boardData = await getBoardData(boardId);
  boardData.hiddenColumns = boardData.hiddenColumns.filter((c) => c !== columnName);
  await saveBoardData(boardId, boardData);
  return boardData.hiddenColumns;
}

async function resetBoard(boardId) {
  const boards = await getBoards();
  if (!boards[boardId]) return;
  boards[boardId].hiddenColumns = [];
  boards[boardId].lastVisited = new Date().toISOString();
  await browser.storage.local.set({ boards });
}

// --- Context menu ---

browser.runtime.onInstalled.addListener(() => {
  browser.contextMenus.create({
    id: "hide-column",
    title: "Hide this column",
    contexts: ["page"],
    documentUrlPatterns: ["*://app.asana.com/*"],
  });
});

browser.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId === "hide-column") {
    browser.tabs.sendMessage(tab.id, { type: "GET_RIGHT_CLICKED_COLUMN" });
  }
});

// --- Message handling ---
// Uses sendResponse pattern for Chrome compatibility (chrome.runtime.onMessage
// does not support returning Promises from listeners).

async function getActiveTabId(sender) {
  if (sender.tab) return sender.tab.id;
  const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
  return tab ? tab.id : null;
}

function handleMessage(message, sender, sendResponse) {
  if (!message || typeof message.type !== "string") {
    sendResponse(false);
    return false;
  }

  const handler = async () => {
    switch (message.type) {
      case "GET_BOARD_DATA": {
        if (!isValidBoardId(message.boardId)) return false;
        return await getBoardData(message.boardId);
      }
      case "HIDE_COLUMN": {
        if (!isValidBoardId(message.boardId) || !isValidColumnName(message.columnName)) return false;
        const boardName = typeof message.boardName === "string" ? message.boardName.slice(0, 500) : "";
        const hidden = await hideColumn(message.boardId, boardName, message.columnName);
        const tabId = await getActiveTabId(sender);
        if (tabId) updateBadge(tabId, hidden.length);
        return { hiddenColumns: hidden };
      }
      case "SHOW_COLUMN": {
        if (!isValidBoardId(message.boardId) || !isValidColumnName(message.columnName)) return false;
        const hidden = await showColumn(message.boardId, message.columnName);
        const tabId = await getActiveTabId(sender);
        if (tabId) updateBadge(tabId, hidden.length);
        return { hiddenColumns: hidden };
      }
      case "RESET_BOARD": {
        if (!isValidBoardId(message.boardId)) return false;
        await resetBoard(message.boardId);
        const tabId = await getActiveTabId(sender);
        if (tabId) updateBadge(tabId, 0);
        return { hiddenColumns: [] };
      }
      case "UPDATE_BADGE": {
        const count = typeof message.count === "number" ? message.count : 0;
        const tabId = await getActiveTabId(sender);
        if (tabId) updateBadge(tabId, count);
        return true;
      }
      default:
        return false;
    }
  };

  handler().then(sendResponse).catch(() => sendResponse(false));
  return true; // Keep message channel open for async sendResponse
}

browser.runtime.onMessage.addListener(handleMessage);

function updateBadge(tabId, count) {
  if (count > 0) {
    browser.action.setBadgeText({ text: String(count), tabId });
    browser.action.setBadgeBackgroundColor({ color: "#f06a6a", tabId });
  } else {
    browser.action.setBadgeText({ text: "", tabId });
  }
}
