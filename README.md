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

### From source (temporary)

1. Clone this repository
2. Open Firefox and navigate to `about:debugging#/runtime/this-firefox`
3. Click "Load Temporary Add-on..."
4. Select the `manifest.json` file from this project

### From .xpi (permanent, unsigned)

1. Build: `web-ext build` (requires [web-ext](https://extensionworkshop.com/documentation/develop/getting-started-with-web-ext/))
2. Install the generated `.xpi` file in Firefox

## Usage

1. Navigate to any Asana board view
2. **Popup:** Click the extension icon → toggle columns on/off
3. **Right-click:** Right-click a column header → "Hide this column"
4. **Show All:** Click "Show All" in the popup to temporarily see everything
5. **Reset:** Click "Reset" to clear all hidden columns for the current board

## Development

Load as a temporary extension via `about:debugging` for development. Changes to files require reloading the extension.

For live reloading during development:
```bash
npx web-ext run --source-dir .
```
