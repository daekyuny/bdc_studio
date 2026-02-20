# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm install        # first time only — installs esbuild
npm run build      # bundle src/main.js → app.js (REQUIRED after any src/ edit)
npm run dev        # start static server on http://localhost:5173
```

**Critical:** `app.js` is a committed build artifact. Any change to a file under `src/` must be followed by `npm run build` before the change takes effect in the browser.

There are no lint or test scripts currently (TD-03).

## Architecture

Single-page static app. No framework, no backend. Source lives in `src/` as ES modules; esbuild bundles them into `app.js`. All state is persisted to a single `localStorage` key (`burndown-studio`).

### Data flow

```
User action → event listener (main.js)
           → state mutation (state.js) → save() → onChange()
           → render() (render.js) → full DOM rebuild
```

Every state change triggers a complete re-render (no diffing). `state.js` communicates to `render.js` via a callback registered by `main.js` (`setOnStateChange(render)`) — this avoids a circular import.

### Module responsibilities

| Module | Role |
|---|---|
| `main.js` | Entry point — wires all event listeners, registers the render callback |
| `dom.js` | Single source of truth for all DOM element references |
| `state.js` | All state mutations and localStorage load/save; fires `onChange` after every mutation |
| `burndown.js` | Pure functions: ideal/actual burndown line computation, capacity math |
| `chart.js` | Builds the SVG chart from burndown data (no external library) |
| `render.js` | Full DOM rebuild: sprint sidebar, form fields, task table, stats, calls chart.js |
| `io.js` | JSON file export (download) and import (file read + validation + `replaceState`) |
| `utils.js` | Pure helpers: ISO date math, `crypto.randomUUID()` wrapper, number formatting |

### Module dependency graph

```
main.js
├── dom.js
├── state.js ← utils.js
├── render.js
│   ├── dom.js
│   ├── state.js
│   ├── burndown.js ← utils.js
│   ├── chart.js ← dom.js, utils.js
│   └── utils.js
└── io.js ← state.js, utils.js
```

No circular dependencies. All date values are stored as `YYYY-MM-DD` strings. Task status is one of `"Todo" | "In Progress" | "Done"`.

## Key conventions

- **Input commit pattern** — inputs fire state updates on `blur`, `change`, and `Enter` keydown. Do not add `input` event listeners (would cause mid-typing re-renders).
- **State mutations** — always go through a named export in `state.js` (e.g. `updateSprint`, `updateTask`). Never mutate the state object directly from other modules.
- **New sprint defaults** — 4 developers, 0.8 efficiency, 14-day duration starting today.
- **`<template>` elements** in `index.html` are cloned by `render.js` for sprint list items and task rows. Don't remove them.
