const MAX_BRANCH_LENGTH = 80;

export function sanitizeForBranch(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

export function generateBranchName(
  ticketType: string,
  taskId: string,
  title: string
): string {
  const type = sanitizeForBranch(ticketType);
  const prefix = `${type}/${taskId}/`;
  const maxTitleLength = MAX_BRANCH_LENGTH - prefix.length;

  if (maxTitleLength <= 0) {
    return `${type}/${taskId}`;
  }

  let sanitizedTitle = sanitizeForBranch(title);

  if (sanitizedTitle.length > maxTitleLength) {
    sanitizedTitle = sanitizedTitle.slice(0, maxTitleLength);
    const lastHyphen = sanitizedTitle.lastIndexOf("-");
    if (lastHyphen > 0) {
      sanitizedTitle = sanitizedTitle.slice(0, lastHyphen);
    }
  }

  return `${prefix}${sanitizedTitle}`;
}

export function generateCheckoutCommand(
  ticketType: string,
  taskId: string,
  title: string
): string {
  return `git checkout -b ${generateBranchName(ticketType, taskId, title)}`;
}
