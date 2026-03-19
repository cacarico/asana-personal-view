export interface AsanaTaskInfo {
  taskId: string;
  projectId: string;
}

// New format: /1/WORKSPACE_ID/project/PROJECT_ID/task/TASK_ID
const NEW_URL_REGEX =
  /^https:\/\/app\.asana\.com\/1\/\d+\/project\/(\d+)\/task\/(\d+)/;
// Old format: /0/PROJECT_ID/TASK_ID
const OLD_URL_REGEX = /^https:\/\/app\.asana\.com\/0\/(\d+)\/(\d+)/;

export function parseAsanaUrl(url: string): AsanaTaskInfo | null {
  const newMatch = url.match(NEW_URL_REGEX);
  if (newMatch) {
    return { projectId: newMatch[1], taskId: newMatch[2] };
  }
  const oldMatch = url.match(OLD_URL_REGEX);
  if (oldMatch) {
    return { projectId: oldMatch[1], taskId: oldMatch[2] };
  }
  return null;
}

// Selectors for custom field rows in Asana's task detail view
const CUSTOM_FIELD_ROW_SELECTORS = [
  '[class*="CustomPropertyRow"]',
  '[class*="customField"]',
  '[class*="CustomField"]',
  '[class*="CustomProperty"]',
];

// --- Generic custom field extraction ---

function extractCustomFieldValue(fieldNames: string[]): string | null {
  // Strategy 1: scan custom field rows
  for (const rowSelector of CUSTOM_FIELD_ROW_SELECTORS) {
    const rows = document.querySelectorAll(rowSelector);
    for (const row of rows) {
      const value = matchFieldFromRow(row, fieldNames);
      if (value) return value;
    }
  }

  // Strategy 2: scan all elements in custom properties container
  const allElements = document.querySelectorAll(
    '[class*="CustomPropertiesContainer"] *'
  );
  for (const el of allElements) {
    if (isFieldLabel(el.textContent, fieldNames)) {
      const value = findAdjacentValue(el);
      if (value) return value;
    }
  }

  return null;
}

function matchFieldFromRow(
  row: Element,
  fieldNames: string[]
): string | null {
  const texts = row.querySelectorAll("*");
  let foundLabel = false;

  for (const el of texts) {
    const text = el.textContent?.trim() ?? "";

    if (!foundLabel && isFieldLabel(text, fieldNames)) {
      foundLabel = true;
      continue;
    }

    if (foundLabel && text && !isFieldLabel(text, fieldNames)) {
      return text;
    }
  }

  return null;
}

function isFieldLabel(
  text: string | null | undefined,
  fieldNames: string[]
): boolean {
  if (!text) return false;
  const normalized = text.trim().toLowerCase();
  return fieldNames.includes(normalized);
}

function findAdjacentValue(labelEl: Element): string | null {
  let sibling = labelEl.nextElementSibling;
  if (sibling?.textContent?.trim()) {
    return sibling.textContent.trim();
  }
  sibling = labelEl.parentElement?.nextElementSibling ?? null;
  if (sibling?.textContent?.trim()) {
    return sibling.textContent.trim();
  }
  return null;
}

// --- Ticket Type ---

const TYPE_FIELD_NAMES = ["type", "task type", "ticket type", "category"];

export function extractTicketType(): string {
  const value = extractCustomFieldValue(TYPE_FIELD_NAMES);
  if (!value) return "task";
  return sanitizeBranchSegment(value);
}

// --- Ticket ID ---

const ID_FIELD_NAMES = ["id", "ticket id", "task id"];

export function extractTicketId(): string | null {
  const value = extractCustomFieldValue(ID_FIELD_NAMES);
  if (!value) return null;
  // Keep the ID as-is but make it branch-safe (e.g. "ID-1062" → "ID-1062")
  return value
    .trim()
    .replace(/[^a-zA-Z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

// --- Helpers ---

function sanitizeBranchSegment(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}
