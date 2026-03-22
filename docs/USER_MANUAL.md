# Burndown Studio — User Manual

## Table of Contents

1. [Overview](#overview)
2. [Roles & Organization](#roles--organization)
3. [Signing In](#signing-in)
4. [Team Selection Screen](#team-selection-screen)
5. [Sprint View](#sprint-view)
   - [Sprint Sidebar](#sprint-sidebar)
   - [Header & Toolbar](#header--toolbar)
   - [Statistics Card](#statistics-card)
   - [Burndown Chart](#burndown-chart)
   - [Task Table](#task-table)
   - [Backlog Panel](#backlog-panel)
   - [Preferences](#preferences)
6. [Backlog Tab](#backlog-tab)
7. [Group & Team Management (PM)](#group--team-management-pm)
8. [Admin Screen (SM)](#admin-screen-sm)
9. [Common Workflows](#common-workflows)
10. [Data & Sync](#data--sync)

---

## Overview

Burndown Studio is a web-based sprint burndown tracker for agile teams. It supports multi-team, multi-group organizations with role-based access, real-time chart visualization, backlog management, and Firebase-backed cloud sync.

---

## Roles & Organization

| Role | Description |
|---|---|
| **Member** | Team contributor. Updates tasks, views sprints, logs work. |
| **Product Manager (PM)** | Owns a group. Creates and manages teams, invites members, creates sprints. |
| **Super Manager (SM)** | System admin. Full control over all users, groups, PM requests. |

**Organizational hierarchy:**

```
Group (owned by PM)
└── Team (multiple per group)
    └── Sprint (multiple per team)
        └── Tasks (linked from Backlog)
```

---

## Signing In

### Email / Password
Enter your email and password, then click **Sign In** or press Enter.

### Google Sign-In
Click **Sign in with Google** to open the Google account picker. Any existing account matching your email is linked automatically.

### Requesting a PM Account
If you need to create and manage your own group:

1. Click **Request PM Account** on the landing page.
2. Fill in your name, email, desired group name, and optional organization/description.
3. Submit — a Super Manager reviews and approves or rejects your request.
4. On approval, you receive a registration link by email to complete your account setup.

> **Note:** The SM can disable PM account requests from the Admin screen if needed.

---

## Team Selection Screen

After signing in, you land on the Team Selection screen.

- **Team cards** show the team name and member avatars. Click any card to enter that team's sprint view.
- **PM only**: A **New Team** card lets you create additional teams. A **Manage** button on each card opens the member management modal.
- **Team owner**: A **Delete** button appears on teams you own.
- **PM only**: Drag team cards to reorder them.
- Click any **member avatar** to view their full profile photo.
- Your name/avatar in the header opens the **Profile Edit** modal.

---

## Sprint View

The main workspace. All sprint tracking, task management, and chart visualization happen here.

### Sprint Sidebar

The left panel lists all sprints in order. Click any sprint to select it as the active sprint.

### Header & Toolbar

**Project TODAY picker**
The most important control. It sets the authoritative recording date for all task updates — think of it as "what day is it in the project."

- Click the TODAY date to open the picker. Only working days are selectable.
- Resets to the real system date every time the page loads.
- Any task update (worked/remain) is timestamped with this date.

**Sprint actions (top-right buttons):**

| Button | Action |
|---|---|
| Add Sprint | Creates a new sprint (14-day default, 4 developers, 0.8 efficiency). Opens planning modal immediately. |
| Edit Sprint | Opens the sprint editor (dates, developers, efficiency, description). |
| Reset Sprint | Clears all progress and task logs; keeps tasks; resets browse date. |
| Delete Sprint | Permanently deletes the active sprint and all its data. |
| Import | Upload a previously exported JSON file to restore or merge sprint data. |
| Export | Download all sprints + backlog + preferences as a JSON backup. |

### Statistics Card

Displayed below the header, above the chart. Updates in real-time.

| Field | Meaning |
|---|---|
| Duration | Sprint start – end dates and day count |
| Working Days | Weekdays minus configured holidays |
| Total Points | Sum of all sprint task estimates |
| Remaining | Sum of current `remain` values |
| Done Tasks | Count of tasks with status "Done" |
| Available Days | `developers × working days × efficiency` (your capacity) |
| Progress | `(Total Points − Remaining) / Total Points` with progress bar |

### Burndown Chart

An SVG chart with three lines:

| Line | Color | Meaning |
|---|---|---|
| Ideal | Blue dashed | Linear burn from Total Points → 0 over working days |
| Actual | Red solid | Real remaining points based on daily task logs |
| Scope | Gray | Planned total over time (shifts when tasks are added/removed mid-sprint) |

**Interactions:**

- **Click a date label** on the X-axis to set the **browse date** — the task table snaps to that day's historical state. Click the same date again to clear and return to today.
- **Show day numbers** checkbox: Adds day-of-sprint counter (1, 2, 3…) under the date labels.

**Scope drops** appear as labeled markers when a planned task was removed. If you re-add the same task, the scope drop is cancelled.

### Task Table

Lists all tasks currently in the active sprint.

**Columns:**

| Column | Description |
|---|---|
| ID | Task identifier (e.g. `0.1.2`) |
| Task | Task name. Hover to see the linked backlog story. |
| Actual/Est | `worked + remain / estimate` |
| Worked | Hours/days worked — editable in update mode |
| Remain | Hours/days remaining — editable in update mode |
| Status | Auto-set: Todo / In Progress / Done |
| Done Date | Set automatically when remain reaches 0 |
| Actions | Update, Remove, Move, Split (visibility depends on context) |

**Recording progress:**

1. Click **Update** on a task row.
2. If the task has no assignee, a prompt asks you to select one from the team.
3. Enter the **Worked** and **Remain** values.
4. Press Enter or click **Save**.

Status updates automatically:
- `remain = 0` → **Done** (done date recorded)
- `worked > 0, remain > 0` → **In Progress**
- `worked = 0` → **Todo**

**Removing a task:**
- Visible on **Todo** tasks in the active sprint (not on the last day).
- Returns the task to the backlog. Creates a **Scope Drop** record if the task was originally planned.

**Last-day actions** (available only on the sprint end date):

| Button | Action |
|---|---|
| Move | Move task to a different sprint (creates scope drop in current sprint) |
| Split | Mark current task Done; copy remaining work as a new task in another sprint |

**Sorting & reordering:**
- Click any column header to sort ascending/descending.
- While not sorted, drag the ⠿ handle to reorder rows manually.

**Historical browsing:**
When a browse date is set (via chart click), the task table shows task state as of that date. Rows that didn't exist yet are dimmed.

### Backlog Panel

A collapsible panel below the task table showing backlog tasks not yet in this sprint.

- **Drag a row** from the panel into the task table to add it to the sprint.
- **Add by ID**: Type a task ID (e.g. `0.1.1`) in the input and click **Add** or press Enter.

### Preferences

Click the **⚙** (Settings) button to open the Preferences modal.

**Custom Holidays**
Add specific dates to exclude from working-day calculations (e.g. company holidays). Enter the date and a label, then click Add.

**Weekend Workdays**
Designate specific Saturdays or Sundays as working days for sprints that cross them.

**Members**
Read-only list of team members. Click any member to view their profile.

**My Notes (Private)**
A personal, markdown-enabled memo visible only to you. Supports `**bold**`, `*italic*`, `` `code` ``, `# Heading`, and `- list` syntax. Auto-saves after 800 ms of inactivity.

---

## Backlog Tab

The Backlog is a master task repository organized as **Stories → Tasks**.

### Structure

- **Story**: A user story with an ID (e.g. `0.1`), description, and priority.
- **Task**: A sub-item under a story with ID `StoryId.N` (e.g. `0.1.2`), description, estimate (days), and assigned-to list.

### Story Operations

| Action | How |
|---|---|
| Add Story | Click **Add Story** |
| Edit Story | Click **Edit** on the story row |
| Delete Story | Click **Delete** while in edit mode (deletes all child tasks too) |
| Expand/Collapse | Click the ▼/▶ toggle on the story row |
| Expand All / Collapse All | Buttons above the table |

### Task Operations

| Action | How |
|---|---|
| Add Task | Click **Add Task** on a story (in edit mode) |
| Edit Task | Click **Edit** on the task row |
| Delete Task | Click **Delete** while in edit mode |
| Assign Members | Click the Assigned To field → checkboxes for team members |

### Import / Export

- **Import from Excel**: Upload an `.xlsx`/`.xls` file with columns: Story ID, User Stories, Priority, Task ID, Description, Est. Days, Assigned To.
- **Export to Excel**: Downloads the current backlog as a formatted `.xlsx` file.
- **Clear All**: Deletes the entire backlog (with confirmation prompt).

---

## Group & Team Management (PM)

### Creating Your Group (First Login)

When a newly approved PM logs in for the first time, they are prompted to create their group. Any teams already owned by the PM are automatically linked to the new group.

### Group Screen

Accessed after creating or having an existing group. Contains two sections:

**Teams**
- Drag cards to reorder.
- **Manage Members** button opens the member management modal for that team.
- **Delete** button removes the team (owner only).
- **New Team** card creates an additional team.

**Members**
Lists all members in the group with name, email, role, and phone.

### Manage Members Modal

**Current Members (left panel)**
- Shows existing team members.
- **Remove** button — blocked if the member has open task assignments (shows which tasks).

**Add Members & Invitations (right panel)**

| Method | Use case |
|---|---|
| Add from group | Member already in the group — click **Add** to include in this team. |
| Invite by email | Enter one or more emails; sends invitation links. Recipients click the link to register and join. |
| Pre-register | For Google account holders who haven't signed up yet. They auto-join the team on first Google sign-in. |

Pending invitations and pre-registrations are listed with a **Cancel** button to revoke them.

### Profile Edit

Access by clicking your name or avatar. You can update:
- **Display Name** and **Phone**
- **Avatar photo** — crop and upload any image (max 5 MB); or remove to use initials
- **Password** (non-Google accounts only) — requires current password to change

---

## Admin Screen (SM)

Accessible only to Super Managers.

### Users Tab

| Column | Description |
|---|---|
| Email | User's email |
| Name | Display name |
| Role | Dropdown — change to Member / PM / SM |
| Group | Dropdown — assign user to a group |
| Delete | Remove user (disabled for SMs) |

Click column headers to sort.

### Groups Tab

Read-only table showing all groups: name, owner, member count, team count.

### PM Requests Tab

- **Disable PM Requests** toggle — hides the "Request PM Account" button on the landing page when checked.
- **Requests table**: Shows all PM account requests with status (Pending / Approved / Rejected).
  - **Approve** — creates the PM Firebase account and sends a registration email with a sign-in link.
  - **Reject** — marks the request rejected.
  - **Delete** — removes the request record entirely.

---

## Common Workflows

### Planning a New Sprint

1. Click **Add Sprint** → set dates, developers, efficiency → **Save & Add Tasks**.
2. In the Sprint Planning modal, drag backlog tasks into the sprint.
3. Click **Done** — planned points are locked for the ideal burndown line.

### Recording Daily Progress

1. On each working day, project TODAY automatically resets to the system date.
2. Each team member clicks **Update** on their tasks, enters worked and remain values, and saves.
3. The burndown chart updates in real-time.

### Handling Mid-Sprint Scope Changes

| Situation | Action |
|---|---|
| Add a task mid-sprint | Drag from backlog panel or add by ID; `addedDate` is set to today |
| Remove a Todo task | Click Remove; creates a scope drop on the chart |
| Defer a task (last day) | Click Move → select target sprint |
| Split a task (last day) | Click Split → current task → Done; remaining work copied to next sprint |

### Reviewing Historical Progress

1. Click any date label on the burndown chart to set the browse date.
2. The task table shows state as of that date.
3. Click the same date again to return to today.

### Inviting New Team Members (PM)

1. Team Selection → **Manage** on the target team.
2. Right panel → **Invite by email** → enter email(s) → **Send Invites**.
3. Recipients receive an email link and complete registration.
4. Alternatively, use **Pre-register** for users with Google accounts — they auto-join on first sign-in.

### Approving a PM Request (SM)

1. Sign in as Super Manager.
2. Admin screen → **PM Requests** tab.
3. Click **Approve** on a pending request — the user receives a registration link by email.

---

## Data & Sync

### Local Storage
All app state is stored under the `burndown-studio` key in `localStorage`. Works offline and persists across page refreshes.

### Firebase Cloud Sync
When Firebase is configured, state is additionally synced to Firestore in real-time. Multiple users on the same team see live updates. Saves are debounced (500 ms) to batch rapid edits. A 5-second echo-suppression window prevents a device from reloading its own just-saved data.

### Import / Export (JSON)

- **Export**: Downloads all sprints, backlog, and preferences as a JSON file — useful as a full backup.
- **Import**: Upload a previously exported file. Choose to **merge** (add to existing data) or **replace all**. Orphaned sprint tasks (tasks no longer in the backlog) are flagged before import completes.
