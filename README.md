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

6. (Optional) Deploy Firebase Cloud Functions for invitation email delivery:

```bash
firebase init functions   # TypeScript, select project
firebase deploy --only functions
```

### GitHub Actions (CI/CD)

Two workflows are included in `.github/workflows/`:

- **`ci.yml`** — runs on every push to any branch: installs deps, typechecks, runs tests
- **`deploy.yml`** — runs on push to `main`: typechecks, builds, and deploys to Firebase Hosting

To enable auto-deploy:
1. Generate a Firebase CI token: `npx firebase-tools login:ci`
2. Add the token to your GitHub repo: **Settings → Secrets → Actions → New repository secret**, name `FIREBASE_TOKEN`

### Dev mode (localhost only)

When running on `localhost`, a fake email login form appears below the Google button. Enter any email (e.g. `test@dev.com`) — the account is created automatically with a fixed dev password. Use different browsers or Chrome profiles to simulate multiple users.

### Legacy mode (no Firebase)

If `src/firebase.ts` still contains the placeholder `"YOUR_API_KEY"`, the app runs in single-user localStorage-only mode — identical to the previous behaviour.

## User Roles

| Role | Capabilities |
|---|---|
| `super_manager` | Admin-only access: view all users, change roles, assign groups, delete profiles; no team management |
| `product_manager` | Owns one Group (tenant); creates/manages Teams and Members within the Group |
| `member` | Access assigned teams; read/write sprint data |

All new users self-register as `member`. To bootstrap the first `super_manager`, register an account normally, then open the **Firebase Console → Firestore → users/{uid}** and manually set `role` to `"super_manager"`. After that the Admin screen can promote other users.

## Onboarding Flows

### PM Onboarding
1. SM creates a PM request form link (Admin screen) or SM promotes an existing user to `product_manager`
2. New PM submits a PM request (name, email, group name) from the landing page
3. SM approves the request in the Admin screen → Firestore creates a Group and PM profile
4. PM receives an email invitation (or is directed to register) and signs in

### Member Invitation
1. PM invites a member by email from the Manage Members modal
2. An invitation document is created in `/invitations/{inviteId}` with the invitee's email
3. Invitee opens the invitation link and lands on a dedicated **Invitation Registration page**
4. Registration page offers: **Create Account** (email + password) or **Continue with Google** (all domains, including Google Workspace)
5. On successful registration, invitee is automatically added to the team
6. If a different user is signed in when the invite link is opened, they are signed out first; the invitation page is shown again for the correct email

## Current Features

### Groups (Tenants)

- A **Group** is the top-level tenant unit, owned and managed by one PM
- PM's main screen is the Group screen (Teams | Members sidebar)
- PM creates/deletes/manages Teams within the Group; assigns Group Members to Teams
- Group Members are users with `groupId` matching the Group; managed from the Members tab
- SM can view all Groups in the Admin → Groups section (read-only)

### Multi-user & Authentication

- Google Sign-In (production) and fake email login (localhost only)
- **SM** routes directly to the Admin screen on login (no team access)
- **PM** routes to the Group screen on login; redirected to Group creation if no Group exists yet
- **Member** routes to the Team selection screen
- Real-time Firestore sync: all team members see changes instantly
- **"← Teams" button** in the app header to switch between teams without signing out
- **Admin screen** (Super Manager only): view all users (sortable by Email/Name), change roles, assign Groups, delete profiles; deletion blocked if user owns teams or is assigned to tasks; always shows custom confirm dialog
- **Group screen** (PM only): create/delete Teams, manage Group Members per Team, remove Members from Group
- **Team management** (PM): add/remove members from a Team; "Add Group Members" section lets PM add already-accepted group members to a team; member removal shows a warning dialog listing assigned tasks before confirming
- **PM Edit**: "Edit" button on the Group screen opens a modal to change the Group name and PM display name
- **Invitation registration**: dedicated page for invited users; supports password creation and Google Sign-In (all domains incl. Google Workspace); no "existing sign-in" option since this is a first registration
- **Landing page**: unknown sign-in attempts show an error and sign out rather than showing a "create account" prompt; `loginError` is passed via sessionStorage
- `projectToday` is per-session — not shared across users; remote updates do not reset it

### Project TODAY

The **project TODAY** field (leftmost in the sprint toolbar) is the authoritative date for the entire project. On every page load it resets to the **most recent working day** (today if today is a workday, otherwise the last non-weekend/non-holiday day before today). It can be changed manually during the session but is capped at the real system date — future dates are not selectable.

- **Current sprint** = the sprint whose date range contains project TODAY (`startDate ≤ projectToday ≤ endDate`)
- In the **current sprint**, clicking any x-axis date label on the burndown chart **updates project TODAY** and all sprint browse dates
- In **past/future sprints**, clicking a date label **toggles a gray browse line** — click the same date again to clear it; no effect on project TODAY
- All data recording (Worked/Remain logs) always uses project TODAY as the log date, regardless of the browse date

### Sprint Management

