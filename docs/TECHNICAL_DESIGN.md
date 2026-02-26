# Burndown Studio — Technical Design Document

**Version:** 0.8
**Last updated:** 2026-02-26
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
      ├── render.js     → DOM rendering (sidebar, tasks, backlog, stats)
      ├── io.js         → JSON/Excel export and import
      └── utils.js      → shared helpers (dates, IDs)
```

### Design Principles
- **Open and run** — open `index.html` directly in a browser (`file://` works, no server required).
- **Modular source** — 8 focused ES modules for clean separation and parallel development.
- **Single build step** — `npm run build` bundles `src/` → `app.js` via esbuild.
- **Minimal dependencies** — only dev dependency is esbuild. Runtime CDN dependencies: Google Fonts, Flatpickr, SheetJS.
- **Single global state** — one JS object, one localStorage key.
- **Selective re-render** — state changes carry bitmask hints; `render(hints)` only rebuilds affected UI regions.

## 2. Tech Stack

| Layer | Technology | Notes |
|---|---|---|
| Markup | HTML5 | Semantic elements, `<template>` for row/item cloning |
| Styling | Vanilla CSS | CSS custom properties, grid, responsive breakpoints |
| Logic | Vanilla JS (ES2020+) | `crypto.randomUUID()`, ES modules, arrow functions |
| Chart | Hand-rolled SVG | `<polyline>` elements built via DOM API |
| Fonts | Google Fonts (CDN) | Fraunces (headings), Source Sans 3 (body) |
| Date picker | Flatpickr (CDN) | Calendar UI for sprint dates and Today field; weekends/occupied ranges disabled |
| Excel I/O | SheetJS / xlsx (CDN) | Backlog Excel import (.xlsx/.xls) and export; sprint task export |
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
├── backlog
│   └── stories: Array
│       └── Story
│           ├── id: string (UUID)
│           ├── storyId: string (display ID, e.g. "0.1")
│           ├── description: string
│           ├── priority: number (default 100, min 0)
│           └── tasks: Array
│               └── BacklogTask
│                   ├── id: string (UUID)
│                   ├── taskId: string (display ID, e.g. "0.1.1")
│                   ├── description: string
│                   ├── estimate: number (days)
│                   └── assignedTo: string
└── sprints: Array
    └── Sprint
        ├── id: string (UUID)
        ├── description: string (optional display title)
        ├── startDate: string (YYYY-MM-DD)
        ├── endDate: string (YYYY-MM-DD)
        ├── today: string (YYYY-MM-DD, optional — overrides real today for chart)
        ├── developers: number (default 0)
        ├── efficiency: number 0-1 (default 1)
        ├── createdAt: string (ISO 8601)
        └── tasks: Array
            └── SprintTask
                ├── id: string (UUID)
                ├── backlogTaskId: string (UUID — link to BacklogTask)
                ├── taskId: string (denormalized from backlog)
                ├── name: string (denormalized from backlog description)
                ├── assignedTo: string (denormalized from backlog)
                ├── estimate: number (denormalized from backlog — read-only in sprint)
                ├── actual: number | null (entered by user when task is Done)
                ├── status: "Todo" | "In Progress" | "Done"
                └── doneDate: string (YYYY-MM-DD) or ""
