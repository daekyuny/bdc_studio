# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm install        # first time only — installs esbuild, typescript, tsx
npm run build      # bundle src/main.ts → app.js (REQUIRED after any src/ edit)
npm run dev        # start static server on http://localhost:5173
npm run test       # run unit tests via tsx
npm run typecheck  # run tsc --noEmit (zero errors expected)
```

**Critical:** `app.js` is a committed build artifact. Any change to a file under `src/` must be followed by `npm run build` before the change takes effect in the browser.

## Architecture

Single-page static app. No framework, no backend. Source lives in `src/` as TypeScript modules; esbuild bundles them into `app.js`. All state is persisted to a single `localStorage` key (`burndown-studio`). Shared types are defined in `src/types.ts`; ambient declarations for CDN globals (flatpickr, XLSX) are in `src/globals.d.ts`.

### Data flow

```
User action → event listener (main.ts)
           → state mutation (state.ts) → save() → onChange(hints)
           → render(hints) (render.ts) → selective DOM rebuild
```

State mutations pass a **bitmask hint** (`H_SIDEBAR`, `H_HEADER`, `H_TASKS`, `H_PANEL`, `H_STATS`, `H_CHART`, `H_BACKLOG`) to `onChange()`, and `render()` only rebuilds the flagged UI regions. If no hints are provided, all regions are rebuilt (backward-compatible). `state.ts` communicates to `render.ts` via a callback registered by `main.ts` (`setOnStateChange(render)`) — this avoids a circular import.

### Module responsibilities

| Module | Role |
|---|---|
| `main.ts` | Entry point — wires all event listeners, registers the render callback |
| `dom.ts` | Single source of truth for all DOM element references |
| `state.ts` | All state mutations, localStorage load/save, render hint constants; fires `onChange(hints)` after every mutation |
| `burndown.ts` | Pure functions: ideal/actual burndown line computation, capacity math |
| `chart.ts` | Builds the SVG chart from burndown data (no external library) |
| `render.ts` | Selective DOM rebuild: sprint sidebar, header, task table, backlog panel, stats, chart; skips regions not flagged in hints |
| `io.ts` | JSON file export (download) and import (file read + validation + `replaceState`) |
| `utils.ts` | Pure helpers: ISO date math, `crypto.randomUUID()` wrapper, number formatting |

### Module dependency graph

```
main.ts
├── dom.ts
├── state.ts ← utils.ts
├── render.ts
│   ├── dom.ts
│   ├── state.ts
│   ├── burndown.ts ← utils.ts
│   ├── chart.ts ← dom.ts, utils.ts
│   └── utils.ts
└── io.ts ← state.ts, utils.ts, dom.ts
```

No circular dependencies. All date values are stored as `YYYY-MM-DD` strings. Task status is one of `"Todo" | "In Progress" | "Done"`.

## Key conventions

- **Input commit pattern** — inputs fire state updates on `blur`, `change`, and `Enter` keydown. Do not add `input` event listeners (would cause mid-typing re-renders).
- **State mutations** — always go through a named export in `state.ts` (e.g. `updateSprint`, `updateTask`). Never mutate the state object directly from other modules.
- **New sprint defaults** — 4 developers, 0.8 efficiency, 14-day duration starting today.
- **`<template>` elements** in `index.html` are cloned by `render.ts` for sprint list items and task rows. Don't remove them.
