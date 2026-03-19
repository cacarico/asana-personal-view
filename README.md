# Asana Personal View

A browser extension (Firefox & Chrome) that lets you hide columns on Asana board views and quickly copy git branch checkout commands from task details.

## Features

### Column Hiding
- Hide/show individual columns on any Asana board
- Per-board preferences saved automatically
- Right-click a column header to quickly hide it
- Popup UI to manage all columns at once
- "Show All" to temporarily reveal everything
- "Reset" to clear hidden columns for a board

### Git Branch Button
- Adds a button to the task detail toolbar
- Generates `git checkout -b type/id/title` commands from task custom fields
- Copies the command to clipboard on click with toast confirmation
- Supports generic custom field extraction (type, id, ticket id, etc.)
- Smart branch name truncation at word boundaries (80 char max)

## Installation

### Firefox (from source)

1. Clone this repo and run `npm install && npm run build`
2. Open `about:debugging#/runtime/this-firefox`
3. Click "Load Temporary Add-on..."
4. Select `dist/firefox/manifest.json`

### Chrome (from source)

1. Clone this repo and run `npm install && npm run build`
2. Open `chrome://extensions`
3. Enable "Developer mode"
4. Click "Load unpacked"
5. Select the `dist/chrome/` directory

## Development

```bash
npm install
npm run build          # Build for both browsers
npm run build:prod     # Minified production build
npm run watch          # Watch mode with auto-rebuild
npm run typecheck      # TypeScript type checking
npm run clean          # Remove dist/
```

The build outputs to `dist/firefox/` and `dist/chrome/`, each self-contained and loadable directly.

For live reloading during Firefox development:
```bash
npx web-ext run --source-dir dist/firefox
```

## Project Structure

```
src/
  lib/browser.ts              # Cross-browser API shim (Firefox/Chrome)
  background/background.ts    # Storage, context menu, badge
  popup/popup.ts              # Column toggle popup UI
  content/
    content.ts                # Entry point, wires both features
    columns.ts                # Column hiding + SPA navigation
    git-button/
      dom.ts                  # Button injection into task toolbar
      asana.ts                # URL parsing, custom field extraction
      branch.ts               # Branch name generation
      clipboard.ts            # Clipboard with fallback
      toast.ts                # Toast notifications
      styles.ts               # Button styles and icons
static/
  manifest.firefox.json       # Firefox manifest (MV3)
  manifest.chrome.json        # Chrome manifest (MV3)
  popup/                      # Popup HTML/CSS
  icons/                      # Extension icons
```
