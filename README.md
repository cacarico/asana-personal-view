# Asana Personal View

A Firefox extension that lets you hide columns on Asana board views for a personalized experience. Your team's board has columns you don't use? Hide them, your preferences are saved per-board and persist across sessions.

## Features

- Hide/show individual columns on any Asana board
- Per-board preferences saved automatically
- Right-click a column header to quickly hide it
- Popup UI to manage all columns at once
- "Show All" to temporarily reveal everything
- "Reset" to clear hidden columns for a board

## Installation

### Firefox (temporary)

1. Clone this repository
2. Open Firefox and navigate to `about:debugging#/runtime/this-firefox`
3. Click "Load Temporary Add-on..."
4. Select the `manifest.json` file from this project

### Chrome (unpacked)

1. Clone this repository
2. Open Chrome and navigate to `chrome://extensions`
3. Enable "Developer mode" (toggle in the top-right corner)
4. Click "Load unpacked"
5. Select the project folder containing `manifest.json`

### From .xpi (permanent, unsigned)

1. Build: `web-ext build` (requires [web-ext](https://extensionworkshop.com/documentation/develop/getting-started-with-web-ext/))
2. Install the generated `.xpi` file in Firefox

## Usage

1. Navigate to any Asana board view
2. **Popup:** Click the extension icon → toggle columns on/off
3. **Right-click:** Right-click a column header → "Hide this column"
4. **Show All:** Click "Show All" in the popup to temporarily see everything
5. **Reset:** Click "Reset" to clear all hidden columns for the current board

### Git Branch Button

When you open a task pane, a GitHub icon button appears in the task toolbar. Clicking it generates a `git checkout -b` command based on the task's custom fields and copies it to your clipboard.

**Branch name pattern:**

```
<nature-of-ticket>/<id>/<first-5-words-of-title>
```

**Example:** For a task titled "Create new service" with ID `ID-1514` and Nature `Ad hoc`:

```
ad-hoc/id-1***/create-new-service
```

The button reads these fields from the **Masterboard Software Development** project section in the task pane:

| Field  | Source                      | Example               |
| ------ | --------------------------- | --------------------- |
| Nature | "Nature of the ticket" enum | `Ad hoc` → `ad-hoc`   |
| ID     | "ID" text field             | `ID-1514` → `id-1514` |
| Title  | Task name (first 5 words)   | `create new service`  |

**How to use:**

1. Click on any task to open the task pane
2. Click the GitHub icon button in the task toolbar
3. A dropdown appears with the generated command, e.g. `git checkout -b ad-hoc/id-1514/create-new-service`
4. Click the command to copy it to your clipboard
5. Paste into your terminal

## Development

Load as a temporary extension via `about:debugging` for development. Changes to files require reloading the extension.

For live reloading during development:

```bash
npx web-ext run --source-dir .
```
