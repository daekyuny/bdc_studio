# Burndown Studio — Technical Design Document

**Version:** 1.5
**Last updated:** 2026-03-10
**Status:** Current

---

## 1. Architecture Overview

Burndown Studio is a **static single-page application** with a modular TypeScript source and an esbuild bundling step. There is no custom backend. The source code is organized as ES modules under `src/`, bundled into a single `app.js` for browser consumption.

```
Browser
  ├── index.html        (UI structure + <template> elements)
  ├── styles.css        (layout, theming, animations)
  └── app.js            (bundled from src/ via esbuild)
          │
          ├── Firebase Auth    (Google Sign-In + Email/Password for dev)
          ├── Firestore        (real-time shared AppState per team)
          └── localStorage     ("burndown-studio" — local cache + legacy fallback)

Development
  └── src/
      ├── main.ts       → entry point, auth gate, event wiring, modal logic
      ├── dom.ts        → DOM element references
      ├── state.ts      → state management, CRUD, Firestore sync, migrations
      ├── types.ts      → shared TypeScript interfaces (incl. UserProfile, Team)
      ├── firebase.ts   → Firebase app init (auth, db, isFirebaseConfigured flag)
      ├── auth.ts       → sign-in (Google + fake email), sign-out, ensureUserProfile
      ├── db.ts         → Firestore CRUD: users, teams, appdata
      ├── screens.ts    → login, team selection, admin screen overlays
      ├── burndown.ts   → pure calculation functions
      ├── chart.ts      → SVG chart rendering
      ├── render.ts     → DOM rendering (sidebar, tasks, backlog, stats, chart)
      ├── io.ts         → JSON/Excel export and import
      ├── utils.ts      → shared helpers (dates, IDs, formatting)
      └── globals.d.ts  → ambient declarations for CDN globals (flatpickr, XLSX)
```

### Multi-User Flow

```
User opens app → Login screen (Firebase Auth)
              → Team selection (Firestore /teams)
              → Burndown Studio (Firestore /appdata/{teamId} — real-time)
```

### Design Principles
- **Multi-user by default** — Firebase Auth + Firestore when configured; falls back to single-user localStorage mode when `isFirebaseConfigured = false`.
- **Modular source** — 13 focused ES modules for clean separation.
- **Single build step** — `npm run build` bundles `src/main.ts` → `app.js` via esbuild.
- **Minimal dependencies** — dev: esbuild, typescript, tsx. Runtime: firebase (npm), Google Fonts, Flatpickr, SheetJS (CDN).
- **Single global state** — one JS object; persisted to Firestore (primary) + localStorage (cache).
- **Selective re-render** — state changes carry bitmask hints; `render(hints)` only rebuilds affected UI regions.

## 2. Tech Stack

| Layer | Technology | Notes |
|---|---|---|
| Markup | HTML5 | Semantic elements, `<template>` for row/item cloning |
| Styling | Vanilla CSS | CSS custom properties, grid, responsive breakpoints |
| Logic | TypeScript (strict) | ES modules, `crypto.randomUUID()`, compiled via esbuild type-stripping; `tsc --noEmit` for type checking |
| Chart | Hand-rolled SVG | `<polyline>` and `<line>` elements built via DOM API |
| Fonts | Google Fonts (CDN) | Fraunces (headings), Source Sans 3 (body) |
| Date picker | Flatpickr (CDN) | Calendar UI for sprint dates and project TODAY; weekends/holidays/occupied ranges disabled |
| Excel I/O | SheetJS / xlsx (CDN) | Backlog Excel import (.xlsx/.xls) and export; sprint task export |
| Auth | Firebase Auth (npm) | Google Sign-In (production); Email/Password fake login (localhost dev only) |
| Database | Firestore (npm) | Real-time shared AppState per team; `onSnapshot` listener for live updates |
| Storage | localStorage | Cache for Firestore data; sole store in legacy mode (`isFirebaseConfigured = false`) |
| Security | Firestore Security Rules | Role-based: super_manager / product_manager / member; deployed via Firebase CLI |
| Bundler | esbuild | Bundles ES modules into single `app.js` |
| Serving | Any static server | `npm run dev` (port 5173); Firebase Hosting or nginx for production |
| Version control | Git + GitHub | Remote: `git@github.com:daekyuny/bdc_studio.git` |