```

**Sprint numbering** is computed dynamically (sorted index + 1) and never stored. Sprints are always kept sorted by `startDate` via `sortSprints()` after every create or update.

**New sprint defaults:** `developers: 0`, `efficiency: 1`. Start date defaults to next working day after last sprint end; end date is 10 working days after start.

**Estimate vs Actual:** `estimate` is copied from the backlog task when a task is added to a sprint and is read-only thereafter. `actual` is entered by the user when the task is marked Done (pre-filled with `estimate`). Only `estimate` is used in burndown chart math; `actual` is for retrospective reporting only.

**Denormalization:** Sprint tasks copy `taskId`, `name`, and `assignedTo` from the backlog at the time of assignment. These copies are not kept in sync if the backlog is edited after assignment, but are refreshed when backlog is re-imported via Excel (see Re-linking below).

**Re-linking on backlog import:** When a backlog is imported from Excel, all backlog tasks receive fresh UUIDs. `relinkSprintTasks()` in `state.js` rebuilds the `backlogTaskId` link by matching on the human-readable `taskId` (e.g. "1.2.3") which survives the Excel round-trip. Matched sprint tasks have their `name`, `estimate`, and `assignedTo` refreshed from the new backlog; `status`, `actual`, and `doneDate` are preserved. Sprint tasks whose `taskId` is not found in the imported backlog are removed. A two-step custom confirmation dialog warns users before orphaned tasks are deleted.

### Data Migration

`migrateState()` in `state.js` (and `migrateImported()` in `io.js`) runs on every load:
- If `backlog` key is missing, adds `{ stories: [] }`.
- If a sprint task has `points` but no `estimate`, renames `points → estimate`, sets `actual = null`.

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
- Accepts an optional `holidays` Set of ISO date strings; dates in the Set that fall on weekdays are excluded from the result.
- Accepts an optional `workWeekends` Set of ISO date strings; dates in the Set that fall on weekends are included in the result.

### 5.2 Timezone-Safe Date Formatting (`localIso` in `utils.js`)
- All date arithmetic uses `getFullYear() / getMonth() / getDate()` (local time) instead of `toISOString().slice(0,10)` (UTC).
- Critical for UTC+ users (e.g. UTC+9): `toISOString()` at midnight local time returns the previous UTC day, causing off-by-one errors in every date function.
- `localIso(date)` is a private helper used by `todayIso`, `addDays`, `getWorkingDates`, `getNextWorkingDay`, and `addWorkingDays`.

### 5.3 Sprint Overlap & Gap Detection (`utils.js`)
- **Overlap:** `sprintsOverlap(a, b)` — `a.startDate <= b.endDate && a.endDate >= b.startDate`. Used in the modal save handler to block overlapping sprints.
- **Gap:** `findGaps(sprints)` — iterates sorted sprints; if `getNextWorkingDay(sprint[i].endDate) < sprint[i+1].startDate`, a gap exists. Warns after save but does not block.

### 5.4 Burndown Calculation (`calculateBurndown` in `burndown.js`)
- **Total points:** Sum of all sprint task `estimate` values.
- **Man-days:** `developers * workingDays`.
- **Effective man-days:** `manDays * efficiency`.
- **Ideal daily burn:** `effectiveManDays / workingDays`.
- **Ideal line:** Starts at `totalPoints`, decreases by `idealDailyBurn` per working day.
- **Actual line:** For each working day, sums the `estimate` of tasks whose `doneDate` is after that day (i.e., not yet done). The `actual` field is **not used** in chart math — it's for retrospective reporting only.

### 5.5 Today Override & Actual Line Clipping
- `sprint.today` persists an overridden "today" date, useful for demos or past-sprint review.
- `calculateBurndown(sprint, today)` accepts `today` and computes `todayIndex` — the last date index ≤ today.
- Actual burn values are `null` for indices after `todayIndex`, so the red line never extends into the future.
- A dashed vertical "Today" marker is drawn on the chart at `todayIndex`.

### 5.6 Available Days (`renderStats` in `render.js`)
- Formula: `effectiveManDays - totalPoints`.
- Color coding: green if between -1.0 and 1.0, red if < -1.0.

### 5.7 Priority Snapping
- The backlog story priority field uses `<input type="number" step="10" min="0">`.
- Native spinner arrows (mouse click) snap to multiples of 10 automatically via `step="10"`.
- Keyboard ArrowUp/ArrowDown are intercepted with `e.preventDefault()` and apply custom logic:
  - ArrowUp: `Math.floor(cur / 10) * 10 + 10`
  - ArrowDown: `Math.max(0, Math.ceil(cur / 10) * 10 - 10)`
- Example: current = 45 → Up → 50; current = 45 → Down → 40.

## 6. Rendering Strategy

The app uses a **selective re-render** approach with bitmask render hints:
1. State mutations in `state.js` call `save()` then fire `onStateChange(hints)`, where `hints` is a bitmask indicating which UI regions changed.
2. `main.js` registers `render()` as the callback via `setOnStateChange(render)`.
3. `render(hints)` checks the bitmask and only rebuilds the affected regions: sprint sidebar, header, task table, backlog panel, stats, SVG chart, or backlog table. If no hints are provided, all regions are rebuilt (backward-compatible).
4. Templates (`<template>` elements) are cloned for sprint items, sprint task rows, backlog panel rows, backlog story rows, and backlog task rows.
5. Event listeners are re-attached on each region rebuild.

### Render Hint Bitmask (`state.js`)

| Constant | Bit | Region |
|---|---|---|
| `H_SIDEBAR` | 1 | Sprint list in sidebar |
| `H_HEADER` | 2 | Sprint title, delete button text, fpToday picker |
| `H_TASKS` | 4 | Task table rows + Flatpickr done-date pickers |
| `H_PANEL` | 8 | Backlog panel (unassigned tasks list) |
| `H_STATS` | 16 | Stats card |
| `H_CHART` | 32 | SVG burndown chart |
| `H_BACKLOG` | 64 | Backlog tab table |
| `H_ALL` | 127 | All regions |

Convenience groups: `H_SPRINT_TASKS` (tasks + panel + stats + chart) and `H_BACKLOG_DATA` (backlog + panel).

Examples: `updateTask()` passes `H_SPRINT_TASKS` — only the task table, backlog panel, stats, and chart are rebuilt; the sidebar and header are untouched. `updateToday()` passes `H_STATS | H_CHART` — only the stats card and SVG chart are rebuilt.

### Tab State
- `activeTab` (`"sprint"` | `"backlog"`) is a module-level variable in `render.js`.
- `setActiveTab(tab)` updates it and calls `render()`.
- `render()` toggles visibility of `#sprintView` / `#backlogView` and which content is built.

