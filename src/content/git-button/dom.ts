import { AsanaTaskInfo, extractTicketType, extractTicketId } from "./asana";
import { generateCheckoutCommand } from "./branch";
import { copyToClipboard } from "./clipboard";
import { showToast } from "./toast";
import {
  BUTTON_STYLES,
  BUTTON_HOVER_STYLES,
  gitBranchIcon,
  checkmarkIcon,
} from "./styles";

const BUTTON_ID = "asana-git-branch-btn";

// Title selectors in priority order (Asana changes these periodically)
const TITLE_SELECTORS = [
  'textarea[aria-label="Task Name"]',
  'textarea[aria-label="Task name"]',
  '[class*="TaskName"] textarea',
  '[class*="TaskPaneTitle"] textarea',
  '[class*="TaskPane-title"] textarea',
  'h1[class*="TaskName"]',
  '[class*="TaskName"] h1',
  ".TaskPane-titleRow h1",
  ".TaskPane-titleRow textarea",
  '[class*="TaskPaneBody"] textarea',
  '[class*="TaskDetail"] textarea',
  '[class*="TaskHeader"] textarea',
];

export function removeButton(): void {
  document.getElementById(BUTTON_ID)?.remove();
}

export function injectButton(taskInfo: AsanaTaskInfo): void {
  if (document.getElementById(BUTTON_ID)) return;

  const toolbar = document.querySelector(
    ".TaskPaneToolbar.TaskPane-header",
  ) as HTMLElement | null;
  if (!toolbar) {
    waitForToolbar(() => injectButton(taskInfo));
    return;
  }

  const button = createButton(taskInfo);

  const wrapper = document.createElement("div");
  wrapper.style.cssText =
    "display: inline-flex; align-items: center; margin-left: 8px;";
  wrapper.appendChild(button);

  toolbar.appendChild(wrapper);
}

function findTitleElement(): Element | null {
  for (const selector of TITLE_SELECTORS) {
    const el = document.querySelector(selector);
    if (el) return el;
  }
  return null;
}

function extractTitle(): string {
  const el = findTitleElement();
  if (!el) return "";
  if (el instanceof HTMLTextAreaElement) return el.value.trim();
  return el.textContent?.trim() ?? "";
}

function createButton(taskInfo: AsanaTaskInfo): HTMLButtonElement {
  const btn = document.createElement("button");
  btn.id = BUTTON_ID;
  btn.title = "Copy git checkout command";
  btn.innerHTML = gitBranchIcon();
  btn.setAttribute("style", BUTTON_STYLES);

  btn.addEventListener("mouseenter", () => {
    btn.setAttribute("style", BUTTON_STYLES + BUTTON_HOVER_STYLES);
  });
  btn.addEventListener("mouseleave", () => {
    btn.setAttribute("style", BUTTON_STYLES);
  });

  btn.addEventListener("click", async (e) => {
    e.preventDefault();
    e.stopPropagation();

    const title = extractTitle();
    if (!title) {
      showToast("Could not read task title", true);
      return;
    }

    const ticketType = extractTicketType();
    const ticketId = extractTicketId() ?? taskInfo.taskId;
    const command = generateCheckoutCommand(ticketType, ticketId, title);
    const success = await copyToClipboard(command);

    if (success) {
      showToast(`Copied: ${command}`);
      btn.innerHTML = checkmarkIcon();
      setTimeout(() => {
        btn.innerHTML = gitBranchIcon();
      }, 1500);
    } else {
      showToast("Failed to copy to clipboard", true);
    }
  });

  return btn;
}

function waitForToolbar(callback: () => void): void {
  const observer = new MutationObserver((_mutations, obs) => {
    if (document.querySelector(".TaskPaneToolbar.TaskPane-header")) {
      obs.disconnect();
      callback();
    }
  });
  observer.observe(document.body, { childList: true, subtree: true });
  setTimeout(() => observer.disconnect(), 10_000);
}

// Observe for task pane appearing/disappearing to re-inject button
export function observeTaskPane(onAppear: () => void): void {
  const taskPaneObserver = new MutationObserver(() => {
    const toolbar = document.querySelector(
      ".TaskPaneToolbar.TaskPane-header",
    );
    if (toolbar && !document.getElementById(BUTTON_ID)) {
      onAppear();
    }
    if (!toolbar) {
      removeButton();
    }
  });

  taskPaneObserver.observe(document.body, { childList: true, subtree: true });
}