- Multiple sprints, auto-sorted by start date
- Sprint setup: description, start/end dates (weekends/holidays excluded), developers, efficiency
- **New sprint defaults**: developer count = number of team members with role `member` (PM is excluded from the count); falls back to 1 if no members exist yet
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
- **Profile photo**: upload a photo from the edit profile modal; resized client-side to 640px (full) and 80px (thumb) via canvas and stored as base64 in the Firestore user document; click the photo to view full size; remove button clears it
- **Avatar fallback**: if no photo is uploaded, a colored circle with the user's initial letter is generated via canvas and cached in memory
- **Change password**: available in the edit profile modal for email/password accounts (hidden for Google sign-in users); requires re-authentication with current password before updating
- **Avatar display**: shown in the app header (24px), team card member strip (28px), PM sidebar footer (36px), member profile popup (48px), and profile modal (80px)
- **Team card member strip**: each team card shows up to 5 member avatars with an overflow count badge
- **Member list in Preferences**: read-only; auto-synced from Firebase team membership; click any member row to see their full profile (name, email, phone, role, avatar); click the avatar in the popup to view full-size photo

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
├── .github/
│   └── workflows/
│       ├── ci.yml      # CI: typecheck + test on every push
│       └── deploy.yml  # Auto-deploy to Firebase Hosting on push to main
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
/users/{userId}           — email, displayName, phoneNumber?, role, groupId?, createdAt, photoThumb?, photoFull?, memos: { [teamId]: string }
/teams/{teamId}           — name, ownerId, memberIds[], groupId, createdAt
/groups/{groupId}         — name, ownerId, createdAt
/appdata/{teamId}         — full AppState (sprints, backlog, preferences, …)
/invitations/{inviteId}   — email, groupId, teamId, status ("pending"|"accepted"), createdAt
```

`memos` is a private per-user map keyed by `teamId`. Memos are deleted automatically when a team is deleted. `groupId` on users and teams links them to the PM's Group (tenant). Invitations are readable without authentication so the registration page can display the correct invite details before sign-in.

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
            "assignedTo": ["alice@example.com", "bob@example.com"]
          }
        ]
      }
    ]
  },
  "preferences": {
    "holidays": [{ "date": "YYYY-MM-DD", "name": "..." }],
    "workWeekends": ["YYYY-MM-DD"],
    "members": ["Alice", "Bob"]   // display names, auto-synced from Firebase Auth
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
          "assignedTo": "alice@example.com, bob@example.com",  // emails; resolved to names at render time
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
| 2026-03-10 | SaaS Step 1 — Group (tenant) model: PM owns one Group; Group screen (Teams + Members tabs); SM routes to Admin-only; SM Admin Users table adds Group assignment column; Firestore security rules for /groups; lazy migration links existing teams to Group on first creation |
| 2026-03-10 | Bug fixes: Firestore permission error when PM loads Group teams (query by ownerId not groupId); member names showing as emails after import — persisted email→name pairs to localStorage (`burndown-studio-member-pairs`); sprint task tooltip and backlog Excel import now correctly resolve emails to display names; JSON import preserves current preferences.members |
| 2026-03-14 | SaaS update2 — Invitation flow: dedicated registration page with password + Google Sign-In (all domains); wrong-user-signed-in guard (sign out, re-show invite page); landing page no longer prompts unknown sign-ins with "create account" (shows error via sessionStorage instead). PM enhancements: "Add Group Members" in Manage Members (add already-accepted group members to a team); member removal shows warning dialog with task list before confirming; PM Edit modal now includes PM display name field. Project TODAY: capped at today (no future dates); resets to most recent working day on page load (not always real today). Sprint defaults: developer count = team members with role `member` (PM excluded). Firestore rules: users collection readable by any authenticated user; invitations readable without auth. `setCurrentTeam` cancels pending debounce save on team switch (fixes cross-team data contamination). `Promise.allSettled` for resilient member profile loading. GitHub Actions: CI workflow (typecheck + test) + deploy workflow (build + Firebase Hosting deploy on push to main). |
| 2026-03-14 | UX polish — Sprint task Update: assignee gate blocks Worked/Remain editing until a member is assigned (picker with warning); only one task row open for update at a time (exclusive mode). Chart: actual and scope lines now extend as projections to sprint end; actual line is solid red for the full sprint. Backlog: tasks linked to future (not-yet-started) sprints remain editable. Add/Remove Tasks modal: hover over task ID shows `[StoryID] Story description`; hover over description shows assigned members. Gap detection: `findGaps` now respects custom holidays and working weekends from preferences. Sprint task `assignedTo` changes are synced to the linked backlog task. |
| 2026-03-16 | User photos & avatars — profile photo upload (client-side resize to 640px full + 80px thumb, stored as base64 in Firestore); canvas-generated initial-letter avatar fallback; `avatarSrc()` helper; change password sub-modal (email accounts only, reauthenticate + updatePassword); avatar shown in app header, team card member strip (max 5 + overflow), PM sidebar footer, member profile popup; click any avatar/thumbnail to view full-size photo; group name label moved to left side of member team selection screen; BDS header responsive layout (flat row at wide viewport, stacked centered at narrow). |