## 3. Build Pipeline

```
src/*.ts  ──esbuild──▶  app.js  ──browser──▶  runs in any modern browser
```

| Command | Description |
|---|---|
| `npm install` | Install esbuild, typescript, tsx (first time only) |
| `npm run build` | Bundle `src/main.ts` → `app.js` |
| `npm run typecheck` | Run `tsc --noEmit` (zero errors expected) |
| `npm run test` | Run unit tests via tsx |
| `npm run dev` | Start local dev server on port 5173 |

`app.js` is committed to git so the app works after cloning without a build step. The build step is only required after editing `src/`.

## 4. Data Model

### 4.0 Firestore Collections

When Firebase is configured, the following Firestore collections are used:

```
/users/{userId}       — UserProfile: email, displayName, phoneNumber?, role, groupId?, createdAt, memos: { [teamId]: string }
/teams/{teamId}       — Team: name, ownerId, memberIds[], groupId, createdAt
/groups/{groupId}     — Group: name, ownerId, createdAt
/appdata/{teamId}     — AppState (full sprint/backlog/preferences JSON blob)
```

**Roles:** `super_manager` (admin screen only — no team access), `product_manager` (owns one Group; creates/manages Teams and Members within it), `member` (read/write sprint data for assigned teams). All new users self-register as `member`; the first `super_manager` must be set manually via the Firebase Console.

**Groups (tenants):** A Group is the top-level container owned by one PM. Teams and Members belong to a Group. `groupId` on `/users` and `/teams` records group membership. SM can read all Groups; PM can create/update their own Group only. When a PM creates their first Group, `linkExistingTeamsToGroup` migrates any pre-existing teams and their members to the new Group.

**`memos`** is a map stored as a nested field on the user document (`users/{uid}.memos.{teamId}`). Written via `updateDoc` with dot-notation key; deleted via `deleteField()` when a team is deleted. Reading uses `getDoc` on the user doc and extracting the nested map.

### 4.1 AppState

All sprint/backlog state is stored as a single JSON object — in Firestore `/appdata/{teamId}` (multi-user) or in `localStorage` under `burndown-studio` (legacy):

```
AppState
├── activeSprintId: string (UUID)
├── projectToday: string (YYYY-MM-DD) — per-session; not shared via Firestore
...
```

Full AppState schema (unchanged from v1.1, see below):

All state is stored as a single JSON object in `localStorage` under `burndown-studio`:

```
AppState
├── activeSprintId: string (UUID)
├── projectToday: string (YYYY-MM-DD) — resets to real date on every page load
├── backlog
│   └── stories: BacklogStory[]
│       ├── id: string (UUID)
│       ├── storyId: string (e.g. "0.1")
│       ├── description: string
│       ├── priority: number (default 100)
│       └── tasks: BacklogTask[]
│           ├── id: string (UUID)
│           ├── taskId: string (e.g. "0.1.1")
│           ├── description: string
│           ├── estimate: number (days)
│           └── assignedTo: string[]  (email addresses; resolved to display names at render via emailToName)
├── preferences
│   ├── holidays: { date: YYYY-MM-DD, name: string }[]
│   ├── workWeekends: string[] (YYYY-MM-DD — specific weekend dates that count as working)
│   └── members: string[]
└── sprints: Sprint[]
    ├── id: string (UUID)
    ├── description: string
    ├── startDate: string (YYYY-MM-DD)
    ├── endDate: string (YYYY-MM-DD)
    ├── today: string (YYYY-MM-DD) — browse date for task table; set by chart click
    ├── developers: number
    ├── efficiency: number 0–1
    ├── plannedPoints: number — locked at planning time; drives ideal line
    ├── createdAt: string (ISO 8601)
    ├── tasks: SprintTask[]
    │   ├── id: string (UUID)
    │   ├── backlogTaskId: string (UUID — link to BacklogTask)
    │   ├── taskId: string (denormalized)
    │   ├── name: string (denormalized from backlog description)
    │   ├── assignedTo: string (comma-separated emails, denormalized from BacklogTask.assignedTo)
    │   ├── estimate: number (denormalized — read-only in sprint)
    │   ├── worked: number (latest total; top-level reflects most recent log entry)
    │   ├── remain: number (latest total; top-level reflects most recent log entry)
    │   ├── status: "Todo" | "In Progress" | "Done" (auto-derived from worked/remain)
    │   ├── doneDate: string (auto-set when remain first reaches 0)
    │   ├── addedDate: string (= projectToday at time of addition; < startDate means planned)
    │   ├── workedLog: { date: YYYY-MM-DD, worked: number }[]
    │   └── remainLog: { date: YYYY-MM-DD, remain: number }[]
    └── scopeDrops: ScopeDrop[]
        ├── addedDate: string (original addedDate of the dropped task)
        ├── removedDate: string (projectToday when removed)
        ├── estimate: number
        ├── taskId: string (optional)
        └── name: string
```

