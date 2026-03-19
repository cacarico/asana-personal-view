export const browser: typeof chrome =
  (globalThis as any).browser ?? (globalThis as any).chrome;
