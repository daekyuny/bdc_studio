# Burndown Studio — Product Requirements Document

**Version:** 1.3
**Last updated:** 2026-03-16
**Author:** [Your Name]
**Status:** Draft — open for review

---

## 1. Overview

Burndown Studio is a lightweight, local-first web application that helps software teams track sprint progress through task-level burndown charts. It provides a clean ideal-vs-actual view, capacity planning inputs, a structured Product Backlog, and per-task status tracking — all without requiring a server or account.

## 2. Problem Statement

Existing sprint tracking tools (Jira, Azure DevOps, Linear) bundle burndown charts deep inside large, complex platforms. Teams that want a simple, focused burndown view — especially small teams, freelancers, or teams using lightweight project management — lack a dedicated, easy-to-use option.

Key pain points:
- Burndown charts in large tools are hard to configure and often don't reflect real capacity (PTO, efficiency).
- No standalone tool provides quick "open and track" burndown without account setup.
- Teams lose data when switching between tools or browsers because there's no simple export.
- Backlogs are maintained in spreadsheets and must be manually re-entered into tracking tools.

## 3. Target Users

### 3.1 Primary Persona — Team Lead / Scrum Master
- Manages 1-3 sprints at a time for a team of 3-8 developers.
- Wants a quick daily view of sprint health without logging into a heavy tool.
- Cares about: ideal vs actual burn, remaining capacity, scope changes.

### 3.2 Secondary Persona — Solo Developer / Freelancer
- Tracks personal sprints or project milestones.
- Wants minimal setup, no accounts, works offline.
- Cares about: simplicity, speed, data portability.

### 3.3 Future Persona — Engineering Manager (deferred)
- Oversees multiple teams/sprints.
- Needs cross-sprint velocity trends and team-level dashboards.
- Requires multi-user access and shared data.

## 4. Current Features (v1.0)

### Sprint Management

| Feature | Description | Status |
|---|---|---|
| Multiple sprints | Create, switch, delete; auto-sorted by start date; numbered dynamically | Done |
| Sprint modal | Create/edit via modal dialog: optional description, date pickers, developers, efficiency | Done |
| Calendar date pickers | Flatpickr pickers for sprint start/end dates; weekends and occupied ranges greyed out | Done |
| Overlap validation | Overlapping sprint date ranges are blocked at save with an inline error | Done |
| Gap warning | Alert when unassigned working days exist between consecutive sprints | Done |
| Sprint title | Optional description shown as scrollable heading above the main content area | Done |
| Weekend skipping | Working-day calculation auto-excludes Sat/Sun | Done |
| Today override | "Today" date field in Tasks header; overrides real date for chart; persisted per sprint | Done |
| Working days chip | Live working-day count shown in sprint modal as start/end dates are selected | Done |

### Task Tracking

| Feature | Description | Status |
|---|---|---|
| Sprint tasks from backlog | Tasks are added to a sprint from the Product Backlog (by task ID or drag-and-drop) | Done |
| Estimate vs Actual/Est | `estimate` from backlog (read-only); `worked` and `remain` tracked daily; Actual/Est column shows `worked + remain` | Done |
| Task ID | Tasks carry a structured ID (e.g. `0.1.1`) from the backlog; hover shows parent User Story | Done |
| Assigned To tooltip | Assignee name shown as tooltip on hover over task name (sprint) or task description (backlog panel) | Done |
| Status toggle | Click status span to toggle Todo ↔ In Progress (only when worked = 0); auto-set to Done when remain = 0 | Done |
| Change / Save button | Worked and Remain fields are read-only by default; "Change" button reveals both inputs; becomes "Save" to commit | Done |
| Daily worked & remain log | Every Save records `{ date, worked }` and `{ date, remain }` per task; enables accurate historical burndown and scope lines | Done |
| Done Date | Read-only span; auto-set to today when remain reaches 0; cleared when task reverts to In Progress | Done |
| Remove from sprint | Tasks can be removed from a sprint (only when status is Todo) without deleting them from the backlog | Done |

### Product Backlog

