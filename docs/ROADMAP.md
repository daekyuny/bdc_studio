# Burndown Studio — Project Roadmap

**Version:** 0.8
**Last updated:** 2026-02-27
**Status:** Draft — open for review

---

## Roadmap Overview

```
Phase 0 (Done)     Phase 1 (Done)     Phase 2 (Active)   Phase 3            Phase 4
──────────────     ────────────       ────────────       ────────────       ────────────
MVP baseline       Data Safety        Daily Usability    Insights           Multi-user
+ Tech Foundation  & Accuracy                            & History          & Integrations
```

---

## Phase 0 — MVP Baseline + Tech Foundation (DONE)

**Goal:** A working burndown tracker that runs locally in the browser, with a solid technical foundation for further development.

### Core Features
- [x] Multiple sprint management (create, switch, delete); auto-sorted by start date
- [x] Sprint setup via modal: optional description, Flatpickr date pickers, developers, efficiency
- [x] Overlap validation (block) and gap warning (alert) between sprints
- [x] Sprint title bar: optional description as scrollable heading
- [x] Weekend auto-skip in working-day calculations; timezone-safe date arithmetic
- [x] Task CRUD with name, days, status, done date
- [x] Today override field per sprint; actual burn line clips at today
- [x] Ideal (blue) vs actual (red) burndown chart (SVG) with dashed today marker
- [x] Side-by-side layout: sprint summary + burndown chart; tasks below
- [x] Stats dashboard; Available Days capacity indicator (`effectiveManDays - totalPoints`)
- [x] Working days chip in modal (live count as dates are picked)
- [x] Date format: mm/dd throughout
- [x] localStorage persistence
- [x] Responsive layout
- [x] JSON export/import for data backup and portability
- [x] Show day numbers toggle (D1/D2 vs mm/dd dates)
- [x] Graceful recovery from corrupt localStorage data

### Technical Foundation
- [x] Git repository initialized, connected to GitHub remote
- [x] Codebase split into 8 ES modules under `src/`
- [x] esbuild bundling (`npm run build` → `app.js`)
- [x] `app.js` committed to git for zero-build-step usage
- [x] Project documentation: PRD, Technical Design, Roadmap
- [x] `.gitignore` configured

**Delivered:** 2026-02-19 (MVP) / 2026-02-20 (tech foundation + bug fixes)

---

## Phase 1 — Data Safety & Accuracy (DONE)

**Goal:** Make the burndown chart accurate for real-world sprints. Complete the data safety story. Establish a structured backlog to source sprint tasks from.

### Features

| ID | Feature | Priority | Effort | Status | Description |
|---|---|---|---|---|---|
| F-101 | JSON export/import | P0 | Small | **Done** | Download/upload full state as `.json` file |
| F-102 | Holiday/PTO exclusions | P0 | Medium | **Done** | Global list of excluded dates in preferences; reflected in working days, ideal line & sprint date pickers |
| F-103 | Sprint task export | P1 | Small | **Done** | Export active sprint's task list as `.xlsx` (Excel) |
| F-104 | Product Backlog | P0 | Large | **Done** | Story→Task hierarchy; tasks assigned to sprint from backlog; estimate/actual split; Excel import/export; re-links sprint tasks on backlog re-import |

### Technical Foundation

| ID | Item | Priority | Effort | Status | Description |
|---|---|---|---|---|---|
| T-101 | Initialize git repo | P0 | Trivial | **Done** | `git init` + initial commit, GitHub remote |
| T-102 | Add basic input validation | P1 | Small | Open | Validate dates, estimates, efficiency in JS (not just HTML attributes) |
| T-103 | Graceful localStorage error handling | P1 | Small | **Done** | Try/catch around `JSON.parse`, fallback to fresh state on corruption |
| T-104 | Split into ES modules | P1 | Medium | **Done** | 8 modules under `src/` with esbuild bundling |

### Exit Criteria
- User can export all data, clear browser, import, and have everything restored. **(Done)**
- Sprint tasks originate from a structured backlog; estimate and actual are tracked separately. **(Done)**
- Sprint and backlog data can be exported to Excel and re-imported. **(Done)**
- Holiday dates are excluded from working-day count and ideal burn line. **(Done)**
- Git repo exists with clean commit history. **(Done)**

### Remaining Work
- T-102: Input validation

---

## Phase 2 — Daily Usability (ACTIVE)

**Goal:** Make the tool pleasant enough for daily standup use.

### Features

| ID | Feature | Priority | Effort | Status | Description |
|---|---|---|---|---|---|
| F-201 | Task drag-and-drop reordering | P1 | Medium | **Done** | Handle-only drag (`⠿`); disabled during column sort; order persisted via `reorderTasks()` |
| F-202 | Sprint progress percentage | P1 | Small | **Done** | "X% complete" stat with visual progress bar in stats card |
| F-203 | Sprint cloning | P2 | Small | Deferred | Clone sprint structure with statuses reset to Todo |
| F-204 | Scope change tracking | P2 | Medium | **Done** | Per-sprint `scopeLog` records add/remove; optional orange dashed scope line on chart |
| F-205 | Keyboard shortcuts | P2 | Small | Open | e.g., `N` to add task, `Ctrl+E` to export |

### Technical Foundation

| ID | Item | Priority | Effort | Status | Description |
|---|---|---|---|---|---|
| T-201 | Add unit tests for calculations | P1 | Small | **Done** | 59 tests for `utils.js` and `burndown.js` using Node built-in test runner (`node --test`) |

### Exit Criteria
- Tasks can be reordered by drag-and-drop. **(Done)**
- Sprint health is visible at a glance (progress %). **(Done)**
- Core calculation functions have test coverage. **(Done)**

### Remaining Work
- F-205: Keyboard shortcuts

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
| T-301 | Optimize rendering | P2 | Medium | **Done** — Selective rendering via bitmask render hints (TD-02 resolved) |
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
| 2026-02-20 | 0.2 | Merged Phase 0 with completed tech items. Marked F-101, T-101, T-103, T-104 as Done. Removed completed T-201/T-202 (module split and build tool) from Phase 2. Added remaining work summary to Phase 1. |
| 2026-02-21 | 0.3 | Updated Phase 0 completed list to reflect UI redesign: modal sprint edit, Flatpickr, overlap/gap, Today override, side-by-side layout, mm/dd dates, working days chip, timezone fix. Phase 1 remaining work unchanged (F-102, F-103, T-102). |
| 2026-02-23 | 0.4 | Marked F-103 Done (Excel export); added F-104 (Product Backlog) as Done; updated Phase 1 goal and exit criteria to reflect backlog feature; removed F-103/F-104 from remaining work; updated Phase 1 remaining to F-102 + T-102 only. |
| 2026-02-24 | 0.5 | Updated F-104 description: backlog re-import now re-links sprint tasks by Task ID with two-step custom confirm dialog and orphan warning. |
| 2026-02-24 | 0.6 | Marked T-301 (Optimize rendering) as Done: selective rendering via bitmask render hints resolves TD-02. |
| 2026-02-26 | 0.7 | Marked F-102 (Holiday/PTO exclusions) as Done with global scope. Updated exit criteria. Removed F-102 from remaining work. |
| 2026-02-27 | 0.8 | Phase 2 progress: marked F-201, F-202, F-204, T-201 as Done. Deferred F-203. Added Status column to Phase 2 tables. Updated exit criteria. Phase 1 marked DONE, Phase 2 now ACTIVE. |
