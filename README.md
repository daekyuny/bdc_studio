# Burndown Studio

Local, single-user web app for sprint burndown tracking with task-level updates. Data is stored in browser `localStorage`.

## Run

Open `index.html` in a browser — it works directly, no server needed.

For development with a local server:

```bash
python3 -m http.server 5173
```

Then visit `http://localhost:5173`.

## Development

Source code lives in `src/` as ES modules. After editing any file in `src/`, rebuild the bundle:

```bash
npm install    # first time only
npm run build  # bundles src/ → app.js
```

## Current Features

- Multiple sprints (local only).
- Sprint setup fields: name, start/end dates (weekends skipped), number of developers, efficiency factor.
- Task list with name, points/days, status, and done date.
- Ideal vs actual burndown chart (ideal uses effective man-days).
- Available Days indicator above task table:
  - Formula: `effective man-days - total points`.
  - Green if between `-1.0` and `1.0` (inclusive), red if `< -1.0`.
- Delete sprint with confirmation.
- JSON export/import for data backup and portability.
- Show day numbers toggle (switches between D1/D2 and calendar dates on chart).
- Graceful recovery from corrupt localStorage data.
- Inputs commit on blur/change/Enter (no mid-typing recalculations).

## Project Structure

```
bdc/
├── index.html          # UI structure and templates
├── app.js              # Bundled output (built from src/, committed to git)
├── styles.css          # Layout, theming, animations
├── src/
│   ├── main.js         # Entry point — event wiring, init
│   ├── dom.js          # DOM element references
│   ├── state.js        # State management — load, save, CRUD
│   ├── burndown.js     # Pure burndown calculation functions
│   ├── chart.js        # SVG chart rendering
│   ├── render.js       # DOM rendering (sprint list, tasks, stats)
│   ├── io.js           # JSON export/import
│   └── utils.js        # Shared helpers (dates, IDs, formatting)
├── docs/
│   ├── PRD.md          # Product requirements
│   ├── TECHNICAL_DESIGN.md
│   └── ROADMAP.md
├── package.json        # Build scripts (npm run build)
└── .gitignore
```

## Data Model (localStorage: `burndown-studio`)

```json
{
  "activeSprintId": "uuid",
  "sprints": [
    {
      "id": "uuid",
      "name": "Sprint Alpha",
      "startDate": "YYYY-MM-DD",
      "endDate": "YYYY-MM-DD",
      "developers": 4,
      "efficiency": 0.8,
      "tasks": [
        {
          "id": "uuid",
          "name": "...",
          "points": 3,
          "status": "Todo|In Progress|Done",
          "doneDate": "YYYY-MM-DD"
        }
      ],
      "createdAt": "ISO timestamp"
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
| 2026-02-20 | JSON export/import, show day numbers toggle fix, localStorage error handling, Available Days formula fix (now uses effective man-days) |
| 2026-02-20 | Refactored into ES modules under src/. Added esbuild bundling (`npm run build`) |
| 2026-02-20 | Project docs: PRD, Technical Design, Roadmap |
