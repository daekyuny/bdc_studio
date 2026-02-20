# Burndown Studio — Product Requirements Document

**Version:** 0.1 (Draft)
**Last updated:** 2026-02-20
**Author:** [Your Name]
**Status:** Draft — open for review

---

## 1. Overview

Burndown Studio is a lightweight, local-first web application that helps software teams track sprint progress through task-level burndown charts. It provides a clean ideal-vs-actual view, capacity planning inputs, and per-task status tracking — all without requiring a server or account.

## 2. Problem Statement

Existing sprint tracking tools (Jira, Azure DevOps, Linear) bundle burndown charts deep inside large, complex platforms. Teams that want a simple, focused burndown view — especially small teams, freelancers, or teams using lightweight project management — lack a dedicated, easy-to-use option.

Key pain points:
- Burndown charts in large tools are hard to configure and often don't reflect real capacity (PTO, efficiency).
- No standalone tool provides quick "open and track" burndown without account setup.
- Teams lose data when switching between tools or browsers because there's no simple export.

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

## 4. Current Features (MVP — v0.1)

| Feature | Description | Status |
|---|---|---|
| Multiple sprints | Create, switch between, and delete sprints | Done |
| Sprint setup | Name, start/end dates, developer count, efficiency factor | Done |
| Weekend skipping | Working-day calculation auto-excludes Sat/Sun | Done |
| Task management | Add/remove tasks with name, days, status, done date | Done |
| Burndown chart | SVG ideal vs actual line chart with animation | Done |
| Stats dashboard | Total days, remaining, working days, done tasks, man-days, effective man-days, ideal burn rate | Done |
| Available Days indicator | `working days - total points`, color-coded green/red | Done |
| Input commit on blur/Enter | No mid-typing recalculations | Done |
| localStorage persistence | All data stored in browser localStorage | Done |
| Responsive layout | Adapts to screens down to 900px | Done |

## 5. Planned Features

### 5.1 Phase 1 — Data Safety & Accuracy

| ID | Feature | Priority | Description |
|---|---|---|---|
| F-101 | JSON export/import | P0 | Export full app state as JSON file; import to restore. Protects against data loss. |
| F-102 | Holiday / PTO exclusions | P0 | Mark specific dates as non-working. These dates are excluded from working-day calculations and the ideal burn line. |
| F-103 | CSV export | P1 | Export the task list of the active sprint as a CSV file for stakeholder reporting. |

### 5.2 Phase 2 — Daily Usability

| ID | Feature | Priority | Description |
|---|---|---|---|
| F-201 | Task drag-and-drop reordering | P1 | Reorder tasks by dragging rows. Persisted order is used in the table. |
| F-202 | Sprint progress percentage | P1 | Show "X% complete" in the stats card based on done points vs total points. |
| F-203 | Sprint cloning / templates | P2 | Clone an existing sprint's task structure (names + points) into a new sprint with all statuses reset to Todo. |
| F-204 | Scope change tracking | P2 | Record when tasks are added/removed mid-sprint. Optionally display a "scope line" on the burndown chart. |

### 5.3 Phase 3 — Insights & History

| ID | Feature | Priority | Description |
|---|---|---|---|
| F-301 | Sprint velocity chart | P1 | After 2+ completed sprints, show a bar chart of points completed per sprint over time. |
| F-302 | Sprint archive / completion | P2 | Mark a sprint as "completed." Completed sprints are visually distinct and read-only. |
| F-303 | Burndown chart tooltips | P2 | Hover over a data point on the chart to see the date, ideal value, and actual value. |

### 5.4 Phase 4 — Multi-user & Integrations (deferred)

| ID | Feature | Priority | Description |
|---|---|---|---|
| F-401 | Backend storage | P1 | Move from localStorage to a server-side store (or file-based sync) for durability and sharing. |
| F-402 | User authentication | P2 | Simple auth (email/password or OAuth) to support per-user data. |
| F-403 | Multi-team support | P2 | Organize sprints by team. Each team sees only its own sprints. |
| F-404 | Issue tracker integration | P3 | Pull tasks from Jira, Linear, or GitHub Issues. |

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

- [ ] Should "days" (points) support fractional values (e.g., 0.5)? Currently supported in the input (`step="0.5"`) but not explicitly documented.
- [ ] Should there be a distinction between "story points" and "person-days"? Currently they are treated as equivalent.
- [ ] What is the maximum number of sprints/tasks we should support before recommending a backend?
- [ ] Should completed sprints be archivable or deletable only?

## 9. Revision History

| Date | Version | Changes |
|---|---|---|
| 2026-02-20 | 0.1 | Initial draft based on MVP codebase analysis |
