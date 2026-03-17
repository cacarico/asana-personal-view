// popup.js — Column toggle UI

let currentBoardId = null;
let currentBoardName = "";
let showAllActive = false;

async function init() {
  const [tab] = await browser.tabs.query({ active: true, currentWindow: true });

  let response;
  try {
    response = await browser.tabs.sendMessage(tab.id, { type: "GET_COLUMNS" });
  } catch (e) {
    // Content script not loaded (not on Asana)
    showNoBoard();
    return;
  }

  if (!response || !response.boardId) {
    showNoBoard();
    return;
  }

  currentBoardId = response.boardId;
  currentBoardName = response.boardName;
  const columns = response.columns;

  const boardData = await browser.runtime.sendMessage({
    type: "GET_BOARD_DATA",
    boardId: currentBoardId,
  });

  const hiddenColumns = boardData.hiddenColumns || [];

  showBoardControls(columns, hiddenColumns);
}

function showNoBoard() {
  document.getElementById("no-board").style.display = "block";
  document.getElementById("board-controls").style.display = "none";
}

function showBoardControls(columns, hiddenColumns) {
  document.getElementById("no-board").style.display = "none";
  document.getElementById("board-controls").style.display = "block";
  document.getElementById("board-name").textContent = currentBoardName;

  const list = document.getElementById("column-list");
  list.innerHTML = "";

  columns.forEach((colName) => {
    const isHidden = hiddenColumns.includes(colName);

    const row = document.createElement("label");
    row.className = "column-row";

    const toggle = document.createElement("input");
    toggle.type = "checkbox";
    toggle.checked = !isHidden;
    toggle.addEventListener("change", () => onToggleColumn(colName, !toggle.checked));

    const name = document.createElement("span");
    name.className = "column-name";
    name.textContent = colName;

    row.appendChild(toggle);
    row.appendChild(name);
    list.appendChild(row);
  });

  // Replace buttons to clear old listeners
  const showAllBtn = document.getElementById("show-all-btn");
  const resetBtn = document.getElementById("reset-btn");
  showAllBtn.replaceWith(showAllBtn.cloneNode(true));
  resetBtn.replaceWith(resetBtn.cloneNode(true));
  document.getElementById("show-all-btn").addEventListener("click", onShowAll);
  document.getElementById("reset-btn").addEventListener("click", onReset);
}

async function onToggleColumn(columnName, hide) {
  const [tab] = await browser.tabs.query({ active: true, currentWindow: true });

  if (hide) {
    await browser.runtime.sendMessage({
      type: "HIDE_COLUMN",
      boardId: currentBoardId,
      boardName: currentBoardName,
      columnName,
    });
  } else {
    await browser.runtime.sendMessage({
      type: "SHOW_COLUMN",
      boardId: currentBoardId,
      columnName,
    });
  }

  // Tell content script to re-apply
  const boardData = await browser.runtime.sendMessage({
    type: "GET_BOARD_DATA",
    boardId: currentBoardId,
  });

  await browser.tabs.sendMessage(tab.id, {
    type: "APPLY_HIDING",
    hiddenColumns: boardData.hiddenColumns,
  });
}

async function onShowAll() {
  const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
  showAllActive = !showAllActive;

  const btn = document.getElementById("show-all-btn");
  btn.textContent = showAllActive ? "Restore Hidden" : "Show All";
  btn.classList.toggle("active", showAllActive);

  await browser.tabs.sendMessage(tab.id, {
    type: "SET_SHOW_ALL",
    enabled: showAllActive,
  });
}

async function onReset() {
  const [tab] = await browser.tabs.query({ active: true, currentWindow: true });

  await browser.runtime.sendMessage({
    type: "RESET_BOARD",
    boardId: currentBoardId,
  });

  await browser.tabs.sendMessage(tab.id, {
    type: "APPLY_HIDING",
    hiddenColumns: [],
  });

  // Refresh the popup
  init();
}

init();
