export const statusOptions = ["Todo", "In Progress", "Done"];

export const todayIso = () => new Date().toISOString().slice(0, 10);

export const addDays = (isoDate, days) => {
  const date = new Date(isoDate);
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
};

export const toShortDate = (isoDate) => {
  if (!isoDate) return "";
  const date = new Date(isoDate + "T00:00:00");
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
};

export const getWorkingDates = (startIso, endIso) => {
  if (!startIso || !endIso) return [];
  const dates = [];
  let cursor = new Date(startIso + "T00:00:00");
  const end = new Date(endIso + "T00:00:00");
  while (cursor <= end) {
    const day = cursor.getDay();
    if (day !== 0 && day !== 6) {
      dates.push(cursor.toISOString().slice(0, 10));
    }
    cursor.setDate(cursor.getDate() + 1);
  }
  return dates;
};

export const formatSprintRange = (sprint) =>
  `${toShortDate(sprint.startDate)} – ${toShortDate(sprint.endDate)}`;

export const createId = () => crypto.randomUUID();
