# 🎲 Random Task Selector

An [Obsidian](https://obsidian.md) plugin that picks a random task from a Kanban-style markdown note. Useful for when you have too many tasks and need help deciding what to work on next.

## How It Works

The plugin parses a configured markdown note that uses headings as column separators and `- [ ]` checkboxes as tasks (standard Kanban board format). It presents a modal where you can toggle which heading groups to include, then randomly selects a task from the enabled groups.

### Expected Note Format

```markdown
## Backlog
- [ ] Design new landing page
- [ ] Write API documentation

## In Progress
- [ ] Fix login bug
- [ ] Update dependencies

## Completed
- [x] Set up CI/CD pipeline
```

- **Headings** (`## Heading`) define columns/groups
- **Unchecked tasks** (`- [ ] task`) are eligible for selection
- **Checked tasks** (`- [x] task`) are ignored

## Features

- **Random task selection** from a configurable source note
- **Toggle columns on/off** — choose which heading groups to pick from
- **Persisted preferences** — disabled columns are remembered between sessions
- **Fuzzy note search** — quickly change the source note via Obsidian's fuzzy picker
- **Quick actions** — copy task text, reroll, or jump to the source note
- **Ribbon icon** — one-click access from the sidebar

## Usage

### Pick a Random Task

1. Click the **🎲 dice icon** in the left ribbon, or run **"Pick a random task"** from the command palette (`Ctrl/Cmd + P`)
2. Toggle the heading groups you want to include
3. Click **🎲 Pick a Random Task**
4. Use the action buttons to copy, reroll, or navigate to the source note

### Change Source Note

- Run **"Change source note"** from the command palette to fuzzy-search and select a different markdown file
- Or go to **Settings → Random Task Selector** and click the 🔍 Search button

## Installation

### Manual

1. Download `main.js`, `manifest.json`, and `styles.css` from the latest release
2. Create a folder named `random-task-selector` in your vault's `.obsidian/plugins/` directory
3. Copy the three files into that folder
4. Enable the plugin in **Settings → Community Plugins**

### Build from Source

```bash
git clone <repo-url>
cd random-task-selector
npm install
npm run build
```

Copy the generated `main.js`, `manifest.json`, and `styles.css` into your vault's `.obsidian/plugins/random-task-selector/` folder.

## Development

- `npm run dev` — watch mode with hot rebuild
- `npm run build` — production build

## License

MIT
