# Backlog delete guard + backlog XLSX merge import — DONE

Shipped in commit `e610fe8` (2026-04-16).

## What landed

- **Part 1** — `deleteStory` / `deleteBacklogTask` refuse when any sprint task
  references the target; the Backlog tab shows a blocking modal listing the
  offending sprint(s).
- **Part 2** — Backlog XLSX import is now an additive merge via
  `planBacklogMerge` (pure) + `applyBacklogMerge`. Rules 2.0–2.5 implemented;
  team-email filter; blank `Assigned To` cell leaves existing assignment
  untouched; dry-run confirm summarizes the plan before applying. Unused
  `findOrphanedSprintTasks` / `relinkSprintTasks` removed.

## Obsolete (archived)

The following items were noted during the work but are being dropped from
active tracking. Revisit only if a concrete problem surfaces.

- JSON sprint import backlog-wipe behavior.
- `splitTaskToSprint` suffix divergence (`<id>a` / `<id>b` vs backlog `taskId`).
- `addTaskFromBacklog` ScopeDrop fallback-by-name match.
- `updateTask`'s one-directional `assignedTo` sync (sprint → backlog).
