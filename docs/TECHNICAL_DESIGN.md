# Burndown Studio — Technical Design Document

**Version:** 0.3
**Last updated:** 2026-02-20
**Status:** Draft — open for review

---

## 1. Architecture Overview

Burndown Studio is a **static single-page application** with a modular JavaScript source and an esbuild bundling step. There is no framework and no backend. The source code is organized as ES modules under `src/`, which are bundled into a single `app.js` for browser consumption.

```
Browser
  ├── index.html        (UI structure + templates)
  ├── styles.css        (layout, theming, animations)
  └── app.js            (bundled from src/ via esbuild)
          │
          └── localStorage ("burndown-studio" key)

Development
  └── src/
      ├── main.js       → entry point, event wiring
      ├── dom.js        → DOM element references
      ├── state.js      → state management, CRUD
      ├── burndown.js   → pure calculation functions
      ├── chart.js      → SVG chart rendering
      ├── render.js     → DOM rendering (sidebar, tasks, stats)
      ├── io.js         → JSON export/import
      └── utils.js      → shared helpers (dates, IDs)
```

### Design Principles
- **Open and run** — open `index.html` directly in a browser (`file://` works, no server required).
- **Modular source** — 8 focused ES modules for clean separation and parallel development.
- **Single build step** — `npm run build` bundles `src/` → `app.js` via esbuild.
- **Minimal dependencies** — only dev dependency is esbuild. No runtime dependencies (except Google Fonts via CDN).
- **Single global state** — one JS object, one localStorage key.
- **Full re-render** — every state change triggers a complete DOM rebuild via `render()`.

## 2. Tech Stack

| Layer | Technology | Notes |
|---|---|---|
| Markup | HTML5 | Semantic elements, `<template>` for row/item cloning |
| Styling | Vanilla CSS | CSS custom properties, grid, responsive breakpoints |
| Logic | Vanilla JS (ES2020+) | `crypto.randomUUID()`, ES modules, arrow functions |
| Chart | Hand-rolled SVG | `<polyline>` elements built via DOM API |
| Fonts | Google Fonts (CDN) | Fraunces (headings), Source Sans 3 (body) |
| Storage | localStorage | Single JSON blob under `burndown-studio` key |
| Bundler | esbuild | Bundles ES modules into single `app.js` |
| Serving | Any static server or `file://` | `python3 -m http.server`, or open `index.html` directly |
| Version control | Git + GitHub | Remote: `git@github.com:daekyuny/bdc_studio.git` |

## 3. Build Pipeline

```
src/*.js  ──esbuild──▶  app.js  ──browser──▶  runs in any browser
```

| Command | Description |
|---|---|
| `npm install` | Install esbuild (first time only) |
| `npm run build` | Bundle `src/main.js` → `app.js` |
| `npm run dev` | Start local dev server on port 5173 |

`app.js` is committed to git so the app works out-of-the-box after cloning — no build step needed to just use the app. The build step is only required after editing files in `src/`.

## 4. Data Model

All state is stored as a single JSON object in `localStorage`:

```
burndown-studio (localStorage key)
│
├── activeSprintId: string (UUID)
└── sprints: Array
    └── Sprint
        ├── id: string (UUID)
        ├── name: string
        ├── startDate: string (YYYY-MM-DD)
        ├── endDate: string (YYYY-MM-DD)
        ├── developers: number
        ├── efficiency: number (0-1)
        ├── createdAt: string (ISO 8601)
        └── tasks: Array
            └── Task
                ├── id: string (UUID)
                ├── name: string
                ├── points: number
                ├── status: "Todo" | "In Progress" | "Done"
                └── doneDate: string (YYYY-MM-DD) or ""
```

### Storage Limits
- localStorage is typically capped at **5-10 MB** per origin.
- A sprint with 50 tasks is roughly 3-4 KB of JSON.
- Practical limit: ~1,000+ sprints before hitting storage concerns.

### Data Safety
- JSON export/import provides backup and portability (`io.js`).
- `loadState()` in `state.js` wraps `JSON.parse` in try/catch — corrupt data is detected, logged, and reset to defaults.

## 5. Key Algorithms

### 5.1 Working Days Calculation (`getWorkingDates` in `utils.js`)
- Iterates from `startDate` to `endDate` inclusive.
- Excludes Saturday (day 6) and Sunday (day 0).
- Returns an array of ISO date strings.
- **Gap:** Does not exclude holidays or PTO.

### 5.2 Burndown Calculation (`calculateBurndown` in `burndown.js`)
- **Total points:** Sum of all task `points` values.
- **Man-days:** `developers * workingDays`.
- **Effective man-days:** `manDays * efficiency`.
- **Ideal daily burn:** `effectiveManDays / workingDays`.
- **Ideal line:** Starts at `totalPoints`, decreases by `idealDailyBurn` per working day.
- **Actual line:** For each working day, sums the points of tasks whose `doneDate` is after that day (i.e., not yet done).

### 5.3 Available Days (`renderStats` in `render.js`)
- Formula: `effectiveManDays - totalPoints`.
- Color coding: green if between -1.0 and 1.0, red if < -1.0.

