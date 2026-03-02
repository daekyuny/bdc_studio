import { getWorkingDates, getNextWorkingDay } from "./utils.ts";
import type { Sprint, BurndownData, RemainEntry, WorkedEntry, SprintTask } from "./types.ts";

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
  const sprintDates = getWorkingDates(sprint.startDate, sprint.endDate, holidays, workWeekends);
  const extraDay = sprint.endDate ? getNextWorkingDay(sprint.endDate, holidays, workWeekends) : null;
  const dates = extraDay ? [...sprintDates, extraDay] : sprintDates;
  const totalPoints = sprint.tasks.reduce((sum, task) => sum + Number(task.estimate || 0), 0);
  const workingDays = sprintDates.length || 0;
  const developers = Math.max(0, Number(sprint.developers || 0));
  const efficiency = Math.min(1, Math.max(0, Number(sprint.efficiency || 0)));
  const manDays = developers * workingDays;
  const effectiveManDays = manDays * efficiency;
  const idealDailyBurn = workingDays > 0 ? effectiveManDays / workingDays : 0;
  const ideal = dates.map((_, index) => {
    if (dates.length <= 1) return totalPoints;
    const remaining = totalPoints - idealDailyBurn * index;
    return Math.round(Math.max(remaining, 0) * 100) / 100;
  });
  const todayIndex = dates.reduce((last, date, i) => (date <= today ? i : last), -1);
  const actual = dates.map((date, i): number | null => {
    if (todayIndex < 0 || i > todayIndex) return null;
    return sprint.tasks.reduce((sum, task) => sum + getRemainAtDate(task, date), 0);
  });

  const scope = dates.map((date, i): number | null => {
    if (todayIndex < 0 || i > todayIndex) return null;
    return sprint.tasks.reduce((sum, task) => sum + getWorkedAtDate(task, date) + getRemainAtDate(task, date), 0);
  });

  return { dates, totalPoints, ideal, actual, scope, manDays, effectiveManDays, idealDailyBurn, todayIndex };
};