### Key Field Semantics

**`projectToday`** is the authoritative recording date for the whole project. Always reset to `todayIso()` on page load. The current sprint is defined as the sprint where `startDate ≤ projectToday ≤ endDate`.

**`sprint.today`** is the browse/view date for the task table. Set by clicking chart date labels. Allows inspecting a sprint's historical state without affecting data recording. Clamped to `[startDate, nextWorkingDay(endDate)]` on use.

**`plannedPoints`** is locked by `finalizeSprintPlan()` when the planning modal is closed. Used exclusively for the ideal burndown line. Mid-sprint additions or removals do not affect it.

**`addedDate`** is set to `projectToday` when a task is added. Tasks with `addedDate < startDate` (or no `addedDate`) are "originally planned". Tasks with `addedDate ≥ startDate` are mid-sprint additions.

**`BacklogTask.assignedTo`** stores email addresses (unique Firebase Auth IDs). Display converts each email to a name via `emailToName()`, which looks up `_memberPairs` — a module-level cache of `{email, name}` pairs. This cache is pre-populated from `localStorage` under `burndown-studio-member-pairs` at module init, so names render correctly immediately on page load without waiting for the Firebase profile fetch. `setMemberPairs()` updates both the in-memory cache and localStorage. The `preferences.members` list stores display names (not emails) and is always synced from Firebase Auth team member profiles in `startApp`.

**`scopeDrops`** records planned tasks removed mid-sprint. If the same task is added back, the matching ScopeDrop is cancelled (most recent match removed), restoring the original `addedDate` — net effect is as if no change occurred.

**`workedLog` / `remainLog`** store one entry per project TODAY per day. `updateTask` always writes to `projectToday`, not `sprint.today`. The top-level `worked` and `remain` fields always reflect the latest log entry across all dates.

### New Sprint Defaults

- `developers`: inherited from previous sprint; first sprint defaults to `preferences.members.length || 4`
- `efficiency`: 1.0
- `startDate`: next working day after last sprint end (or today if no sprints)
- `endDate`: 10 working days after start
- `plannedPoints`: set when planning modal closes via `finalizeSprintPlan()`

### Data Migration

`migrateState()` in `state.ts` runs on every load from localStorage. `migrateImported()` in `io.ts` runs on JSON import:
- Missing `backlog` → `{ stories: [] }`
- Missing `preferences` → `{ holidays: [], workWeekends: [], members: [] }`
- Missing `projectToday` → set to `todayIso()` (then immediately overwritten to real today in `loadState`)
- `task.points` (old field) → `task.estimate`
- Missing `task.worked`/`task.remain` → initialized from old `actual` field or estimate
- Missing `remainLog`/`workedLog` → `[]`
- Tasks with `removedDate` (old soft-delete) → migrated to `scopeDrops` or deleted

After migration, `loadState()` always overwrites `projectToday = todayIso()` and recalculates all `sprint.today` values to match.

### Re-linking on Backlog Import

When a backlog is imported from Excel, all backlog tasks receive fresh UUIDs. `relinkSprintTasks()` rebuilds the `backlogTaskId` link by matching on `taskId` (e.g. "0.1.1"), which survives the Excel round-trip. Matched sprint tasks have `name`, `estimate`, and `assignedTo` refreshed; `status`, `worked`, `remain`, and logs are preserved. Sprint tasks whose `taskId` is not found are removed after user confirmation.

### Storage Limits

- Firestore: 1 MiB document limit. A sprint with 50 tasks × 14-day log is ~15 KB; hundreds of sprints per team before concern.
- localStorage: typically 5–10 MB per origin; used as a write-through cache in multi-user mode.

