import { getWorkingDates } from "./utils.ts";
import type { Sprint, BurndownData, RemainEntry, WorkedEntry, SprintTask, ScopeDropMarker } from "./types.ts";

const getWorkedAtDate = (task: SprintTask, date: string): number => {
  const log = task.workedLog;
  if (!log || log.length === 0) return task.worked ?? 0;
  let best: WorkedEntry | undefined;
  for (const entry of log) {
    if (entry.date <= date && (!best || entry.date >= best.date)) best = entry;
  }
  return best !== undefined ? best.worked : 0;
};

const getRemainAtDate = (task: SprintTask, date: string): number => {
  if (task.doneDate && task.doneDate <= date) return 0;
  const log = task.remainLog;
  if (!log || log.length === 0) return task.remain ?? task.estimate ?? 0;
  let best: RemainEntry | undefined;
  for (const entry of log) {
    if (entry.date <= date && (!best || entry.date >= best.date)) best = entry;
  }
  return best !== undefined ? best.remain : (task.estimate ?? 0);
};

export const calculateBurndown = (
  sprint: Sprint,
  today: string,
  holidays?: Set<string>,
  workWeekends?: Set<string>,
): BurndownData => {
  const dates = getWorkingDates(sprint.startDate, sprint.endDate, holidays, workWeekends);
  const totalPoints = sprint.tasks
    .reduce((sum, task) => sum + Number(task.estimate || 0), 0);
  // Ideal line is locked to plannedPoints set at planning time; falls back to current total
  const plannedPoints = sprint.plannedPoints ?? totalPoints;
  const workingDays = dates.length || 0;
  const developers = Math.max(0, Number(sprint.developers || 0));
  const efficiency = Math.min(1, Math.max(0, Number(sprint.efficiency || 0)));
  const manDays = developers * workingDays;
  const effectiveManDays = manDays * efficiency;
  const idealDailyBurn = workingDays > 0 ? effectiveManDays / workingDays : 0;

  const scopeDropContribAt = (date: string): number =>
    (sprint.scopeDrops ?? [])
      .filter(d => d.addedDate <= date && d.removedDate > date)
      .reduce((sum, d) => sum + d.estimate, 0);

  // Initial scope at border 0: sum of estimates for tasks present at sprint start,
  // plus scope-drop contributions (planned tasks removed mid-sprint that were in scope at start).
  // This may exceed plannedPoints when tasks are moved in from other sprints.
  const initialScope = sprint.tasks
    .filter(t => !t.addedDate || t.addedDate <= sprint.startDate)
    .reduce((sum, t) => sum + (t.estimate ?? 0), 0)
    + scopeDropContribAt(sprint.startDate);

  // Ideal line starting point: use plannedPoints as the locked baseline, but raise it to
  // initialScope if tasks were moved in from other sprints after finalization (those tasks
  // land with no addedDate, so initialScope captures them while plannedPoints does not).
  // We never lower below plannedPoints — that would un-fix the ideal line on scope drops.
  const idealStartingPoints = Math.max(plannedPoints, initialScope);

  // N+1 plot borders: border 0 = sprint start (before any work), border N = sprint end.
  // Each working day i occupies the band between border i and border i+1.
  // ideal[i] is plotted at border i; ideal goes from idealStartingPoints → 0 exactly.
  const N = workingDays;
  const idealLineBurn = N > 0 ? idealStartingPoints / N : 0;
  const ideal = Array.from({ length: N + 1 }, (_, i) =>
    Math.round(Math.max(0, idealStartingPoints - idealLineBurn * i) * 100) / 100
  );

  // todayIndex: 0-based band index (dates[todayIndex] is the current working day)
  const todayIndex = dates.reduce((last, date, i) => (date <= today ? i : last), -1);

  const taskActiveAt = (task: SprintTask, date: string): boolean =>
    !task.addedDate || task.addedDate <= date;

  // actual[0] = initialScope (border 0: before any work)
  // actual[i+1] = remaining recorded at end of dates[i], for i <= todayIndex
  const actual: (number | null)[] = Array(N + 1).fill(null);
  if (todayIndex >= 0) {
    actual[0] = initialScope;
    for (let i = 0; i <= todayIndex; i++) {
      const date = dates[i];
      const taskPart = sprint.tasks
        .filter(t => taskActiveAt(t, date))
        .reduce((sum, task) => sum + getRemainAtDate(task, date), 0);
      actual[i + 1] = taskPart + scopeDropContribAt(date);
    }
  }

  // scope[0] = initialScope (border 0: worked=0, remain=estimate for all tasks at sprint start)
  // scope[i+1] = worked + remain recorded at end of dates[i], for i <= todayIndex
  const scope: (number | null)[] = Array(N + 1).fill(null);
  if (todayIndex >= 0) {
    scope[0] = initialScope;
    for (let i = 0; i <= todayIndex; i++) {
      const date = dates[i];
      const taskPart = sprint.tasks
        .filter(t => taskActiveAt(t, date))
        .reduce((sum, task) => sum + getWorkedAtDate(task, date) + getRemainAtDate(task, date), 0);
      scope[i + 1] = taskPart + scopeDropContribAt(date);
    }
  }

  // Scope drop markers: plotted at the RIGHT border of the drop day (dateIdx + 1)
  const markerMap = new Map<number, string[]>();
  for (const drop of sprint.scopeDrops ?? []) {
    const dateIdx = dates.indexOf(drop.removedDate);
    if (dateIdx < 0 || dateIdx > todayIndex) continue;
    const borderIdx = dateIdx + 1;
    const label = `${drop.taskId ? `[${drop.taskId}] ` : ""}${drop.name} (−${drop.estimate})`;
    if (!markerMap.has(borderIdx)) markerMap.set(borderIdx, []);
    markerMap.get(borderIdx)!.push(label);
  }
  const scopeDropMarkers: ScopeDropMarker[] = Array.from(markerMap.entries())
    .map(([dateIndex, labels]) => ({ dateIndex, label: labels.join("\n") }));

  return { dates, totalPoints, ideal, actual, scope, scopeDropMarkers, manDays, effectiveManDays, idealDailyBurn, todayIndex };
};
