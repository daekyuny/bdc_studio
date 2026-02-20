# Burndown Studio — Technical Design Document

**Version:** 0.1 (Draft)
**Last updated:** 2026-02-20
**Status:** Draft — open for review

---

## 1. Architecture Overview

Burndown Studio is a **zero-dependency, static single-page application**. There is no build step, no framework, and no backend. The entire app is three files served as static assets.

```
Browser
  ├── index.html    (UI structure + templates)
  ├── styles.css    (layout, theming, animations)
  └── app.js        (state management, calculations, rendering)
          │
          └── localStorage ("burndown-studio" key)
```

### Design Principles (current)
- **No build step** — open `index.html` and it works.
- **No dependencies** — no npm packages, no CDN libraries (except Google Fonts).
- **Single global state** — one JS object, one localStorage key.
- **Full re-render** — every state change triggers a complete DOM rebuild via `render()`.

## 2. Tech Stack

| Layer | Technology | Notes |
|---|---|---|
| Markup | HTML5 | Semantic elements, `<template>` for row/item cloning |
| Styling | Vanilla CSS | CSS custom properties, grid, responsive breakpoints |
| Logic | Vanilla JS (ES2020+) | `crypto.randomUUID()`, arrow functions, template literals |
| Chart | Hand-rolled SVG | `<polyline>` elements built via DOM API |
| Fonts | Google Fonts | Fraunces (headings), Source Sans 3 (body) |
| Storage | localStorage | Single JSON blob under `burndown-studio` key |
| Serving | Any static server | `python3 -m http.server`, or just `file://` |

## 3. Data Model

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

## 4. Key Algorithms

### 4.1 Working Days Calculation (`getWorkingDates`)
- Iterates from `startDate` to `endDate` inclusive.
- Excludes Saturday (day 6) and Sunday (day 0).
- Returns an array of ISO date strings.
- **Gap:** Does not exclude holidays or PTO.

### 4.2 Burndown Calculation (`calculateBurndown`)
- **Total points:** Sum of all task `points` values.
- **Man-days:** `developers * workingDays`.
- **Effective man-days:** `manDays * efficiency`.
- **Ideal daily burn:** `effectiveManDays / workingDays`.
- **Ideal line:** Starts at `totalPoints`, decreases by `idealDailyBurn` per working day.
- **Actual line:** For each working day, sums the points of tasks whose `doneDate` is after that day (i.e., not yet done).

### 4.3 Available Days
- Formula: `effectiveManDays - totalPoints`.
- Color coding: green if between -1.0 and 1.0, red if < -1.0.

## 5. Rendering Strategy

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

## 6. File Structure

```
bdc/
├── index.html          # UI structure, templates
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

## 7. Technical Debt & Risks

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

## 8. Future Architecture Considerations

### If adding a backend (Phase 4):
- The data model is already JSON-serializable — drop-in compatible with a REST API.
- Consider: SQLite file per user (simplest), or PostgreSQL for multi-user.
- The frontend would need to switch from `localStorage` calls to `fetch()` calls — a straightforward refactor if the state management is kept centralized.

### If adding a build step:
- Vite is recommended (minimal config, fast dev server, handles ES modules).
- Would enable: TypeScript, CSS modules, tree-shaking, proper test runner (Vitest).
- Migration path: add `vite.config.js`, the existing `src/main.js` entry point already works.

## 9. Revision History

| Date | Version | Changes |
|---|---|---|
| 2026-02-20 | 0.1 | Initial draft based on MVP codebase analysis |
| 2026-02-20 | 0.2 | Updated for ES module refactor, resolved tech debt items, updated file structure and dependency graph |