| Feature | Description | Status |
|---|---|---|
| Story → Task hierarchy | Backlog structured as Stories containing Tasks (two-level hierarchy) | Done |
| Collapsible stories | Each story row can expand/collapse to show/hide its tasks | Done |
| Expand All / Collapse All | Bulk expand or collapse all stories in one click | Done |
| Edit mode per row | Dedicated Edit/Save/Cancel/Delete buttons per story and task row | Done |
| Add Story / Add Task | Add new stories; tasks can only be added to expanded stories | Done |
| Priority field | Integer priority per story (default 100, min 0); arrow keys snap to nearest 10 | Done |
| Assigned To | Each backlog task carries a multi-select assignee list (`string[]`); clicking the field in edit mode opens a popup picker with checkboxes; denormalized to sprint tasks as comma-separated string | Done |
| Delete All | Wipe entire backlog with a warning confirmation | Done |
| Excel import | Import backlog from `.xlsx`/`.xls` file (SheetJS); re-links sprint tasks by Task ID; two-step custom confirmation with orphan warning | Done |
| Excel export | Export backlog to `.xlsx` file with 7-column format | Done |

### Visualization & Export

| Feature | Description | Status |
|---|---|---|
| Burndown chart | SVG ideal (blue), actual (red), and scope (green dashed) line chart with N+1 border model; ideal reaches exactly 0; Today shown as shaded band (current sprint only); browse marker (past/future sprints); click x-axis date label to set TODAY | Done |
| Side-by-side layout | Sprint summary and burndown chart displayed side by side; tasks below | Done |
| Stats dashboard | Duration, working days, total points, remaining, done tasks, available days, progress % | Done |
| Available Days indicator | `effectiveManDays - totalPoints`, color-coded green/red | Done |
| Date format | Dates displayed as mm/dd throughout (summary, chart x-axis) | Done |
| Show day numbers toggle | Switch between D1/D2 labels and mm/dd dates on the chart X-axis | Done |
| Sprint Excel export | Export active sprint task list to `.xlsx` | Done |
| JSON export/import | Download full state as `.json` file; import to restore; custom confirm dialog | Done |

### Multi-user & Authentication

| Feature | Description | Status |
|---|---|---|
| Google Sign-In | Firebase Auth; quiet ghost-style sign-in button | Done |
| Team management | PM/SM: create teams, manage members, delete teams (cleans up all Firestore data incl. member memos); member count badge refreshes after Manage closes | Done |
| Role-based access | super_manager / product_manager / member roles with Firestore security rules | Done |
| Admin screen | Super Manager only (no team access): view all users, change roles, assign Groups, delete profiles; deletion blocked if user owns teams or is assigned to tasks; always shows custom confirm dialog | Done |
| Group screen | PM only: manage one Group (tenant); Teams and Members tabs; create/delete teams, add/remove members per team, remove members from group | Done |
| Group model | Group is top-level tenant; PM owns one Group; Teams and Members scoped to Group; SM can view all Groups read-only | Done |
| Member removal guard | Removing a member blocked if assigned to tasks in the team (PM) or across all teams (SM); also blocked if member owns any teams | Done |
| User profiles | Name + phone; first-time "register?" prompt on unknown login; registration modal; edit via header button | Done |
| Profile photo & avatar | Upload photo (client-side canvas resize to 640px/80px, base64 in Firestore); canvas initial-letter fallback; shown in header, team cards, member lists, popups; click to view full size | Done |
| Change password | Sub-modal in edit profile (email accounts only); reauthenticate with current password, then update | Done |
| Member list in Preferences | Read-only, auto-synced from Firebase; click row for full profile popup; click avatar in popup to view full-size photo | Done |
| Private memo | Per-user, per-team Markdown notes in Preferences; auto-saved; deleted when team is deleted | Done |
| Last-day Move / Split | On the last working day of the current sprint: Todo tasks get a Move button (ScopeDrop + add to target sprint); In Progress tasks get a Split button (mark Done + create continuation task with suffix b in target sprint) | Done |

### General

