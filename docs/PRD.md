# Burndown Studio — Product Requirements Document

**Version:** 0.6
**Last updated:** 2026-02-26
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

## 4. Current Features (v0.5)

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
| Estimate vs Actual | `estimate` comes from backlog (read-only); `actual` is entered when task is marked Done | Done |
| Task ID | Tasks carry a structured ID (e.g. `0.1.1`) from the backlog; hover shows parent User Story | Done |
| Assigned To tooltip | Assignee name shown as tooltip on hover over task name (sprint) or task description (backlog panel) | Done |
| Auto-fill on Done | Marking a task Done pre-fills actual with estimate and focuses the actual input | Done |
| Status transitions | Todo → In Progress → Done; clearing Done resets actual and done date | Done |
| Done Date | Date picker constrained to sprint range; auto-set to today when status → Done | Done |
| Remove from sprint | Tasks can be removed from a sprint without deleting them from the backlog | Done |

### Product Backlog

| Feature | Description | Status |
|---|---|---|
| Story → Task hierarchy | Backlog structured as Stories containing Tasks (two-level hierarchy) | Done |
| Collapsible stories | Each story row can expand/collapse to show/hide its tasks | Done |
| Expand All / Collapse All | Bulk expand or collapse all stories in one click | Done |
| Edit mode per row | Dedicated Edit/Save/Cancel/Delete buttons per story and task row | Done |
| Add Story / Add Task | Add new stories; tasks can only be added to expanded stories | Done |
| Priority field | Integer priority per story (default 100, min 0); arrow keys snap to nearest 10 | Done |
| Assigned To | Each backlog task carries an assignee field (denormalized to sprint tasks) | Done |
| Delete All | Wipe entire backlog with a warning confirmation | Done |
| Excel import | Import backlog from `.xlsx`/`.xls` file (SheetJS); re-links sprint tasks by Task ID; two-step custom confirmation with orphan warning | Done |
| Excel export | Export backlog to `.xlsx` file with 7-column format | Done |

### Visualization & Export

| Feature | Description | Status |
|---|---|---|
| Burndown chart | SVG ideal (blue) vs actual (red) line chart; actual clips at today; dashed today marker | Done |
| Side-by-side layout | Sprint summary and burndown chart displayed side by side; tasks below | Done |
| Stats dashboard | Duration, working days, total points, remaining, done tasks, available days | Done |
| Available Days indicator | `effectiveManDays - totalPoints`, color-coded green/red | Done |
| Date format | Dates displayed as mm/dd throughout (summary, chart x-axis) | Done |
| Show day numbers toggle | Switch between D1/D2 labels and mm/dd dates on the chart X-axis | Done |
| Sprint Excel export | Export active sprint task list to `.xlsx` | Done |
| JSON export/import | Download full state as `.json` file; import to restore; custom confirm dialog | Done |

### General

| Feature | Description | Status |
|---|---|---|
| Sprint/Backlog tab navigation | Top-level tab bar switches between Sprint view and Backlog view | Done |
| Input commit on blur/Enter | No mid-typing recalculations | Done |
| localStorage persistence | All data stored in browser localStorage | Done |
| Data migration | Old `points` field auto-migrated to `estimate`/`actual` on load | Done |
| Graceful error recovery | Corrupt localStorage data is detected and reset to defaults | Done |
| Modular codebase | Source split into 8 ES modules, bundled via esbuild | Done |

## 5. Planned Features

### 5.1 Phase 1 — Data Safety & Accuracy (partially complete)

| ID | Feature | Priority | Status | Description |
|---|---|---|---|---|
| F-101 | JSON export/import | P0 | **Done** | Export full app state as JSON file; import to restore. Protects against data loss. |
| F-102 | Holiday / PTO exclusions | P0 | **Done** | Mark specific dates as non-working (global preferences). These dates are excluded from working-day calculations, the ideal burn line, and sprint date pickers. |
| F-103 | Sprint task export | P1 | **Done** | Export the task list of the active sprint as an Excel file. |
| F-104 | Product Backlog | P0 | **Done** | Story→Task hierarchy independent of sprints; tasks assigned to sprints from backlog; Excel import/export. |

### 5.2 Phase 2 — Daily Usability

| ID | Feature | Priority | Status | Description |
|---|---|---|---|---|
| F-201 | Task drag-and-drop reordering | P1 | Open | Reorder sprint tasks by dragging rows. Persisted order is used in the table. |
| F-202 | Sprint progress percentage | P1 | Open | Show "X% complete" in the stats card based on done points vs total points. |
| F-203 | Sprint cloning / templates | P2 | Open | Clone an existing sprint's task structure (names + estimates) into a new sprint with all statuses reset to Todo. |
| F-204 | Scope change tracking | P2 | Open | Record when tasks are added/removed mid-sprint. Optionally display a "scope line" on the burndown chart. |

### 5.3 Phase 3 — Insights & History

| ID | Feature | Priority | Status | Description |
|---|---|---|---|---|
| F-301 | Sprint velocity chart | P1 | Open | After 2+ completed sprints, show a bar chart of points completed per sprint over time. |
| F-302 | Sprint archive / completion | P2 | Open | Mark a sprint as "completed." Completed sprints are visually distinct and read-only. |
| F-303 | Burndown chart tooltips | P2 | Open | Hover over a data point on the chart to see the date, ideal value, and actual value. |

### 5.4 Phase 4 — Multi-user & Integrations (deferred)

| ID | Feature | Priority | Status | Description |
|---|---|---|---|---|
| F-401 | Backend storage | P1 | Open | Move from localStorage to a server-side store (or file-based sync) for durability and sharing. |
| F-402 | User authentication | P2 | Open | Simple auth (email/password or OAuth) to support per-user data. |
| F-403 | Multi-team support | P2 | Open | Organize sprints by team. Each team sees only its own sprints. |
| F-404 | Issue tracker integration | P3 | Open | Pull tasks from Jira, Linear, or GitHub Issues. |

## 6. Out of Scope (for now)

- Real-time collaboration (multiple users editing the same sprint simultaneously).
- Mobile native app.
- Notifications / email alerts.
- Story-point estimation tools (planning poker, etc.).

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