### Backlog UI State
Two module-level Sets in `render.js` persist across renders:
- `editingIds` — UUIDs of stories/tasks currently in edit mode.
- `expandedStoryIds` — UUIDs of stories whose task rows are visible.

`startEditing(id, focusAfter)` adds to `editingIds`, triggers a render, then uses `setTimeout(0)` to scroll the new row into view and focus its first input.

### Flatpickr Instance Management
- **Modal date pickers** (`fpStart`, `fpEnd`): module-level variables in `main.js`. Destroyed and recreated on each modal open via `initDatePickers(excludeId, defaultStart, defaultEnd)`. Occupied sprint date ranges and weekends are passed to Flatpickr's `disable` array.
- **Today picker** (`fpToday`): module-level variable in `render.js`. Destroyed and recreated on every `render()` call to keep `minDate`/`maxDate` in sync with sprint dates.
- **Calendar popup positioning**: Flatpickr appends its calendar to `<body>` with `position: absolute`, which scrolls with the page while the modal is `position: fixed`. Fixed via an `onOpen` callback that overrides position to `fixed` using `getBoundingClientRect()` after a `setTimeout(0)`.

### Performance Characteristics
- Selective rendering significantly reduces unnecessary DOM work: most state changes only rebuild 2-4 of 7 regions.
- Fine for moderate task lists (< 50 tasks per sprint, < 100 backlog tasks).
- Each region still uses full teardown/rebuild internally (no element-level diffing).
- SVG chart is rebuilt from scratch when chart hints are active.

## 7. File Structure

```
bdc/
├── index.html          # UI structure, templates
├── app.js              # Bundled output (built from src/, committed to git)
├── styles.css          # All styling (no preprocessor)
├── src/
│   ├── main.js         # Entry point — event wiring, init, modal logic
│   ├── dom.js          # DOM element references
│   ├── state.js        # State management — load, save, CRUD (sprints + backlog)
│   ├── burndown.js     # Pure burndown calculation functions
│   ├── chart.js        # SVG chart rendering
│   ├── render.js       # DOM rendering (sprint list, tasks, backlog, stats)
│   ├── io.js           # JSON/Excel export and import
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
└── io.js ← state.js, utils.js, dom.js
```

No circular dependencies. `state.js` communicates with `render.js` via a callback
(`setOnStateChange`) registered by `main.js`, avoiding a direct import cycle. `render.js` imports render hint constants from `state.js` (data-only, no circular call chain).

### Module Responsibilities

