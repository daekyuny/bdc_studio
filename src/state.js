import { todayIso, addWorkingDays, createId, getNextWorkingDay } from "./utils.js";

const STORAGE_KEY = "burndown-studio";

let onChange = () => {};
export const setOnStateChange = (callback) => {
  onChange = callback;
};

const sortSprints = () => {
  state.sprints.sort((a, b) => a.startDate.localeCompare(b.startDate));
};

const defaultState = () => {
  const start = todayIso();
  const end = addWorkingDays(start, 9);
  const sprintId = createId();
  return {
    activeSprintId: sprintId,
    sprints: [
      {
        id: sprintId,
        description: "",
        startDate: start,
        endDate: end,
        developers: 4,
        efficiency: 0.8,
        tasks: [],
        createdAt: new Date().toISOString(),
      },
    ],
  };
};

const loadState = () => {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return defaultState();
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || !Array.isArray(parsed.sprints)) return defaultState();
    return parsed;
  } catch {
    console.warn("Burndown Studio: corrupt localStorage data, resetting to defaults.");
    localStorage.removeItem(STORAGE_KEY);
    return defaultState();
  }
};

const save = () => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
};

let state = loadState();

export const getState = () => state;

export const getActiveSprint = () =>
  state.sprints.find((sprint) => sprint.id === state.activeSprintId);

export const setActiveSprint = (id) => {
  state.activeSprintId = id;
  save();
  onChange();
};

export const createSprint = ({ description, startDate, endDate, developers, efficiency }) => {
  const newSprint = {
    id: createId(),
    description: description || "",
    startDate,
    endDate,
    developers,
    efficiency,
    tasks: [],
    createdAt: new Date().toISOString(),
  };
  state.sprints.push(newSprint);
  sortSprints();
  state.activeSprintId = newSprint.id;
  save();
  onChange();
};

export const updateSprintById = (id, updates) => {
  const sprint = state.sprints.find((s) => s.id === id);
  if (!sprint) return;
  Object.assign(sprint, updates);
  sortSprints();
  save();
  onChange();
};

export const deleteActiveSprint = () => {
  const sprint = getActiveSprint();
  if (!sprint) return;
  const sortedIndex = state.sprints.findIndex((s) => s.id === sprint.id) + 1;
  const label = sprint.description || `Sprint ${sortedIndex}`;
  if (!window.confirm(`Delete "${label}"? This cannot be undone.`)) return;

  state.sprints = state.sprints.filter((s) => s.id !== sprint.id);
  if (state.sprints.length === 0) {
    const start = todayIso();
    const end = addWorkingDays(start, 9);
    const newSprint = {
      id: createId(),
      description: "",
      startDate: start,
      endDate: end,
      developers: 0,
      efficiency: 1,
      tasks: [],
      createdAt: new Date().toISOString(),
    };
    state.sprints = [newSprint];
    state.activeSprintId = newSprint.id;
  } else {
    state.activeSprintId = state.sprints[0].id;
  }
  save();
  onChange();
};

export const updateTask = (taskId, updates) => {
  const sprint = getActiveSprint();
  if (!sprint) return;
  const task = sprint.tasks.find((item) => item.id === taskId);
  if (!task) return;
  Object.assign(task, updates);
  save();
  onChange();
};

export const addTask = () => {
  const sprint = getActiveSprint();
  if (!sprint) return;
  sprint.tasks.push({
    id: createId(),
    name: "",
    points: 0,
    status: "Todo",
    doneDate: "",
  });
  save();
  onChange();
};

export const removeTask = (taskId) => {
  const sprint = getActiveSprint();
  if (!sprint) return;
  sprint.tasks = sprint.tasks.filter((task) => task.id !== taskId);
  save();
  onChange();
};

export const updateToday = (date) => {
  const sprint = getActiveSprint();
  if (!sprint || !date) return;
  const clamped =
    date < sprint.startDate ? sprint.startDate :
    date > sprint.endDate ? sprint.endDate : date;
  sprint.today = clamped;
  save();
  onChange();
};

export const replaceState = (newState) => {
  state = newState;
  save();
  onChange();
};

export const patchActiveSprint = (fields) => {
  const sprint = getActiveSprint();
  if (!sprint) return false;
  let changed = false;
  for (const [key, value] of Object.entries(fields)) {
    if (sprint[key] === undefined || sprint[key] === null) {
      sprint[key] = value;
      changed = true;
    }
  }
  if (changed) save();
  return changed;
};
