export const BUTTON_STYLES = `
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border: none;
  border-radius: 6px;
  background: #4169E1;
  color: #ffffff;
  cursor: pointer;
  padding: 4px;
  position: relative;
  z-index: 99999;
  flex-shrink: 0;
  transition: background 0.15s ease;
  box-shadow: 0 2px 4px rgba(0,0,0,0.2);
`;

export const BUTTON_HOVER_STYLES = `
  background: #3457C9;
`;

export function gitBranchIcon(): string {
  return `<svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
    <path d="M11.75 2.5a.75.75 0 1 0 0 1.5.75.75 0 0 0 0-1.5zm-2.25.75a2.25 2.25 0 1 1 3 2.122V6A2.5 2.5 0 0 1 10 8.5H6a1 1 0 0 0-1 1v1.128a2.251 2.251 0 1 1-1.5 0V5.372a2.25 2.25 0 1 1 1.5 0v1.836A2.493 2.493 0 0 1 6 7h4a1 1 0 0 0 1-1v-.628A2.25 2.25 0 0 1 9.5 3.25zM4.25 12a.75.75 0 1 0 0 1.5.75.75 0 0 0 0-1.5zM4.25 2.5a.75.75 0 1 0 0 1.5.75.75 0 0 0 0-1.5z"/>
  </svg>`;
}

export function checkmarkIcon(): string {
  return `<svg width="16" height="16" viewBox="0 0 16 16" fill="#4ecdc4" xmlns="http://www.w3.org/2000/svg">
    <path d="M13.78 4.22a.75.75 0 0 1 0 1.06l-7.25 7.25a.75.75 0 0 1-1.06 0L2.22 9.28a.75.75 0 1 1 1.06-1.06L6 10.94l6.72-6.72a.75.75 0 0 1 1.06 0z"/>
  </svg>`;
}
