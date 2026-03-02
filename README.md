# Burndown Studio

Local, single-user web app for sprint burndown tracking with task-level daily updates. Data is stored in browser `localStorage`.

## Run

Open `index.html` in a browser — it works directly, no server needed.

For development with a local server:

```bash
python3 -m http.server 5173
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

### Sprint Management
- Multiple sprints, auto-sorted by start date
- Sprint setup: description, start/end dates (weekends skipped, holidays excluded), developers, efficiency
- Overlap validation and gap warning between sprints
- TODAY override per sprint — set via the header picker or by clicking any date label on the chart

### Task Tracking
- Tasks sourced from the Product Backlog (Story → Task hierarchy)
- **Estimate** (from backlog, read-only) vs **Worked + Remain** (updated daily via Change/Save button)
- **Status toggle**: click to switch Todo ↔ In Progress (only when Worked = 0); auto-set to Done when Remain = 0
- **Done Date**: auto-set when Remain reaches 0; cleared when task reverts to In Progress
- **Remove** button only shown for Todo tasks
- Drag-and-drop task reordering (disabled when column sort is active)
- Sort by any column; Actual/Est column sorts by Worked + Remain

### Burndown Chart
- **Ideal line** (blue) — based on effective man-days (developers × efficiency)
- **Actual line** (red) — remaining work per day, reconstructed from per-task `remainLog`
- **Scope line** (green dashed) — sum of Worked + Remain per day, reconstructed from per-task `workedLog`/`remainLog`
- Actual and scope lines clip at TODAY; dashed vertical TODAY marker
- Click any x-axis date label to set TODAY

### Stats & Capacity
- Duration, working days, total points, remaining, done tasks, progress %
- Available Days indicator: `effectiveManDays − totalPoints` (green/red)

### Data & Export
- JSON export/import (full state backup)
- Sprint task export to Excel (.xlsx)
- Backlog Excel import/export
- Show day numbers toggle (D1/D2 vs mm/dd on chart x-axis)
- Graceful recovery from corrupt localStorage data

## Project Structure

```
bdc/
├── index.html          # UI structure and templates
├── app.js              # Bundled output (built from src/, committed to git)
├── styles.css          # Layout, theming, animations
├── src/
│   ├── main.ts         # Entry point — event wiring, init
│   ├── dom.ts          # DOM element references
│   ├── state.ts        # State management — load, save, CRUD
│   ├── types.ts        # Shared TypeScript interfaces
│   ├── burndown.ts     # Pure burndown calculation functions
│   ├── chart.ts        # SVG chart rendering
│   ├── render.ts       # DOM rendering (sprint list, tasks, stats)
│   ├── io.ts           # JSON/Excel export and import
│   ├── utils.ts        # Shared helpers (dates, IDs, formatting)
│   └── globals.d.ts    # Ambient declarations for CDN globals
├── test/
│   └── calculations.test.ts  # Unit tests (Node built-in test runner via tsx)
├── docs/
│   ├── PRD.md          # Product requirements
│   ├── TECHNICAL_DESIGN.md
│   └── ROADMAP.md
├── tsconfig.json       # TypeScript compiler configuration
├── package.json        # Build scripts and dev dependencies
└── .gitignore
```

## Data Model (localStorage: `burndown-studio`)

```json
{
  "activeSprintId": "uuid",
  "sprints": [
    {
      "id": "uuid",
      "description": "Sprint 1",
      "startDate": "YYYY-MM-DD",
      "endDate": "YYYY-MM-DD",
      "today": "YYYY-MM-DD",
      "developers": 4,
      "efficiency": 0.8,
      "tasks": [
        {
          "id": "uuid",
          "taskId": "1.2.3",
          "name": "...",
          "estimate": 3,
          "worked": 1,
          "remain": 2,
          "status": "Todo | In Progress | Done",
          "doneDate": "YYYY-MM-DD",
          "workedLog": [{ "date": "YYYY-MM-DD", "worked": 1 }],
          "remainLog": [{ "date": "YYYY-MM-DD", "remain": 2 }]
        }
      ],
      "createdAt": "ISO timestamp"
    }
  ],
  "backlog": { "stories": [] },
  "preferences": { "holidays": [], "workWeekends": [], "members": [] }
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
| 2026-02-20 | Refactored into ES modules under src/; esbuild bundling |
| 2026-02-20 | Project docs: PRD, Technical Design, Roadmap |
| 2026-02-23 | Sprint Excel export; Product Backlog (Story→Task hierarchy, Excel import/export) |
| 2026-02-24 | Backlog re-links sprint tasks on re-import; custom confirm dialogs |
| 2026-02-26 | Holiday/PTO exclusions in preferences |
| 2026-02-27 | Drag-and-drop task reorder; progress %; scope tracking; 59 unit tests |
| 2026-03-03 | TypeScript migration; Change/Save button UX; status toggle; auto-Done on remain=0; daily workedLog/remainLog; scope line; clickable chart dates to set TODAY; remove button hidden for non-Todo tasks |
