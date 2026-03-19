import { initColumns, setupSpaNavigation } from "./columns";
import { parseAsanaUrl } from "./git-button/asana";
import { injectButton, removeButton, observeTaskPane } from "./git-button/dom";

function attemptGitButtonInjection(): void {
  const taskInfo = parseAsanaUrl(window.location.href);
  if (!taskInfo) {
    removeButton();
    return;
  }
  injectButton(taskInfo);
}

// Wire SPA navigation ONCE for both features
setupSpaNavigation(() => {
  removeButton();
  setTimeout(attemptGitButtonInjection, 300);
});

// Initialize column hiding
initColumns();

// Initialize git button
attemptGitButtonInjection();
observeTaskPane(attemptGitButtonInjection);
