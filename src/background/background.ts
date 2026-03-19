import { browser } from "../lib/browser";

// --- Types ---

interface BoardData {
  name: string;
  hiddenColumns: string[];
  lastVisited: string | null;
}

interface BoardsMap {
  [boardId: string]: BoardData;
}

// --- Validation helpers ---

function isValidBoardId(boardId: unknown): boardId is string {
  return typeof boardId === "string" && /^\d+$/.test(boardId);
}

function isValidColumnName(name: unknown): name is string {
  return typeof name === "string" && name.length > 0 && name.length <= 500;
}

// --- Storage helpers ---

async function getBoards(): Promise<BoardsMap> {
  const data = await browser.storage.local.get("boards");
  return (data.boards as BoardsMap) || {};
}

async function getBoardData(boardId: string): Promise<BoardData> {
  const boards = await getBoards();
  return boards[boardId] || { name: "", hiddenColumns: [], lastVisited: null };
}

async function saveBoardData(
  boardId: string,
  boardData: BoardData,
): Promise<void> {
  const boards = await getBoards();
  boards[boardId] = {
    ...boardData,
    lastVisited: new Date().toISOString(),
  };
  await browser.storage.local.set({ boards });
}

async function hideColumn(
  boardId: string,
  boardName: string,
  columnName: string,
): Promise<string[]> {
  const boardData = await getBoardData(boardId);
  boardData.name = boardName;
  if (!boardData.hiddenColumns.includes(columnName)) {
    boardData.hiddenColumns.push(columnName);
  }
  await saveBoardData(boardId, boardData);
  return boardData.hiddenColumns;
}

async function showColumn(
  boardId: string,
  columnName: string,
): Promise<string[]> {
  const boardData = await getBoardData(boardId);
  boardData.hiddenColumns = boardData.hiddenColumns.filter(
    (c) => c !== columnName,
  );
  await saveBoardData(boardId, boardData);
  return boardData.hiddenColumns;
}

async function resetBoard(boardId: string): Promise<void> {
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

browser.contextMenus.onClicked.addListener(
  (info: chrome.contextMenus.OnClickData, tab?: chrome.tabs.Tab) => {
    if (info.menuItemId === "hide-column" && tab?.id) {
      browser.tabs.sendMessage(tab.id, { type: "GET_RIGHT_CLICKED_COLUMN" });
    }
  },
);

// --- Message handling ---

async function getActiveTabId(
  sender: chrome.runtime.MessageSender,
): Promise<number | null> {
  if (sender.tab?.id) return sender.tab.id;
  const [tab] = await browser.tabs.query({
    active: true,
    currentWindow: true,
  });
  return tab?.id ?? null;
}

function handleMessage(
  message: any,
  sender: chrome.runtime.MessageSender,
  sendResponse: (response: any) => void,
): boolean {
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
        if (
          !isValidBoardId(message.boardId) ||
          !isValidColumnName(message.columnName)
        )
          return false;
        const boardName =
          typeof message.boardName === "string"
            ? message.boardName.slice(0, 500)
            : "";
        const hidden = await hideColumn(
          message.boardId,
          boardName,
          message.columnName,
        );
        const tabId = await getActiveTabId(sender);
        if (tabId) updateBadge(tabId, hidden.length);
        return { hiddenColumns: hidden };
      }
      case "SHOW_COLUMN": {
        if (
          !isValidBoardId(message.boardId) ||
          !isValidColumnName(message.columnName)
        )
          return false;
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
        const count =
          typeof message.count === "number" ? message.count : 0;
        const tabId = await getActiveTabId(sender);
        if (tabId) updateBadge(tabId, count);
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

browser.runtime.onMessage.addListener(handleMessage);

function updateBadge(tabId: number, count: number): void {
  if (count > 0) {
    browser.action.setBadgeText({ text: String(count), tabId });
    browser.action.setBadgeBackgroundColor({ color: "#f06a6a", tabId });
  } else {
    browser.action.setBadgeText({ text: "", tabId });
  }
}
