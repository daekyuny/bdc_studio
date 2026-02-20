import { getWorkingDates } from "./utils.js";

export const calculateBurndown = (sprint, today) => {
  const dates = getWorkingDates(sprint.startDate, sprint.endDate);
  const totalPoints = sprint.tasks.reduce((sum, task) => sum + Number(task.points || 0), 0);
  const workingDays = dates.length || 0;
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
  const actual = dates.map((date, i) => {
    if (todayIndex < 0 || i > todayIndex) return null;
    return sprint.tasks.reduce((sum, task) => {
      const points = Number(task.points || 0);
      if (!task.doneDate) return sum + points;
      return task.doneDate > date ? sum + points : sum;
    }, 0);
  });

  return { dates, totalPoints, ideal, actual, manDays, effectiveManDays, idealDailyBurn, todayIndex };
};
