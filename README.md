# Burndown Studio

Multi-user web app for sprint burndown tracking with task-level daily updates. State is shared in real time via Firebase Firestore, with localStorage as a fallback cache. Supports Google Sign-In and a dev-only fake email login.

## Run

```bash
npm run dev        # start static server on http://localhost:5173
```

Then visit `http://localhost:5173`.

## Development

Source code lives in `src/` as TypeScript modules. After editing any file in `src/`, rebuild the bundle:

```bash
npm install        # first time only (esbuild, typescript, tsx, firebase)
npm run build      # bundles src/main.ts → app.js
npm run typecheck  # run tsc --noEmit (zero errors expected)
npm run test       # run unit tests via tsx
npm run dev        # start static server on http://localhost:5173
```

### Firebase Setup (required for multi-user mode)

1. Create a project at [console.firebase.google.com](https://console.firebase.google.com)
2. Enable **Authentication** → Sign-in method → **Google** and **Email/Password**
3. Create a **Firestore Database** (production mode)
4. Copy the SDK config object into `src/firebase.ts`
5. Deploy Firestore security rules:

```bash
npm install -g firebase-tools
firebase login
firebase init firestore   # select project, accept firestore.rules
firebase deploy --only firestore:rules
```

### Dev mode (localhost only)

When running on `localhost`, a fake email login form appears below the Google button. Enter any email (e.g. `test@dev.com`) — the account is created automatically with a fixed dev password. Use different browsers or Chrome profiles to simulate multiple users.

### Legacy mode (no Firebase)

If `src/firebase.ts` still contains the placeholder `"YOUR_API_KEY"`, the app runs in single-user localStorage-only mode — identical to the previous behaviour.

## User Roles

| Role | Capabilities |
|---|---|
| `super_manager` | Full access; admin screen; manage all teams; delete/promote users |
| `product_manager` | Create teams; manage members of owned teams; delete owned teams |
| `member` | Access assigned teams; read/write sprint data |

All new users self-register as `member`. To bootstrap the first `super_manager`, register an account normally, then open the **Firebase Console → Firestore → users/{uid}** and manually set `role` to `"super_manager"`. After that the Admin screen can promote other users.

## Current Features

### Multi-user & Authentication

- Google Sign-In (production) and fake email login (localhost only)
- Team selection screen after login — users see only their assigned teams
- Real-time Firestore sync: all team members see changes instantly
- **"← Teams" button** in the app header to switch between teams without signing out
- **Admin screen** (Super Manager only): view all users (sortable by Email/Name), change roles, delete user profiles; always shows custom confirm dialog before deletion; blocked if user owns teams or is assigned to tasks across any team
- **Team management** (PM/SM): create teams, add/remove members from a user list, delete teams; member removal blocked if member has task assignments in this team or owns any teams; member count badge refreshes immediately after Manage closes
- `projectToday` is per-session — not shared across users; remote updates do not reset it

### Project TODAY

The **project TODAY** field (leftmost in the sprint toolbar) is the authoritative date for the entire project. It always resets to the real system date on every page load and can be changed manually during the session.

- **Current sprint** = the sprint whose date range contains project TODAY (`startDate ≤ projectToday ≤ endDate`)
- In the **current sprint**, clicking any x-axis date label on the burndown chart **updates project TODAY** and all sprint browse dates
- In **past/future sprints**, clicking a date label **toggles a gray browse line** — click the same date again to clear it; no effect on project TODAY
- All data recording (Worked/Remain logs) always uses project TODAY as the log date, regardless of the browse date

### Sprint Management

- Multiple sprints, auto-sorted by start date
- Sprint setup: description, start/end dates (weekends/holidays excluded), developers, efficiency
- **New sprint defaults**: developer count inherited from the previous sprint; first sprint defaults to team member count
- Date pickers enforce non-overlapping ranges; gap warning shown if working days exist between sprints
- **Edit Sprint** button: disabled for past sprints; opens planning modal for future sprints
- **Planning mode** (future sprints): "Edit Sprint" becomes "Add/Remove Tasks" — closes to lock `plannedPoints`

### Task Tracking

- Tasks sourced from the Product Backlog (Story → Task hierarchy)
- **Estimate** (from backlog, read-only) vs **Worked + Remain** (updated via Update/Save in the current sprint only)
- **Update** button visible only in the current sprint for tasks that exist as of project TODAY (i.e. `addedDate ≤ projectToday`)
- Clicking Update reveals editable Worked and Remain fields; clicking Save commits both as a log entry at project TODAY
- **Status**: auto-determined — Todo (worked=0), In Progress (worked>0, remain>0), Done (remain=0)
- **Done Date**: auto-set when Remain first reaches 0
- **Remove** button shown only for tasks with no work logged, in the current sprint
- Adding and then removing the same task (or vice versa) within the same sprint cancels out — no scope history is recorded
- Tasks added in the current sprint that are browsed before their `addedDate` are shown greyed out
- Drag-and-drop task reordering (drag handle; disabled when column sort is active)
- Sort by any column; Actual/Est sorts by Worked + Remain

### Unassigned Backlog Panel

- Collapsible panel below the task table listing all unassigned backlog tasks
- Add tasks to the sprint by clicking **+** or dragging a row onto the task table (current sprint only)
- Add task by Task ID via the input at the top-right of the Tasks card (current sprint only)

### Burndown Chart

- **N+1 border model** — N working days form N bands with N+1 plot borders; the ideal line runs exactly from `plannedPoints` at border 0 to 0 at border N; actual/scope values are plotted at the right border of each completed day
- **Ideal line** (blue) — based on `plannedPoints` locked when the planning modal is closed; never changes mid-sprint regardless of task additions or removals; reaches exactly 0 at the last border
- **Actual line** (red) — remaining work per working day up to project TODAY, reconstructed from per-task `remainLog`; starts at `initialScope` (tasks active at sprint start + scope-drop contributions)
- **Scope line** (green dashed) — Worked + Remain per working day up to project TODAY; reflects mid-sprint scope changes
- **Scope drop markers** (amber triangle) — annotate dates when planned tasks were removed from scope
- **Today band** (indigo shaded rectangle) — drawn only in the current sprint; spans the full width of today's day band
- **Browse marker** (gray vertical line at right border) — shown in past/future sprints when a date is clicked; same date click removes it
- Show day numbers toggle (D1/D2/… vs mm/dd labels on x-axis); unchecked by default

### Last-Day Task Handoff (Move / Split)

When project TODAY is the last working day of the current sprint, undone tasks show action buttons:

- **Move** (Todo tasks) — removes the task from the current sprint (records a ScopeDrop if it was a planned task) and adds it to a selected future sprint as a planned task
- **Split** (In Progress tasks) — marks the current task as Done (remain = 0, suffix `a`), and creates a new task (suffix `b`, estimate = current remain) in a selected future sprint
- The sprint selector in both dialogs shows each sprint's Total Points and Available Days, and excludes past sprints

### Stats & Capacity

- Duration, working days, total points, remaining, done tasks, progress %
- **Available Days**: `effectiveManDays − totalPoints` (green if within ±1.5 days, red if over by >1.5)
- **Efficiency**: actual (pointsBurned / (developers × daysElapsed)) vs ideal
- Man-days chip in New/Edit Sprint dialog updates live as dates, developers, and efficiency change

### Sprint Reset

Resets all progress (Worked, Remain, status, doneDate, workedLog, remainLog) back to initial state while **keeping all tasks**. Clears scope drop history. Browse date returns to project TODAY.

### User Profiles & Members

- **Profile registration**: on first login, if no profile exists a "register as new user?" prompt appears; confirming opens the registration modal for display name (required) and phone number (optional); email shown as read-only
- **Edit profile**: click the user name in the app header to reopen the profile modal at any time
- **Member list in Preferences**: read-only; auto-synced from Firebase team membership; click any member row to see their full profile (name, email, phone, role, avatar)

### Private Memo

- **My Notes** section in Preferences: per-user, per-team text area with basic Markdown formatting (bold, italic, headings, lists)
- Auto-saves 800 ms after typing stops; flushed on preferences close
- Stored at `users/{uid}.memos.{teamId}` — private, never shared with other team members

### Preferences

- **Holidays**: date + optional name; excluded from working-day counts and date pickers; already-added dates (and weekends) are greyed out in the picker
- **Work weekends**: specific weekend dates that count as working days; already-added dates are greyed out in the picker
- **Team members**: read-only list auto-synced from Firebase; used to populate the assignee selector in the backlog and as the default developer count for the first sprint

### Data & Export

- JSON export/import (full state backup/restore with confirmation dialog)
- Sprint task export to Excel (.xlsx)
- Backlog Excel import/export; backlog re-import re-links sprint tasks by Task ID
- Graceful recovery from corrupt localStorage data

## Project Structure

```
bdc/
├── index.html          # UI structure and templates
├── app.js              # Bundled output (built from src/, committed to git)
├── styles.css          # Layout, theming, animations
├── firestore.rules     # Firestore security rules (deploy via Firebase CLI)
├── src/
│   ├── main.ts         # Entry point — event wiring, modal logic, auth gate
│   ├── dom.ts          # DOM element references
│   ├── state.ts        # State management — load, save, CRUD, Firestore sync
│   ├── types.ts        # Shared TypeScript interfaces (incl. UserProfile, Team)
│   ├── firebase.ts     # Firebase app init (auth, db)
│   ├── auth.ts         # Sign-in (Google + fake email), sign-out, ensureUserProfile
│   ├── db.ts           # Firestore CRUD: users, teams, appdata
│   ├── screens.ts      # Login, team selection, admin screen overlays
│   ├── burndown.ts     # Pure burndown calculation functions
│   ├── chart.ts        # SVG chart rendering
│   ├── render.ts       # DOM rendering (sprint list, tasks, backlog, stats, chart)
│   ├── io.ts           # JSON/Excel export and import
│   ├── utils.ts        # Shared helpers (dates, IDs, formatting)
│   └── globals.d.ts    # Ambient declarations for CDN globals (flatpickr, XLSX)
├── test/
│   └── calculations.test.ts  # Unit tests (Node built-in test runner via tsx)
├── docs/
│   ├── PRD.md                # Product requirements
│   ├── TECHNICAL_DESIGN.md   # Architecture, data model, algorithms
│   └── ROADMAP.md            # Phased delivery plan
├── tsconfig.json       # TypeScript compiler configuration
├── package.json        # Build scripts and dependencies
└── .gitignore
```

## Firestore Collections

```
/users/{userId}        — email, displayName, phoneNumber?, role, createdAt, memos: { [teamId]: string }
/teams/{teamId}        — name, ownerId, memberIds[], createdAt
/appdata/{teamId}      — full AppState (sprints, backlog, preferences, …)
```

`memos` is a private per-user map keyed by `teamId`. Memos are deleted automatically when a team is deleted.

## Data Model (AppState)

```json
{
  "activeSprintId": "uuid",
  "projectToday": "YYYY-MM-DD",
  "backlog": {
    "stories": [
      {
        "id": "uuid",
        "storyId": "0.1",
        "description": "...",
        "priority": 100,
        "tasks": [
          {
            "id": "uuid",
            "taskId": "0.1.1",
            "description": "...",
            "estimate": 3,
            "assignedTo": ["Alice", "Bob"]
          }
        ]
      }
    ]
  },
  "preferences": {
    "holidays": [{ "date": "YYYY-MM-DD", "name": "..." }],
    "workWeekends": ["YYYY-MM-DD"],
    "members": ["Alice", "Bob"]
  },
  "sprints": [
    {
      "id": "uuid",
      "description": "Sprint 1",
      "startDate": "YYYY-MM-DD",
      "endDate": "YYYY-MM-DD",
      "today": "YYYY-MM-DD",
      "developers": 4,
      "efficiency": 0.8,
      "plannedPoints": 30,
      "createdAt": "ISO timestamp",
      "tasks": [
        {
          "id": "uuid",
          "backlogTaskId": "uuid",
          "taskId": "0.1.1",
          "name": "...",
          "assignedTo": "Alice, Bob",
          "estimate": 3,
          "worked": 1,
          "remain": 2,
          "status": "Todo | In Progress | Done",
          "doneDate": "YYYY-MM-DD",
          "addedDate": "YYYY-MM-DD",
          "workedLog": [{ "date": "YYYY-MM-DD", "worked": 1 }],
          "remainLog": [{ "date": "YYYY-MM-DD", "remain": 2 }]
        }
      ],
      "scopeDrops": [
        {
          "addedDate": "YYYY-MM-DD",
          "removedDate": "YYYY-MM-DD",
          "estimate": 3,
          "taskId": "0.1.1",
          "name": "..."
        }
      ]
    }
  ]
}
```

## Documentation

See `docs/` for detailed project documents:
- [PRD](docs/PRD.md) — Product requirements, personas, feature inventory
- [Technical Design](docs/TECHNICAL_DESIGN.md) — Architecture, data model, algorithms, module graph
- [Roadmap](docs/ROADMAP.md) — Phased delivery plan with status tracking

## Change Log

| Date | Changes |
|---|---|
| 2026-02-19 | MVP baseline |
| 2026-02-19 | Sprint delete + layout/input polish |
| 2026-02-19 | Capacity inputs + Available Days |
| 2026-02-20 | JSON export/import, show day numbers toggle, localStorage error handling |
| 2026-02-20 | Refactored into ES modules under `src/`; esbuild bundling |
| 2026-02-20 | Project docs: PRD, Technical Design, Roadmap |
| 2026-02-23 | Sprint Excel export; Product Backlog (Story→Task hierarchy, Excel import/export) |
| 2026-02-24 | Backlog re-links sprint tasks on re-import; custom confirm dialogs |
| 2026-02-26 | Holiday/PTO exclusions + work weekends in preferences |
| 2026-02-27 | Drag-and-drop task reorder; progress %; scope line; 59 unit tests |
| 2026-03-03 | TypeScript migration; Update/Save UX; auto-status; daily workedLog/remainLog; scope line; clickable chart dates |
| 2026-03-04 | Sprint planning modal; project TODAY field; current-sprint controls; ideal line locked to plannedPoints; custom delete/reset dialogs; man-days chip |
| 2026-03-04 | Burndown fixes: remove extra day; chart Today marker and actual line use project TODAY |
| 2026-03-05 | Browse date toggle on past/future sprint charts; sprint reset keeps all tasks; add/remove same task cancels scope history |
| 2026-03-05 | Multi-user: Firebase Auth (Google + dev fake email), Firestore real-time sync, team management, role-based access (super_manager / product_manager / member), admin screen, Switch Team button, Firestore security rules |
| 2026-03-06 | User profiles (name + phone, first-time registration modal, edit via header button); member profile popup in Preferences; private per-user memo (Markdown, auto-save); holiday/work-weekend pickers disable already-added dates; backlog assignedTo changed to multi-select string[] with popup picker; team delete cleans up member memos in Firestore; sign-in button redesigned (quiet ghost style) |
| 2026-03-07 | Burndown N+1 border model: Today shown as shaded band, ideal reaches exactly 0, actual/scope plotted at right border of each day; Move/Split for undone tasks on last sprint day; sprint selector shows Total Points and Available Days, excludes past sprints; login shows "register?" prompt for unknown users; projectToday skips holidays/weekends on page load; Admin table sortable by Email/Name; developer count capped at team member count; member removal blocked if assigned to tasks or if user owns teams; SM always gets custom confirm dialog in Admin |
| 2026-03-09 | Documentation corrections: super_manager bootstrap clarified (all self-registrations are member; set role manually in Firebase Console); CLAUDE.md module table updated to include firebase.ts, auth.ts, db.ts, screens.ts |