| Feature | Description | Status |
|---|---|---|
| Sprint/Backlog tab navigation | Top-level tab bar switches between Sprint view and Backlog view | Done |
| Input commit on blur/Enter | No mid-typing recalculations | Done |
| Firestore + localStorage | Primary: Firestore real-time sync per team. Fallback: localStorage-only when Firebase not configured | Done |
| Data migration | Old `points` → `estimate`; `worked`/`remain` initialized; `assignedTo` string → string[] | Done |
| TypeScript | Full codebase; strict typing for all modules and data model | Done |
| Graceful error recovery | Corrupt localStorage data is detected and reset to defaults | Done |
| Modular codebase | Source split into 14 ES modules (incl. firebase, auth, db, screens), bundled via esbuild | Done |
| Member name resolution | Email IDs stored in backlog/sprint assignedTo; resolved to display names via persisted email→name cache (localStorage); names always shown, never raw email addresses | Done |

## 5. Planned Features

### 5.1 Phase 1 — Data Safety & Accuracy (DONE)

| ID | Feature | Priority | Status | Description |
|---|---|---|---|---|
| F-101 | JSON export/import | P0 | **Done** | Export full app state as JSON file; import to restore. Protects against data loss. |
| F-102 | Holiday / PTO exclusions | P0 | **Done** | Mark specific dates as non-working (global preferences). These dates are excluded from working-day calculations, the ideal burn line, and sprint date pickers. |
| F-103 | Sprint task export | P1 | **Done** | Export the task list of the active sprint as an Excel file. |
| F-104 | Product Backlog | P0 | **Done** | Story→Task hierarchy independent of sprints; tasks assigned to sprints from backlog; Excel import/export. |

### 5.2 Phase 2 — Daily Usability

| ID | Feature | Priority | Status | Description |
|---|---|---|---|---|
| F-201 | Task drag-and-drop reordering | P1 | **Done** | Reorder sprint tasks by dragging the ⠿ handle. Persisted order. Disabled when column sort is active. |
| F-202 | Sprint progress percentage | P1 | **Done** | "X% complete" in the stats card with visual progress bar, based on done estimates vs total estimates. |
| F-203 | Sprint cloning / templates | P2 | Deferred | Clone an existing sprint's task structure (names + estimates) into a new sprint with all statuses reset to Todo. |
| F-204 | Scope change tracking | P2 | **Done** | Per-task `workedLog`/`remainLog` records daily worked and remain values. Green dashed scope line on burndown chart shows sum(worked+remain) per day up to today. |

### 5.3 Phase 3 — Insights & History

| ID | Feature | Priority | Status | Description |
|---|---|---|---|---|
| F-301 | Sprint velocity chart | P1 | Open | After 2+ completed sprints, show a bar chart of points completed per sprint over time. |
| F-302 | Sprint archive / completion | P2 | Open | Mark a sprint as "completed." Completed sprints are visually distinct and read-only. |
| F-303 | Burndown chart tooltips | P2 | Open | Hover over a data point on the chart to see the date, ideal value, and actual value. |

### 5.4 Phase 4 — Multi-user & Integrations

| ID | Feature | Priority | Status | Description |
|---|---|---|---|---|
| F-401 | Backend storage | P1 | **Done** | Firebase Firestore real-time sync per team; localStorage as write-through cache. |
| F-402 | User authentication | P2 | **Done** | Firebase Auth: Google Sign-In (production) + fake email (localhost dev). |
| F-403 | Multi-team support | P2 | **Done** | Teams with member management, role-based access, admin screen. |
| F-404 | Issue tracker integration | P3 | Open | Pull tasks from Jira, Linear, or GitHub Issues. |

## 6. Out of Scope (for now)

- Simultaneous cell-level editing (two users on the same task at once) — last-writer-wins currently.
- Mobile native app.
- Notifications / email alerts.
- Story-point estimation tools (planning poker, etc.).
- Firebase Auth account deletion (requires Admin SDK / Cloud Function).

## 7. Success Metrics

| Metric | Target | How to Measure |
|---|---|---|
| Data loss incidents | 0 after export/import ships | User feedback |
| Sprint setup time | < 2 minutes from open to first task entered | Manual timing |
| Daily update time | < 30 seconds to update task statuses | Manual timing |
| Burndown accuracy | Ideal line matches real capacity (holidays, efficiency) | Compare to manual calculation |

