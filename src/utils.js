export const statusOptions = ["Todo", "In Progress", "Done"];

// Always format dates using LOCAL calendar date, not UTC.
// toISOString() returns UTC which causes off-by-one errors in UTC+ timezones.
const localIso = (date) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
};

export const todayIso = () => localIso(new Date());

export const addDays = (isoDate, days) => {
  const d = new Date(isoDate + "T00:00:00");
  d.setDate(d.getDate() + days);
  return localIso(d);
};

export const toShortDate = (isoDate) => {
  if (!isoDate) return "";
  const date = new Date(isoDate + "T00:00:00");
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${m}/${d}`;
};

export const getWorkingDates = (startIso, endIso) => {
  if (!startIso || !endIso) return [];
  const dates = [];
  let cursor = new Date(startIso + "T00:00:00");
  const end = new Date(endIso + "T00:00:00");
  while (cursor <= end) {
    const day = cursor.getDay();
    if (day !== 0 && day !== 6) {
      dates.push(localIso(cursor));
    }
    cursor.setDate(cursor.getDate() + 1);
  }
  return dates;
};

export const formatSprintRange = (sprint) =>
  `${toShortDate(sprint.startDate)} – ${toShortDate(sprint.endDate)}`;

export const createId = () => crypto.randomUUID();

export const getNextWorkingDay = (isoDate) => {
  const d = new Date(isoDate + "T00:00:00");
  d.setDate(d.getDate() + 1);
  while (d.getDay() === 0 || d.getDay() === 6) {
    d.setDate(d.getDate() + 1);
  }
  return localIso(d);
};

export const addWorkingDays = (isoDate, n) => {
  const d = new Date(isoDate + "T00:00:00");
  let count = 0;
  while (count < n) {
    d.setDate(d.getDate() + 1);
    if (d.getDay() !== 0 && d.getDay() !== 6) count++;
  }
  return localIso(d);
};

export const sprintsOverlap = (a, b) =>
  a.startDate <= b.endDate && a.endDate >= b.startDate;

export const findGaps = (sprints) => {
  // sprints must be sorted by startDate
  const gaps = [];
  for (let i = 0; i < sprints.length - 1; i++) {
    const nextWorking = getNextWorkingDay(sprints[i].endDate);
    if (nextWorking < sprints[i + 1].startDate) {
      gaps.push({ after: sprints[i], before: sprints[i + 1] });
    }
  }
  return gaps;
};
