const TOAST_ID = "asana-git-branch-toast";
const TOAST_DURATION = 2500;

export function showToast(message: string, isError = false): void {
  document.getElementById(TOAST_ID)?.remove();

  const toast = document.createElement("div");
  toast.id = TOAST_ID;
  toast.textContent = message;
  toast.style.cssText = `
    position: fixed;
    bottom: 24px;
    right: 24px;
    padding: 12px 20px;
    background: ${isError ? "#e8384f" : "#2e2e30"};
    color: #fff;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    font-size: 13px;
    border-radius: 8px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    z-index: 99999;
    opacity: 0;
    transform: translateY(8px);
    transition: opacity 0.2s ease, transform 0.2s ease;
    max-width: 400px;
    word-break: break-all;
  `;

  document.body.appendChild(toast);

  requestAnimationFrame(() => {
    toast.style.opacity = "1";
    toast.style.transform = "translateY(0)";
  });

  setTimeout(() => {
    toast.style.opacity = "0";
    toast.style.transform = "translateY(8px)";
    setTimeout(() => toast.remove(), 200);
  }, TOAST_DURATION);
}