| Module | Responsibility |
|---|---|
| `utils.js` | Pure helpers: timezone-safe date math, overlap/gap detection, UUID, formatting |
| `dom.js` | Queries and exports all DOM element references (~60 elements) |
| `state.js` | State CRUD for sprints and backlog, localStorage load/save, change callback, migration |
| `burndown.js` | Pure burndown calculation (ideal/actual lines, today clipping, capacity) |
| `chart.js` | SVG chart rendering (grid, lines, today marker, labels) |
| `render.js` | Full DOM rebuild: tab switching, sprint list, task table, backlog table (stories + tasks), stats card, Flatpickr Today picker |
| `io.js` | JSON export/import; sprint Excel export; backlog Excel export and import (SheetJS); sprint↔backlog re-linking on backlog import; custom confirm dialogs |
| `main.js` | Entry point: tab/toolbar event wiring, modal logic, Flatpickr date pickers, Add-by-ID, drag-to-sprint, Delete All |

## 8. Technical Debt & Risks

| ID | Issue | Severity | Status | Notes |
|---|---|---|---|---|
| TD-01 | No git repository | High | **Resolved** | Git initialized, connected to GitHub remote. |
| TD-02 | Full re-render on every change | Medium | **Resolved** | Selective rendering via bitmask hints; each state mutation declares which UI regions need rebuilding. Individual regions still use full teardown/rebuild internally. |
| TD-03 | No tests | Medium | Open | `calculateBurndown`, `getWorkingDates` are pure functions and easy to unit test. |
| TD-04 | Single JS file (~500 lines) | Low | **Resolved** | Split into 8 ES modules under `src/`. |
| TD-05 | localStorage only | Medium | **Mitigated** | JSON export/import added. localStorage is still the primary store. |
| TD-06 | No input validation | Low | Open | Invalid dates, negative estimates, or efficiency > 1 are not explicitly prevented in JS. |
| TD-07 | No error handling | Low | **Resolved** | `loadState` now has try/catch with graceful fallback. |
| TD-08 | Date handling uses string comparison | Low | **Partially resolved** | `task.doneDate > date` works for ISO strings. Timezone off-by-one bug fixed via `localIso()` helper; string comparison retained where safe. |
| TD-09 | Backlog denormalization | Low | **Partially resolved** | Sprint tasks copy name/taskId/assignedTo from backlog at assignment time; edits after assignment are not auto-synced, but backlog Excel re-import triggers `relinkSprintTasks()` which refreshes denormalized fields and removes orphans. |

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
- Define interfaces for `Sprint`, `SprintTask`, `BacklogStory`, `BacklogTask`, and `AppState` in a shared `types.ts`.
- esbuild already supports TypeScript out of the box (type-stripping only; add `tsc --noEmit` for type checking).

## 10. Revision History

| Date | Version | Changes |
|---|---|---|
| 2026-02-20 | 0.1 | Initial draft based on MVP codebase analysis |
| 2026-02-20 | 0.2 | Updated for ES module refactor, resolved tech debt items, updated file structure and dependency graph |
| 2026-02-20 | 0.3 | Comprehensive update: added build pipeline section, module responsibilities table, data safety notes, updated architecture overview for esbuild bundling, updated tech stack, updated future architecture considerations |
| 2026-02-21 | 0.4 | Updated data model (description, today fields; sprint numbering computed not stored); added Flatpickr to tech stack; added algorithms for timezone-safe dates, overlap/gap detection, today clipping; updated Flatpickr instance management in rendering strategy; updated module line counts; partially resolved TD-08 |
| 2026-02-23 | 0.5 | Major update for Product Backlog feature: added backlog data model (Story, BacklogTask, denormalized SprintTask); updated data migration section; added SheetJS to tech stack; updated io.js responsibilities (Excel import/export); rewrote burndown algorithm (estimate not points); added tab state and backlog UI state sections to rendering strategy; added priority snapping algorithm; added TD-09 (denormalization); updated module responsibilities table |
| 2026-02-24 | 0.6 | Added sprint↔backlog re-linking on backlog import (relinkSprintTasks, findOrphanedSprintTasks); custom confirm dialogs replacing window.confirm for imports; updated io.js dependency (now imports dom.js); partially resolved TD-09 |
| 2026-02-24 | 0.7 | Resolved TD-02: selective rendering via bitmask render hints. Updated rendering strategy section (hint table, examples). Updated design principles and performance characteristics. render.js now imports hint constants from state.js. |
| 2026-02-26 | 0.8 | Updated getWorkingDates algorithm: now accepts optional holidays Set and workWeekends Set (F-102 complete). |
