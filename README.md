# Burndown Studio

Local, single-user web app for sprint burndown tracking with task-level daily updates. Data is stored in browser `localStorage`.

## Run

Open `index.html` in a browser — it works directly, no server needed.

For development with a local server:

```bash
npm run dev        # start static server on http://localhost:5173
```

Then visit `http://localhost:5173`.

## Development

Source code lives in `src/` as TypeScript modules. After editing any file in `src/`, rebuild the bundle:

```bash
npm install        # first time only (esbuild, typescript, tsx)
npm run build      # bundles src/main.ts → app.js
npm run typecheck  # run tsc --noEmit (zero errors expected)
npm run test       # run unit tests via tsx
npm run dev        # start static server on http://localhost:5173
```

## Current Features

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

- **Ideal line** (blue) — based on `plannedPoints` locked when the planning modal is closed; never changes mid-sprint regardless of task additions or removals
- **Actual line** (red) — remaining work per working day up to project TODAY, reconstructed from per-task `remainLog`
- **Scope line** (green dashed) — Worked + Remain per working day up to project TODAY; reflects mid-sprint scope changes
- **Scope drop markers** (amber triangle) — annotate dates when planned tasks were removed from scope
- **Today marker** (indigo vertical line + "Today" label) — drawn only when project TODAY falls within the sprint
- **Browse marker** (gray vertical line) — shown in past/future sprints when a date is clicked; same date click removes it
- Show day numbers toggle (D0/D1/… vs mm/dd labels on x-axis); unchecked by default

### Stats & Capacity

- Duration, working days, total points, remaining, done tasks, progress %
- **Available Days**: `effectiveManDays − totalPoints` (green if within ±1.5 days, red if over by >1.5)
- **Efficiency**: actual (pointsBurned / (developers × daysElapsed)) vs ideal
- Man-days chip in New/Edit Sprint dialog updates live as dates, developers, and efficiency change

### Sprint Reset

Resets all progress (Worked, Remain, status, doneDate, workedLog, remainLog) back to initial state while **keeping all tasks**. Clears scope drop history. Browse date returns to project TODAY.

### Preferences

- **Holidays**: date + optional name; excluded from working-day counts and date pickers
- **Work weekends**: specific weekend dates that count as working days
- **Team members**: used to populate the assignee selector in the backlog and as the default developer count for the first sprint

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
├── src/
│   ├── main.ts         # Entry point — event wiring, modal logic, init
│   ├── dom.ts          # DOM element references
│   ├── state.ts        # State management — load, save, CRUD, migrations
│   ├── types.ts        # Shared TypeScript interfaces
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
├── package.json        # Build scripts and dev dependencies
└── .gitignore
```

## Data Model (localStorage: `burndown-studio`)

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
            "assignedTo": "..."
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
          "assignedTo": "...",
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
| 2026-03-03 | TypeScript migration; Update/Save UX; auto-status (Todo/In Progress/Done); auto-Done on remain=0; daily workedLog/remainLog; scope line; clickable chart dates |
| 2026-03-04 | Sprint planning modal; project TODAY field; current-sprint controls; ideal line locked to plannedPoints; custom delete/reset dialogs; man-days chip; disabled button styles; sort on planning modal |
| 2026-03-04 | Burndown fixes: remove extra day; chart Today marker and actual line use project TODAY; data recording always uses project TODAY |
| 2026-03-05 | Browse date toggle on past/future sprint charts; clicking chart date in current sprint updates project TODAY; project TODAY resets to real date on page load; sprint reset keeps all tasks; add/remove same task cancels scope history |