### Firestore Sync Strategy

- **Write**: every `save()` call immediately updates localStorage and sets `lastFirestoreWriteAt = Date.now()`. A debounced (500 ms) async write sends to Firestore.
- **Read**: `onSnapshot` listener fires on every remote change. Echo suppression: if `Date.now() - lastFirestoreWriteAt < 5000`, the snapshot is ignored (it's our own write echoing back).
- **`projectToday` preservation**: `projectToday` is per-session (not shared). Remote snapshots apply `fixLoadedState()` but immediately restore `state.projectToday` from before the snapshot.
- **Legacy mode**: if `isFirebaseConfigured = false` (placeholder API key), the app behaves identically to the pre-Firebase version using only localStorage.

## 5. Key Algorithms

### 5.1 Working Days Calculation (`getWorkingDates` in `utils.ts`)

Iterates from `startDate` to `endDate` inclusive. Excludes Saturday/Sunday unless the date appears in `workWeekends`. Excludes dates in `holidays`. Returns `string[]` of ISO date strings.

### 5.2 Timezone-Safe Date Formatting (`localIso` in `utils.ts`)

All date arithmetic uses `getFullYear() / getMonth() / getDate()` (local time). Critical for UTC+ users: `toISOString()` at midnight local time returns the previous UTC day, causing off-by-one errors. `localIso(date)` is used by `todayIso`, `addDays`, `getWorkingDates`, `getNextWorkingDay`, and `addWorkingDays`.

### 5.3 Sprint Overlap & Gap Detection (`utils.ts`)

- **Overlap prevention**: date pickers use `updateGapBounds()` to dynamically set `maxDate`/`minDate` on the end/start picker so the user cannot select a range that crosses another sprint.
- **Gap warning**: `findGaps(sprints)` — if `getNextWorkingDay(sprint[i].endDate) < sprint[i+1].startDate`, a gap exists. Warns after save but does not block.

### 5.4 Burndown Calculation (`calculateBurndown` in `burndown.ts`)

Accepts `(sprint, chartToday, holidays?, workWeekends?)`.

Uses an **N+1 border model**: N working days form N bands; the chart has N+1 plot borders (border 0 = before any work, border N = after the last day).

- **`dates`**: working days from `startDate` to `endDate` (length = N).
- **`plannedPoints`**: `sprint.plannedPoints ?? sum(task.estimate)` — the ideal line baseline.
- **`effectiveManDays`**: `developers × N × efficiency`.
- **`idealDailyBurn`**: `effectiveManDays / N` (used for stats only).
- **Ideal line** (`ideal[0..N]`): `ideal[i] = max(0, plannedPoints × (1 − i/N))`. Reaches exactly 0 at border N. Never changes after `finalizeSprintPlan()` locks `plannedPoints`.
- **`todayIndex`**: last band index `i` where `dates[i] ≤ chartToday` (0-based).
- **`initialScope`**: sum of estimates for tasks active at sprint start + `scopeDropContribAt(startDate)`. Used as `actual[0]` and `scope[0]` (border 0).
- **Actual line** (`actual[0..todayIndex+1]`): `actual[0] = initialScope`; `actual[i+1]` = sum of `getRemainAtDate(task, dates[i])` for active tasks + `scopeDropContribAt(dates[i])`.
- **Scope line** (`scope[0..todayIndex+1]`): same layout but sums `getWorkedAtDate + getRemainAtDate` per task.
- **Scope drop markers**: plotted at `borderIdx = dateIdx + 1` (right border of the drop day).
- **`toPoint` in chart.ts**: x-coordinate denominator is `dates.length` (= N), not N+1.

### 5.5 Log-Aware Point-in-Time Queries (`burndown.ts`)

```
getRemainAtDate(task, date):
  if task.doneDate ≤ date → return 0
  if remainLog empty → return task.remain
  find latest remainLog entry with entry.date ≤ date → return entry.remain
  if none found → return task.estimate

getWorkedAtDate(task, date):
  if workedLog empty → return task.worked
  find latest workedLog entry with entry.date ≤ date → return entry.worked
  if none found → return 0
```

### 5.6 Scope Drop Contribution (`burndown.ts`)

```
scopeDropContribAt(date):
  sum estimate of scopeDrops where addedDate ≤ date AND removedDate > date
```

A scope drop contributes to actual/scope lines during the window `[addedDate, removedDate)`, representing scope that was planned but later removed.

### 5.7 Project TODAY & Chart Date System (`render.ts`)

Two dates drive the chart and task table:

| Variable | Source | Purpose |
|---|---|---|
| `projectToday` | `getProjectToday()` | Recording date; authoritative for logs and the actual/scope lines |
| `chartToday` | `projectToday` clamped to `[startDate, maxToday]` | Passed to `calculateBurndown`; determines where the actual line stops |
| `effectiveToday` | `sprint.today` clamped to `[startDate, maxToday]` | Browse date for the task table historical view |
| `todayIndex` | index of `chartToday` in dates array | Band index of today; shaded rect spans `[todayIndex/N, (todayIndex+1)/N]` |
| `effectiveBrowseIndex` | index of `effectiveToday` in dates array | Position of the gray browse marker (right border = `(index+1)/N`) |

Chart click behaviour:
- **Current sprint** (`isSprintActive`): clicking a date calls `setProjectToday(date)`, updating project TODAY and all sprint browse dates.
- **Past/future sprint**: clicking a date toggles the gray browse marker at the right border of that day; clicking the same date again clears it.

**Today band** (`showTodayLabel = chartToday === projectToday`): shown only when project TODAY is within the current sprint. Rendered as a shaded `<rect>` from `todayIndex/N` to `(todayIndex+1)/N`.

**isLastDay** (`render.ts`): `isSprintActive && projectToday === sprint.endDate`. When true, undone tasks show Move (Todo) or Split (In Progress) buttons.

### 5.8 isSprintActive (`render.ts`)

```
isSprintActive = projectToday >= sprint.startDate && projectToday <= sprint.endDate
```

Controls all interactive elements in the task table and backlog panel:
- Update/Save button hidden when not active
- Remove button hidden when not active
- Add task buttons/inputs disabled when not active
- Drag-to-add disabled when not active

### 5.9 Available Days (`renderStats` in `render.ts`)

```
availableDays = effectiveManDays − totalPoints
```

Color: green if `−1.5 ≤ availableDays ≤ 1.5`, red if `availableDays < −1.5`, default otherwise.

### 5.10 Priority Snapping (`render.ts`, backlog)

ArrowUp: `Math.floor(cur / 10) * 10 + 10`
ArrowDown: `Math.max(0, Math.ceil(cur / 10) * 10 − 10)`
Example: 45 → Up → 50; 45 → Down → 40.

## 6. Rendering Strategy

The app uses **selective re-render** with bitmask render hints:

1. State mutations in `state.ts` call `save()` then fire `onChange(hints)`.
2. `main.ts` registers `render` as the callback via `setOnStateChange(render)`.
3. `render(hints)` checks the bitmask and rebuilds only flagged regions.
4. `<template>` elements are cloned for sprint items, task rows, backlog panel rows, backlog story rows, and backlog task rows.
5. Event listeners are re-attached on each region rebuild.

### Render Hint Bitmask (`state.ts`)

| Constant | Bit | Region |
|---|---|---|
| `H_SIDEBAR` | 1 | Sprint list in sidebar |
| `H_HEADER` | 2 | Sprint title, edit/delete buttons, project TODAY picker |
| `H_TASKS` | 4 | Task table rows |
| `H_PANEL` | 8 | Unassigned backlog panel |
| `H_STATS` | 16 | Stats card |
| `H_CHART` | 32 | SVG burndown chart |
| `H_BACKLOG` | 64 | Backlog tab table |
| `H_ALL` | 127 | All regions |

Convenience groups: `H_SPRINT_TASKS = H_TASKS | H_PANEL | H_STATS | H_CHART` and `H_BACKLOG_DATA = H_BACKLOG | H_PANEL`.

### Tab State

`activeTab` (`"sprint"` | `"backlog"`) is a module-level variable in `render.ts`. `setActiveTab(tab)` updates it and calls `render()`. `render()` toggles visibility of `#sprintView` / `#backlogView`.

### Backlog UI State

Two module-level Sets in `render.ts` persist across renders:
- `editingIds` — UUIDs of stories/tasks in edit mode.
- `expandedStoryIds` — UUIDs of stories whose task rows are visible.

### Flatpickr Instance Management

- **Modal date pickers** (`fpStart`, `fpEnd` in `main.ts`): destroyed and recreated on each modal open. `updateGapBounds()` dynamically constrains `maxDate`/`minDate` as the user picks dates to prevent overlap with other sprints.
- **Project TODAY picker** (`fpProjectToday` in `render.ts`): destroyed and recreated on every `render()` call so holiday/weekend disable rules stay current.
- **Calendar popup positioning**: Flatpickr appends its calendar to `<body>` with `position: absolute`, which scrolls with the page while the modal is `position: fixed`. Fixed via an `onOpen` callback that overrides position to `fixed` using `getBoundingClientRect()` after `setTimeout(0)`.

### Sprint Planning Modal

Opened from "Add Sprint" (create) and "Edit Sprint" on future sprints (plan-edit mode). Displays:
- Sprint stats: duration, working days, total points, available days (color-coded)
- Left panel: Sprint Tasks (draggable, removable)
- Right panel: Unassigned Backlog tasks (sortable, draggable, add button)

On close (`closePlanModal`): calls `finalizeSprintPlan()`, which sets `sprint.plannedPoints = sum(task.estimate)` and fires `H_CHART`. This locks the ideal line for the sprint.

Add/remove cancellation: `addTaskFromBacklog` checks `sprint.scopeDrops` for a matching drop (by `taskId` or `name`, searching from the end). If found, the ScopeDrop is removed and the original `addedDate` is restored — net effect is zero scope change.

## 7. Module Responsibilities

| Module | Responsibility |
|---|---|
| `types.ts` | Shared interfaces: `Sprint`, `SprintTask`, `RemainEntry`, `WorkedEntry`, `ScopeDrop`, `ScopeDropMarker`, `BacklogStory`, `BacklogTask`, `BurndownData`, `AppState`, `SortState`, `GapInfo`, `UserRole`, `UserProfile`, `Team` |
| `utils.ts` | Pure helpers: timezone-safe date math, working day calculation, overlap/gap detection, UUID, formatting |
| `dom.ts` | Queries and exports all DOM element references |
| `firebase.ts` | Firebase app initialization; exports `auth`, `db`, `isFirebaseConfigured` flag |
| `auth.ts` | `initAuth(onLogin, onLogout)`, `signInWithGoogle()`, `signInWithFakeEmail(email)` (localhost only), `signOut()`, `ensureUserProfile(user)` → returns `UserProfile \| null`; `createNewUserProfile(user)` called only after explicit register confirmation |
| `db.ts` | Firestore CRUD: `getUserProfile`, `createUserProfile`, `updateUserProfile` (handles `phoneNumber: null` → `deleteField()`); `getTeamsForUser`, `getTeamsManagedBy(uid)` (teams where `ownerId === uid`), `createTeam`, `addMemberToTeamWithPrefs`, `removeMemberFromTeamWithPrefs`, `deleteTeam` (cleans team doc + appdata + all member memos); `loadTeamState`, `saveTeamState`, `subscribeToTeamState`; `getAllUsers`, `setUserRole`, `deleteUserProfile`; `getUserMemo`, `saveUserMemo`, `getTeamById`, `getUsersByIds` |
| `screens.ts` | Dynamic DOM overlays: `showLoginScreen()` (quiet ghost sign-in button), `showTeamScreen()`, `showAdminScreen()` (sortable table, PM-owns-teams block, SM confirm dialog), `showManageMembers()` (task-assignment + owns-teams guard), `showRegisterPrompt()`, `showProfileEditModal(profile, isNew, onSaved)`, `hideAllScreens()` |
| `state.ts` | State CRUD for sprints and backlog; localStorage + Firestore load/save/sync; `setCurrentTeam(teamId)` async; echo suppression; `projectToday` preservation on remote snapshots; change callback; `getProjectToday`/`setProjectToday`; `finalizeSprintPlan` |
| `burndown.ts` | Pure burndown calculation: ideal/actual/scope lines, scope drop contribution, log-aware point-in-time queries |
| `chart.ts` | SVG chart rendering: grid, ideal/actual/scope lines, Today marker (indigo), browse marker (gray), scope drop triangles, clickable date labels |
| `render.ts` | Full DOM rebuild: sprint list, task table (Update/Save UX, auto-status display, isSprintActive gating), backlog panel (assigned popup picker via `openAssignedPicker()`), stats card, planning modal, project TODAY Flatpickr picker |
| `io.ts` | JSON export/import; sprint Excel export; backlog Excel export and import (`assignedTo` round-trips as comma-separated string); sprint↔backlog re-linking; import confirmation dialogs |
| `main.ts` | Entry point: auth gate (`initAuth`), `startApp(teamId)` (fetches team members → `replaceMembers()`), Switch Team / Sign Out wiring; tab/toolbar event wiring; sprint modal; planning modal; preferences modal (holidays/workweekend disable predicates, read-only member list, private memo with 800 ms debounce + Markdown preview); delete/reset confirm dialogs |

### Module Dependency Graph

```
main.ts
├── dom.ts
├── firebase.ts
├── auth.ts ← firebase.ts, db.ts, types.ts
├── screens.ts ← db.ts, auth.ts, types.ts
├── state.ts ← firebase.ts, db.ts, utils.ts, types.ts
├── render.ts
│   ├── dom.ts
│   ├── state.ts
│   ├── burndown.ts ← utils.ts, types.ts
│   ├── chart.ts ← dom.ts, utils.ts, types.ts
│   └── utils.ts
└── io.ts ← state.ts, utils.ts, dom.ts, types.ts

db.ts ← firebase.ts, types.ts
```

No circular dependencies. `state.ts` communicates with `render.ts` via a callback registered by `main.ts`, avoiding a direct import cycle.

## 8. Technical Debt & Risks

| ID | Issue | Severity | Status | Notes |
|---|---|---|---|---|
| TD-01 | No git repository | High | **Resolved** | Git initialized, connected to GitHub remote. |
| TD-02 | Full re-render on every change | Medium | **Resolved** | Selective rendering via bitmask hints. |
| TD-03 | No tests | Medium | **Resolved** | 59 unit tests via Node built-in test runner (`npm test`). |
| TD-04 | Single JS file | Low | **Resolved** | Split into 13 ES modules under `src/`. |
| TD-05 | localStorage only | Medium | **Resolved** | Firestore real-time sync added; localStorage is now a write-through cache. |
| TD-06 | No input validation | Low | Open | Invalid dates, negative estimates, efficiency > 1 are not explicitly blocked in JS. |
| TD-07 | No error handling | Low | **Resolved** | `loadState` has try/catch with graceful fallback. |
| TD-08 | Date handling / timezone | Low | **Resolved** | `localIso()` fixes UTC+N off-by-one. String comparison retained where safe. |
| TD-09 | Backlog denormalization | Low | **Mitigated** | Sprint tasks copy fields at assignment; backlog re-import triggers `relinkSprintTasks()`. |
| TD-10 | No Firestore offline conflict resolution | Low | Open | Last-writer-wins on snapshot apply. Echo suppression (5 s window) prevents self-overwrite but simultaneous edits by two users may cause the slower write to be overwritten. |
| TD-11 | Firebase user deletion is profile-only | Low | Open | `deleteUserProfile` removes the Firestore `/users/{uid}` doc but cannot delete the Firebase Auth account (requires Admin SDK). The user can still sign in but will be recreated as a `member` on next login. |

## 9. Future Architecture Considerations

### Firestore conflict resolution
- Current strategy is last-writer-wins with 5 s echo suppression.
- For higher concurrency, consider Firestore transactions or per-sprint sub-collections so different teams' sprints can be written independently.

### Operational transforms / CRDTs
- For simultaneous cell-level editing (e.g. two users updating the same task at once), an OT or CRDT library would be needed. Currently out of scope (~30 users, low concurrency expected).

### Firebase Admin SDK (server-side)
- Deleting Firebase Auth accounts requires the Admin SDK (Node.js backend or Cloud Function).
- A Cloud Function triggered on `/users/{uid}` delete could call `admin.auth().deleteUser(uid)` and clean up `appdata` references.

### If migrating to Vite
- Vite could replace esbuild for a richer dev experience (HMR, TypeScript, CSS modules).
- Migration path: add `vite.config.ts`, update `package.json` scripts. The existing `src/main.ts` entry point and module structure are already Vite-compatible.

## 10. Revision History

| Date | Version | Changes |
|---|---|---|
| 2026-02-20 | 0.1 | Initial draft based on MVP codebase analysis |
| 2026-02-20 | 0.2 | Updated for ES module refactor; resolved tech debt items |
| 2026-02-20 | 0.3 | Build pipeline section; module responsibilities; data safety notes |
| 2026-02-21 | 0.4 | Data model (description, today fields); Flatpickr in tech stack; timezone-safe date algorithm; overlap/gap detection; today clipping; Flatpickr instance management |
| 2026-02-23 | 0.5 | Backlog data model (Story, BacklogTask, denormalized SprintTask); SheetJS in tech stack; Excel import/export; priority snapping algorithm; TD-09 |
| 2026-02-24 | 0.6 | Sprint↔backlog re-linking on import; custom confirm dialogs |
| 2026-02-24 | 0.7 | Selective rendering via bitmask render hints; hint table and examples |
| 2026-02-26 | 0.8 | `getWorkingDates` accepts holidays and workWeekends sets |
| 2026-02-27 | 0.9 | Drag-and-drop reorder; progress %; scope line algorithm; 59 unit tests |
| 2026-03-03 | 1.0 | TypeScript migration; `worked`/`remain`/`workedLog`/`remainLog` data model; log-aware burndown queries; Update/Save UX; auto-status; scope drop model |
| 2026-03-05 | 1.1 | Project TODAY field and semantics; `plannedPoints` and `finalizeSprintPlan`; `addedDate` field and planned-vs-mid-sprint distinction; `isSprintActive` gate; `chartToday` vs `effectiveToday` vs `browseIndex`; chart browse marker; chart click behaviour by sprint type; scope drop add/remove cancellation; sprint reset keeps tasks; `updateGapBounds` for non-overlapping date pickers; project TODAY resets to real date on load |
| 2026-03-05 | 1.2 | Multi-user: Firebase Auth + Firestore; `firebase.ts`, `auth.ts`, `db.ts`, `screens.ts` new modules; `UserRole`, `UserProfile`, `Team` types; `setCurrentTeam` async in `state.ts`; echo suppression + `projectToday` preservation on remote snapshots; role-based Firestore security rules; login/team-selection/admin screen overlays; Switch Team button; team management (create/manage members/delete); admin user management (roles/delete); TD-10, TD-11 added |
| 2026-03-06 | 1.3 | `BacklogTask.assignedTo` changed to `string[]`; `openAssignedPicker()` popup in `render.ts`; `updateUserProfile` handles `phoneNumber: null` → `deleteField()`; `ensureUserProfile` returns `{ profile, isNew }`; `showProfileEditModal` in `screens.ts`; `getUserMemo`/`saveUserMemo`/`getTeamById`/`getUsersByIds` in `db.ts`; `deleteTeam` now fetches memberIds and cleans up memos via `deleteField()`; `addMemberToTeamWithPrefs`/`removeMemberFromTeamWithPrefs` replace old add/remove helpers; flatpickr disable switched to predicate functions for holidays and work weekends; memo stored at `users/{uid}.memos.{teamId}`; `UserProfile.phoneNumber?` and `memos` fields added; sign-in button redesigned as ghost style |
| 2026-03-07 | 1.4 | Burndown N+1 border model: `ideal[i] = plannedPoints×(1−i/N)`, reaches exactly 0; `actual[0]=scope[0]=initialScope`; scope drop markers at `borderIdx=dateIdx+1`; Today shown as shaded band in current sprint only; browse marker at right border `(index+1)/N`. Move/Split on last sprint day: `moveTaskToSprint` and `splitTaskToSprint` in `state.ts`; `isLastDay` flag in `render.ts`. `projectToday` on page load uses `getNextWorkingDay(addDays(today, -1))` to skip weekends/holidays. Login: `ensureUserProfile` returns `null` for unknown users → `showRegisterPrompt` → `createNewUserProfile`. Admin table sortable by Email/Name. Developer count in sprint modal capped at team member count. Member removal guard: `findAssignedTasksInTeam` (Manage/PM), `findAssignedTasksAcrossTeams` (Admin/SM); `getTeamsManagedBy` blocks removal if user owns teams. SM Admin deletion always shows `showSmRemoveConfirmDialog` with custom message. `showSmRemoveConfirmDialog` updated to accept `message` parameter. |
