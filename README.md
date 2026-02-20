# Burndown Studio (MVP)

Local, single-user web app for sprint burndown tracking with task-level updates. Data is stored in browser `localStorage`.

## Run

Open `index.html` in a browser, or serve locally:

```bash
python3 -m http.server 5173
```

Then visit `http://localhost:5173`.

## Current Features

- Multiple sprints (local only).
- Sprint setup fields: name, start/end dates (weekends skipped), number of developers, efficiency factor.
- Task list with name, points/days, status, and done date.
- Ideal vs actual burndown chart (ideal uses effective man-days).
- Available Days indicator above task table:
  - Formula: `working days - total points` (total points treated as total days).
  - Green if between `-1.0` and `1.0` (inclusive), red if `< -1.0`.
- Delete sprint with confirmation.
- Inputs commit on blur/change/Enter (no mid-typing recalculations).

## Key Files

- `index.html`: UI structure
- `styles.css`: layout and styling
- `app.js`: logic, storage, burndown calculations

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

## Known Next Steps (optional)

- Holiday exclusions in working days.
- CSV export.
- Multi-team / multi-manager support with auth.

## Change Log

- 2026-02-19: MVP baseline.
- 2026-02-19: Sprint delete + layout/input polish.
- 2026-02-19: Capacity inputs + Available Days.