## 6. Rendering Strategy

The app uses a **full re-render** approach:
1. State mutations in `state.js` call `save()` then fire the `onStateChange` callback.
2. `main.js` registers `render()` as the callback via `setOnStateChange(render)`.
3. `render()` rebuilds: sprint sidebar, form fields, task table, stats, SVG chart.
4. Templates (`<template>` elements) are cloned for sprint items and task rows.
5. Event listeners are re-attached on every render.

### Performance Characteristics
- Fine for small task lists (< 30 tasks per sprint).
- Will degrade with 50+ tasks due to full DOM teardown/rebuild.
- SVG chart is rebuilt from scratch each time.

## 7. File Structure

```
bdc/
├── index.html          # UI structure, templates
├── app.js              # Bundled output (built from src/, committed to git)
├── styles.css          # All styling (no preprocessor)
├── src/
│   ├── main.js         # Entry point — event wiring, init
│   ├── dom.js          # DOM element references
│   ├── state.js        # State management — load, save, CRUD
│   ├── burndown.js     # Pure burndown calculation functions
│   ├── chart.js        # SVG chart rendering
│   ├── render.js       # DOM rendering (sprint list, tasks, stats)
│   ├── io.js           # JSON export/import
│   └── utils.js        # Shared helpers (dates, IDs, formatting)
├── docs/
│   ├── PRD.md          # Product requirements
│   ├── TECHNICAL_DESIGN.md   # This document
│   └── ROADMAP.md      # Delivery roadmap
├── package.json        # Build scripts and dev dependencies
├── .gitignore
└── README.md
```

### Module Dependency Graph

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

No circular dependencies. `state.js` communicates with `render.js` via a callback
(`setOnStateChange`) registered by `main.js`, avoiding a direct import cycle.

### Module Responsibilities

| Module | Lines | Responsibility |
|---|---|---|
| `utils.js` | ~35 | Pure helpers: date math, formatting, UUID generation |
| `dom.js` | ~28 | Queries and exports all DOM element references |
| `state.js` | ~143 | State CRUD, localStorage load/save, change callback |
| `burndown.js` | ~27 | Pure burndown calculation (ideal/actual lines, capacity) |
| `chart.js` | ~89 | SVG chart rendering (grid, lines, labels) |
| `render.js` | ~148 | DOM rendering: sprint list, task table, stats card |
| `io.js` | ~36 | JSON export (file download) and import (file read + validation) |
| `main.js` | ~55 | Entry point: registers callbacks, attaches event listeners |

## 8. Technical Debt & Risks

| ID | Issue | Severity | Status | Notes |
|---|---|---|---|---|
| TD-01 | No git repository | High | **Resolved** | Git initialized, connected to GitHub remote. |
| TD-02 | Full re-render on every change | Medium | Open | Works now but won't scale to large task lists. |
| TD-03 | No tests | Medium | Open | `calculateBurndown`, `getWorkingDates` are pure functions and easy to unit test. |
| TD-04 | Single JS file (~500 lines) | Low | **Resolved** | Split into 8 ES modules under `src/`. |
| TD-05 | localStorage only | Medium | **Mitigated** | JSON export/import added. localStorage is still the primary store. |
| TD-06 | No input validation | Low | Open | Invalid dates, negative points, or efficiency > 1 are not explicitly prevented (HTML `min`/`max` helps but isn't enforced in JS). |
| TD-07 | No error handling | Low | **Resolved** | `loadState` now has try/catch with graceful fallback. |
| TD-08 | Date handling uses string comparison | Low | Open | `task.doneDate > date` works for ISO strings but is fragile. |

## 9. Future Architecture Considerations

### If adding a backend (Phase 4):
- The data model is already JSON-serializable — drop-in compatible with a REST API.
- Consider: SQLite file per user (simplest), or PostgreSQL for multi-user.
- The frontend would need to switch from `localStorage` calls to `fetch()` calls in `state.js` — a straightforward refactor since state management is centralized in one module.

### If migrating to Vite:
- Vite could replace esbuild for a richer dev experience (HMR, CSS modules, TypeScript).
- Migration path: add `vite.config.js`, update `package.json` scripts. The existing `src/main.js` entry point and module structure already work with Vite.

### If adding TypeScript:
- Rename `.js` → `.ts` files incrementally.
- Define interfaces for `Sprint`, `Task`, and `State` in a shared `types.ts`.
- esbuild already supports TypeScript out of the box (type-stripping only; add `tsc --noEmit` for type checking).

## 10. Revision History

| Date | Version | Changes |
|---|---|---|
| 2026-02-20 | 0.1 | Initial draft based on MVP codebase analysis |
| 2026-02-20 | 0.2 | Updated for ES module refactor, resolved tech debt items, updated file structure and dependency graph |
| 2026-02-20 | 0.3 | Comprehensive update: added build pipeline section, module responsibilities table, data safety notes, updated architecture overview for esbuild bundling, updated tech stack, updated future architecture considerations |
