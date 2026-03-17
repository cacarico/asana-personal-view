// background.js — Storage management, context menu, message routing

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
  const boardData = await getBoardData(boardId);
  boardData.hiddenColumns = [];
  await saveBoardData(boardId, boardData);
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

async function getActiveTabId(sender) {
  if (sender.tab) return sender.tab.id;
  const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
  return tab ? tab.id : null;
}

browser.runtime.onMessage.addListener(async (message, sender) => {
  switch (message.type) {
    case "GET_BOARD_DATA": {
      const boardData = await getBoardData(message.boardId);
      return boardData;
    }
    case "HIDE_COLUMN": {
      const hidden = await hideColumn(message.boardId, message.boardName, message.columnName);
      const tabId = await getActiveTabId(sender);
      if (tabId) updateBadge(tabId, hidden.length);
      return { hiddenColumns: hidden };
    }
    case "SHOW_COLUMN": {
      const hidden = await showColumn(message.boardId, message.columnName);
      const tabId = await getActiveTabId(sender);
      if (tabId) updateBadge(tabId, hidden.length);
      return { hiddenColumns: hidden };
    }
    case "RESET_BOARD": {
      await resetBoard(message.boardId);
      const tabId = await getActiveTabId(sender);
      if (tabId) updateBadge(tabId, 0);
      return { hiddenColumns: [] };
    }
    case "UPDATE_BADGE": {
      const tabId = await getActiveTabId(sender);
      if (tabId) updateBadge(tabId, message.count);
      return true;
    }
    default:
      return false;
  }
});

function updateBadge(tabId, count) {
  if (count > 0) {
    browser.action.setBadgeText({ text: String(count), tabId });
    browser.action.setBadgeBackgroundColor({ color: "#f06a6a", tabId });
  } else {
    browser.action.setBadgeText({ text: "", tabId });
  }
}