## 8. Open Questions

- [ ] Should "days" (estimates) support fractional values (e.g., 0.5)? Currently supported in the input (`step="0.5"`) but not explicitly documented.
- [ ] Should there be a distinction between "story points" and "person-days"? Currently they are treated as equivalent.
- [ ] What is the maximum number of sprints/tasks we should support before recommending a backend?
- [ ] Should completed sprints be archivable or deletable only?
- [ ] Should priority be enforced as a sort order, or is it purely an informational number?

## 9. Revision History

| Date | Version | Changes |
|---|---|---|
| 2026-02-20 | 0.1 | Initial draft based on MVP codebase analysis |
| 2026-02-20 | 0.2 | Updated feature table with completed items (JSON export/import, day toggle, error recovery, modular codebase). Added status column to planned features. Updated Available Days formula. |
| 2026-02-21 | 0.3 | Rewrote current features table to reflect UI redesign: modal sprint edit, Flatpickr pickers, overlap/gap validation, sprint title, Today override, side-by-side layout, working days chip, mm/dd date format. |
| 2026-02-23 | 0.4 | Major update: added Product Backlog feature (F-104) as Done; split current features into Sprint Management, Task Tracking, Product Backlog, Visualization & Export, General sections; updated task model (estimate/actual replacing points); added Sprint/Backlog tab navigation; marked F-103 Done (now Excel export); updated planned features table. |
| 2026-02-24 | 0.5 | Backlog Excel import now re-links sprint tasks by Task ID (refreshes name/estimate/assignedTo, preserves status/actual/doneDate); orphaned sprint tasks warned and removed; all import confirmations use custom styled dialogs instead of browser confirm(). Task ID tooltip now shows parent User Story; assignedTo tooltip added to backlog panel descriptions. |
| 2026-02-26 | 0.6 | Marked F-102 (Holiday/PTO exclusions) as Done. Holidays are managed as a global preferences list; excluded from working-day calculations, ideal burn line, and sprint date pickers. |
| 2026-02-27 | 0.7 | Phase 2 features: marked F-201 (drag-and-drop), F-202 (progress %), F-204 (scope tracking) as Done. Deferred F-203. Updated current features (stats dashboard, burndown chart descriptions). |
| 2026-03-03 | 0.8 | TypeScript migration complete. Updated task tracking: Change/Save button UX, status toggle span, auto-Done on remain=0, Done Date as read-only span, daily workedLog/remainLog, Remove button hidden for non-Todo tasks. Updated chart: scope line now green dashed using per-task logs, clickable date labels to set TODAY. Updated F-204 description. |
| 2026-03-06 | 0.9 | Phase 4 features shipped: F-401/F-402/F-403 marked Done. Added Multi-user & Authentication and General feature tables. Updated Assigned To to multi-select string[]. Added user profiles, member list, private memo features. Updated Out of Scope. |
| 2026-03-07 | 1.0 | Updated to v1.0. Added Last-day Move/Split feature. Updated burndown chart description (N+1 border model, Today band). Updated Admin screen (sortable table, confirm dialog, PM-owns-teams guard). Added Member removal guard row. Updated User profiles (register prompt). |
| 2026-03-09 | 1.1 | Corrected General table: module count updated to 14 (firebase.ts, auth.ts, db.ts, screens.ts added). Clarified super_manager bootstrap: all new users register as member; first super_manager must be set manually via Firebase Console. Firestore rules enforce role = member on self-create. |
| 2026-03-16 | 1.3 | User photos & avatars: profile photo upload (client-side canvas resize to 640px full / 80px thumb, base64 stored in Firestore user doc); canvas-generated initial-letter avatar fallback with deterministic color; `avatarSrc()` helper returns best available size; change password sub-modal (email accounts only, reauthenticate + updatePassword); avatar strip on team cards (max 5 + overflow); click any avatar to view full-size photo; group name shown on left side of member team selection screen; BDS header responsive (flat row at wide viewport, stacked centered at narrow). |
