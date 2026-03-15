# Burndown Studio — Project Roadmap

**Version:** 1.3
**Last updated:** 2026-03-16
**Status:** Draft — open for review

---

## Roadmap Overview

```
Phase 0 (Done)     Phase 1 (Done)     Phase 2 (Done)     Phase 3            Phase 4 (Done)     Phase 5 (Done)     Phase 6 (Done)
──────────────     ────────────       ────────────       ────────────       ────────────       ────────────       ────────────
MVP baseline       Data Safety        Daily Usability    Insights           Multi-user         SaaS Hardening     User Profiles
+ Tech Foundation  & Accuracy                            & History          & Integrations     & Onboarding       & Avatars
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

## Phase 2 — Daily Usability (DONE)

**Goal:** Make the tool pleasant enough for daily standup use.

### Features

| ID | Feature | Priority | Effort | Status | Description |
|---|---|---|---|---|---|
| F-201 | Task drag-and-drop reordering | P1 | Medium | **Done** | Handle-only drag (`⠿`); disabled during column sort; order persisted via `reorderTasks()` |
| F-202 | Sprint progress percentage | P1 | Small | **Done** | "X% complete" stat with visual progress bar in stats card |
| F-203 | Sprint cloning | P2 | Small | Deferred | Clone sprint structure with statuses reset to Todo |
| F-204 | Scope change tracking | P2 | Medium | **Done** | Per-task `workedLog`/`remainLog` records daily worked and remain values; scope line on chart shows sum(worked+remain) per day up to today |
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
| T-302 | Migrate to TypeScript | P3 | Medium | **Done** | Add type safety to the data model and calculation functions |

### Exit Criteria
- Teams with 3+ completed sprints can see a velocity trend.
- Completed sprints are clearly distinguished from active ones.

---

## Phase 4 — Multi-user & Integrations (DONE)

**Goal:** Support team usage with shared data and external tool integration.

### Features

| ID | Feature | Priority | Effort | Status | Description |
|---|---|---|---|---|---|
| F-401 | Backend storage | P1 | Large | **Done** | Firebase Firestore real-time sync per team; localStorage as write-through cache |
| F-402 | User authentication | P2 | Large | **Done** | Firebase Auth: Google Sign-In + dev fake email login |
| F-403 | Multi-team support | P2 | Medium | **Done** | Teams with member management, role-based access (super_manager / product_manager / member), admin screen |
| F-404 | Issue tracker integration | P3 | Large | Open | Sync tasks from Jira, Linear, or GitHub Issues |

### Also Delivered
- User profiles (name + phone; first-time registration; edit via header button)
- Member profile popup in Preferences (read-only list auto-synced from Firebase)
- Private per-user memo (Markdown, auto-save, stored per teamId, cleaned up on team delete)
- Backlog multi-select assignee (`string[]`) with popup picker
- Holiday/work-weekend pickers disable already-added dates (predicate function)
- Sign-in button: quiet ghost style
- **Burndown N+1 border model**: ideal reaches exactly 0; Today shown as shaded band; actual/scope at right border of each day; initial scope at border 0
- **Last-day Move/Split**: Move (Todo) and Split (In Progress) buttons on the last working day of the current sprint; sprint selector shows Total Points + Available Days; excludes past sprints
- **Login register prompt**: unknown users see "register as new user?" before profile creation
- **projectToday skips non-working days** on page load
- **Admin enhancements**: sortable user table (Email/Name); developer count capped at team member count; member count badge refreshes after Manage closes
- **Member removal guards**: blocked if assigned to tasks (PM: current team; SM: all teams) or if user owns any teams; SM always sees custom confirm dialog in Admin

### Exit Criteria
- Multiple users can access their team's sprints from any browser. **(Done)**
- Team data is shared in real time. **(Done)**

---

---

## Phase 5 — SaaS Hardening & Onboarding (DONE)

**Goal:** Make onboarding self-service and robust; harden multi-team isolation, project TODAY semantics, and CI/CD.

### Delivered

| ID | Feature | Status | Description |
|---|---|---|---|
| F-501 | Invitation registration page | **Done** | Dedicated page for invited members: password + Google Sign-In (all domains incl. Workspace); no "existing sign-in" option; displayed from landing page when `pendingInvite` in sessionStorage |
| F-502 | Wrong-user guard on invite accept | **Done** | If a different user is signed in when an invite link is opened, they are signed out; invite page is shown for the correct email |
| F-503 | Landing page error handling | **Done** | Unknown sign-ins display an error message (via sessionStorage `loginError`) and sign out instead of prompting "create account" |
| F-504 | "Add Group Members" in Manage Members | **Done** | PM can add already-accepted group members to a team from the Manage Members modal without re-inviting |
| F-505 | PM member removal warning dialog | **Done** | Removing a member who has assigned tasks shows a warning dialog listing the tasks; PM can proceed or cancel |
| F-506 | PM display name edit | **Done** | "Edit" on the Group screen opens a modal with both the Group name field and a "Your Name" field for the PM's display name |
| F-507 | Project TODAY capped at today | **Done** | Flatpickr `maxDate: "today"` prevents selecting future dates for project TODAY |
| F-508 | Project TODAY resets to most recent workday | **Done** | `getMostRecentWorkingDay()` in `utils.ts` — page load sets projectToday to the most recent non-weekend, non-holiday day (not always real today) |
| F-509 | Sprint default developers = team member count | **Done** | "Add Sprint" and "Edit Sprint" default developer count = `getMemberPairs().length` (role=member only, PM excluded) |
| F-510 | Team data isolation fix | **Done** | `setCurrentTeam` cancels pending debounce save before replacing state; new teams with no Firestore data start with `defaultState()` |
| F-511 | Resilient member profile loading | **Done** | `Promise.allSettled` prevents one failed profile fetch from aborting the entire team load; `setMemberPairs([])` clears stale cache before loading |
| F-512 | GitHub Actions CI/CD | **Done** | CI workflow: typecheck + test on every push; deploy workflow: build + Firebase Hosting auto-deploy on push to `main` |

### Also Delivered
- `/invitations` Firestore collection (`allow read: if true` for unauthenticated registration page)
- `/users` Firestore rule changed to `request.auth != null` (was per-uid check with `isProductManager()`)
- `isProductManager()` helper removed from `firestore.rules` (unused, caused warnings)
- Future plan documented: multi-group membership (freelancer belonging to multiple groups via `groupId[]`)

**Delivered:** 2026-03-14

---

## Phase 6 — User Profiles & Avatars (DONE)

**Goal:** Give every user a face — profile photos with fallback avatars, shown consistently throughout the app.

### Delivered

| ID | Feature | Status | Description |
|---|---|---|---|
| F-601 | Profile photo upload | **Done** | Client-side canvas resize to 640px (full) + 80px (thumb); stored as base64 JPEG in Firestore user doc (`photoFull`, `photoThumb`); remove button clears both fields |
| F-602 | Initial-letter avatar fallback | **Done** | Canvas-drawn colored circle with user's initial; deterministic color from name hash; module-level cache keyed by name+size |
| F-603 | `avatarSrc()` helper | **Done** | Exported from `screens.ts`; returns `photoFull` (≥80px), else `photoThumb`, else generated avatar |
| F-604 | Full-size photo popup | **Done** | `showPhotoPopup(src)` exported; click avatar/thumbnail anywhere in the app to view full size; dismiss with Escape or click outside |
| F-605 | Change password | **Done** | Sub-modal in edit profile (email accounts only, hidden for Google sign-in); reauthenticate with current password before updating |
| F-606 | Avatar in app header | **Done** | 24px circle left of user name in BDS header; set via `updateHeaderUser` in `main.ts` |
| F-607 | Avatar strip on team cards | **Done** | Up to 5 member avatars (28px) + overflow count badge on each team card (PM group screen and member team selection screen) |
| F-608 | Avatar in PM sidebar footer | **Done** | 36px avatar + name + ✎ edit button in a row; Sign Out stacked below |
| F-609 | Avatar in member team selection | **Done** | Group name shown in left header; avatar + name + edit profile button on right |
| F-610 | Avatar in member list (Preferences) | **Done** | 32px avatar left of each member name row; click popup avatar (48px) to view full-size photo |
| F-611 | Responsive BDS header | **Done** | Wide viewport: flat row (title left, user info right); narrow (<900px): stacks vertically, centered |

**Delivered:** 2026-03-16

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
| 2026-03-03 | 0.9 | Marked T-302 (TypeScript migration) as Done. Updated F-204 description: scope line uses per-task workedLog/remainLog instead of sprint-level scopeLog. |
| 2026-03-06 | 1.0 | Phase 4 shipped: F-401/F-402/F-403 marked Done. Phase 2 marked Done. Updated roadmap overview. Added "Also Delivered" section for Phase 4 extras (user profiles, memos, multi-assign, pickers, sign-in UX). |
| 2026-03-07 | 1.1 | Extended "Also Delivered" for Phase 4: burndown N+1 border model, last-day Move/Split, login register prompt, projectToday holiday skip, admin enhancements, member removal guards. |
| 2026-03-14 | 1.2 | Added Phase 5 (SaaS Hardening & Onboarding): invitation registration page, wrong-user guard, landing page error handling, "Add Group Members", PM removal warning dialog, PM display name edit, projectToday future-date cap, getMostRecentWorkingDay, sprint defaults by member count, team data isolation fix, resilient member loading, GitHub Actions CI/CD. Updated roadmap overview to include Phase 5. |
| 2026-03-16 | 1.3 | Added Phase 6 (User Profiles & Avatars): profile photo upload, initial-letter avatar fallback, avatarSrc helper, full-size photo popup, change password modal, avatar in header/team cards/sidebar/member list, responsive BDS header. Updated roadmap overview. |
