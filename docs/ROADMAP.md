# Burndown Studio — Project Roadmap

**Version:** 0.1 (Draft)
**Last updated:** 2026-02-20
**Status:** Draft — open for review

---

## Roadmap Overview

```
Phase 0 (Done)     Phase 1            Phase 2            Phase 3            Phase 4
──────────────     ────────────       ────────────       ────────────       ────────────
MVP baseline       Data Safety        Daily Usability    Insights           Multi-user
                   & Accuracy                            & History          & Integrations
```

---

## Phase 0 — MVP Baseline (DONE)

**Goal:** A working burndown tracker that runs locally in the browser.

- [x] Multiple sprint management (create, switch, delete)
- [x] Sprint setup (name, dates, developers, efficiency)
- [x] Weekend auto-skip in working-day calculations
- [x] Task CRUD with name, days, status, done date
- [x] Ideal vs actual burndown chart (SVG)
- [x] Stats dashboard (7 metrics)
- [x] Available Days capacity indicator
- [x] localStorage persistence
- [x] Responsive layout

**Delivered:** 2026-02-19

---

## Phase 1 — Data Safety & Accuracy

**Goal:** Make the tool trustworthy for daily use. No more data loss risk, and the burndown chart reflects real-world capacity.

### Features

| ID | Feature | Priority | Effort | Description |
|---|---|---|---|---|
| F-101 | JSON export/import | P0 | Small | Download/upload full state as `.json` file |
| F-102 | Holiday/PTO exclusions | P0 | Medium | Per-sprint list of excluded dates; reflected in working days & ideal line |
| F-103 | CSV task export | P1 | Small | Download active sprint's task list as `.csv` |

### Technical Foundation

| ID | Item | Priority | Effort | Description |
|---|---|---|---|---|
| T-101 | Initialize git repo | P0 | Trivial | `git init` + initial commit of MVP |
| T-102 | Add basic input validation | P1 | Small | Validate dates, points, efficiency in JS (not just HTML attributes) |
| T-103 | Graceful localStorage error handling | P1 | Small | Try/catch around `JSON.parse`, fallback to fresh state on corruption |

### Exit Criteria
- User can export all data, clear browser, import, and have everything restored.
- Holiday dates are excluded from working-day count and ideal burn line.
- Git repo exists with clean commit history.

---

## Phase 2 — Daily Usability

**Goal:** Make the tool pleasant enough for daily standup use.

### Features

| ID | Feature | Priority | Effort | Description |
|---|---|---|---|---|
| F-201 | Task drag-and-drop reordering | P1 | Medium | Drag task rows to reorder; order persisted |
| F-202 | Sprint progress percentage | P1 | Small | "X% complete" stat based on done points / total points |
| F-203 | Sprint cloning | P2 | Small | Clone sprint structure with statuses reset to Todo |
| F-204 | Scope change tracking | P2 | Medium | Log task additions/removals with timestamps; optional scope line on chart |
| F-205 | Keyboard shortcuts | P2 | Small | e.g., `N` to add task, `Ctrl+E` to export |

### Technical Foundation

| ID | Item | Priority | Effort | Description |
|---|---|---|---|---|
| T-201 | Introduce Vite build tool | P2 | Small | Enable ES modules, dev server with HMR, future TypeScript support |
| T-202 | Split app.js into modules | P2 | Medium | Separate state, calculations, rendering, chart into distinct files |
| T-203 | Add unit tests for calculations | P1 | Small | Test `calculateBurndown`, `getWorkingDates` with edge cases |

### Exit Criteria
- Tasks can be reordered by drag-and-drop.
- Sprint health is visible at a glance (progress %).
- Core calculation functions have test coverage.

---

## Phase 3 — Insights & History

**Goal:** Provide historical context so teams can improve over time.

### Features

| ID | Feature | Priority | Effort | Description |
|---|---|---|---|---|
| F-301 | Sprint velocity chart | P1 | Medium | Bar chart of completed points per sprint (requires 2+ sprints) |
| F-302 | Sprint archive / completion | P2 | Small | Mark sprint as "completed" — visually distinct, read-only |
| F-303 | Burndown chart tooltips | P2 | Medium | Hover to see date, ideal value, actual value at each data point |
| F-304 | Dark mode | P2 | Medium | Respect OS preference or manual toggle; CSS custom properties make this feasible |

### Technical Foundation

| ID | Item | Priority | Effort | Description |
|---|---|---|---|---|
| T-301 | Optimize rendering | P2 | Medium | Targeted DOM updates instead of full re-render; improve performance for 50+ tasks |
| T-302 | Migrate to TypeScript | P3 | Medium | Add type safety to the data model and calculation functions |

### Exit Criteria
- Teams with 3+ completed sprints can see a velocity trend.
- Completed sprints are clearly distinguished from active ones.

---

## Phase 4 — Multi-user & Integrations (Deferred)

**Goal:** Support team usage with shared data and external tool integration.

### Features

| ID | Feature | Priority | Effort | Description |
|---|---|---|---|---|
| F-401 | Backend storage | P1 | Large | REST API + database (SQLite or PostgreSQL) |
| F-402 | User authentication | P2 | Large | Email/password or OAuth login |
| F-403 | Multi-team support | P2 | Medium | Organize sprints by team |
| F-404 | Issue tracker integration | P3 | Large | Sync tasks from Jira, Linear, or GitHub Issues |

### Exit Criteria
- Multiple users can access their own sprints from any browser.
- At least one issue tracker integration works end-to-end.

---

## Effort Estimates Key

| Label | Meaning |
|---|---|
| Trivial | < 1 hour |
| Small | 1-4 hours |
| Medium | 4-16 hours (1-2 days) |
| Large | 16+ hours (multi-day) |

---

## Revision History

| Date | Version | Changes |
|---|---|---|
| 2026-02-20 | 0.1 | Initial draft based on MVP codebase analysis |
