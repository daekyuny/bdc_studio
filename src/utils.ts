import type { Sprint, GapInfo } from "./types.ts";

export const statusOptions = ["Todo", "In Progress", "Done"] as const;

// Always format dates using LOCAL calendar date, not UTC.
// toISOString() returns UTC which causes off-by-one errors in UTC+ timezones.
export const localIso = (date: Date): string => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
};

export const todayIso = (): string => localIso(new Date());

export const addDays = (isoDate: string, days: number): string => {
  const d = new Date(isoDate + "T00:00:00");
  d.setDate(d.getDate() + days);
  return localIso(d);
};

export const toShortDate = (isoDate: string | null | undefined): string => {
  if (!isoDate) return "";
  const date = new Date(isoDate + "T00:00:00");
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${m}/${d}`;
};

export const getWorkingDates = (
  startIso: string | null,
  endIso: string | null,
  holidays?: Set<string>,
  workWeekends?: Set<string>,
): string[] => {
  if (!startIso || !endIso) return [];
  const dates: string[] = [];
  const cursor = new Date(startIso + "T00:00:00");
  const end = new Date(endIso + "T00:00:00");
  while (cursor <= end) {
    const day = cursor.getDay();
    const iso = localIso(cursor);
    const isWeekend = day === 0 || day === 6;
    if (isWeekend) {
      if (workWeekends && workWeekends.has(iso)) dates.push(iso);
    } else {
      if (!holidays || !holidays.has(iso)) dates.push(iso);
    }
    cursor.setDate(cursor.getDate() + 1);
  }
  return dates;
};

export const formatSprintRange = (sprint: Pick<Sprint, "startDate" | "endDate">): string =>
  `${toShortDate(sprint.startDate)} – ${toShortDate(sprint.endDate)}`;

export const createId = (): string => crypto.randomUUID();

export const getNextWorkingDay = (
  isoDate: string,
  holidays?: Set<string>,
  workWeekends?: Set<string>,
): string => {
  const d = new Date(isoDate + "T00:00:00");
  d.setDate(d.getDate() + 1);
  while (true) {
    const day = d.getDay();
    const iso = localIso(d);
    const isWeekend = day === 0 || day === 6;
    if (isWeekend) {
      if (workWeekends && workWeekends.has(iso)) return iso;
    } else {
      if (!holidays || !holidays.has(iso)) return iso;
    }
    d.setDate(d.getDate() + 1);
  }
};

export const addWorkingDays = (
  isoDate: string,
  n: number,
  holidays?: Set<string>,
  workWeekends?: Set<string>,
): string => {
  const d = new Date(isoDate + "T00:00:00");
  let count = 0;
  while (count < n) {
    d.setDate(d.getDate() + 1);
    const day = d.getDay();
    const iso = localIso(d);
    const isWeekend = day === 0 || day === 6;
    if (isWeekend) {
      if (workWeekends && workWeekends.has(iso)) count++;
    } else {
      if (!holidays || !holidays.has(iso)) count++;
    }
  }
  return localIso(d);
};

export const sprintsOverlap = (
  a: Pick<Sprint, "startDate" | "endDate">,
  b: Pick<Sprint, "startDate" | "endDate">,
): boolean => a.startDate <= b.endDate && a.endDate >= b.startDate;

export const findGaps = (sprints: Pick<Sprint, "startDate" | "endDate">[]): GapInfo[] => {
  const gaps: GapInfo[] = [];
  for (let i = 0; i < sprints.length - 1; i++) {
    const nextWorking = getNextWorkingDay(sprints[i].endDate);
    if (nextWorking < sprints[i + 1].startDate) {
      gaps.push({ after: sprints[i] as Sprint, before: sprints[i + 1] as Sprint });
    }
  }
  return gaps;
};
