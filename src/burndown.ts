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
  const ideal = dates.map((_, index) => {
    if (dates.length <= 1) return plannedPoints;
    const remaining = plannedPoints - idealDailyBurn * index;
    return Math.round(Math.max(remaining, 0) * 100) / 100;
  });
  const todayIndex = dates.reduce((last, date, i) => (date <= today ? i : last), -1);
  const taskActiveAt = (task: SprintTask, date: string): boolean =>
    !task.addedDate || task.addedDate <= date;

  const scopeDropContribAt = (date: string): number =>
    (sprint.scopeDrops ?? [])
      .filter(d => d.addedDate <= date && d.removedDate > date)
      .reduce((sum, d) => sum + d.estimate, 0);

  const actual = dates.map((date, i): number | null => {
    if (todayIndex < 0 || i > todayIndex) return null;
    const taskPart = sprint.tasks
      .filter(t => taskActiveAt(t, date))
      .reduce((sum, task) => sum + getRemainAtDate(task, date), 0);
    return taskPart + scopeDropContribAt(date);
  });

  const scope = dates.map((date, i): number | null => {
    if (todayIndex < 0 || i > todayIndex) return null;
    const taskPart = sprint.tasks
      .filter(t => taskActiveAt(t, date))
      .reduce((sum, task) => sum + getWorkedAtDate(task, date) + getRemainAtDate(task, date), 0);
    return taskPart + scopeDropContribAt(date);
  });

  // Build scope drop markers grouped by date index
  const markerMap = new Map<number, string[]>();
  for (const drop of sprint.scopeDrops ?? []) {
    const idx = dates.indexOf(drop.removedDate);
    if (idx < 0 || idx > todayIndex) continue;
    const label = `${drop.taskId ? `[${drop.taskId}] ` : ""}${drop.name} (−${drop.estimate})`;
    if (!markerMap.has(idx)) markerMap.set(idx, []);
    markerMap.get(idx)!.push(label);
  }
  const scopeDropMarkers: ScopeDropMarker[] = Array.from(markerMap.entries())
    .map(([dateIndex, labels]) => ({ dateIndex, label: labels.join("\n") }));

  return { dates, totalPoints, ideal, actual, scope, scopeDropMarkers, manDays, effectiveManDays, idealDailyBurn, todayIndex };
};
