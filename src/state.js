import { todayIso, addWorkingDays, createId, getNextWorkingDay } from "./utils.js";

const STORAGE_KEY = "burndown-studio";

let onChange = () => {};
export const setOnStateChange = (callback) => {
  onChange = callback;
};

const sortSprints = () => {
  state.sprints.sort((a, b) => a.startDate.localeCompare(b.startDate));
};

const migrateState = (parsed) => {
  if (!parsed.backlog) parsed.backlog = { stories: [] };
  for (const sprint of parsed.sprints) {
    for (const task of sprint.tasks) {
      if (task.points !== undefined && task.estimate === undefined) {
        task.estimate = task.points;
        task.actual = null;
        delete task.points;
      }
    }
  }
  return parsed;
};

const defaultState = () => {
  const start = todayIso();
  const end = addWorkingDays(start, 9);
  const sprintId = createId();
  return {
    activeSprintId: sprintId,
    backlog: { stories: [] },
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
    return migrateState(parsed);
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

export const removeTaskFromSprint = (taskId) => {
  const sprint = getActiveSprint();
  if (!sprint) return;
  sprint.tasks = sprint.tasks.filter((task) => task.id !== taskId);
  save();
  onChange();
};

export const addTaskFromBacklog = (backlogTaskId) => {
  const sprint = getActiveSprint();
  if (!sprint) return;
  let foundTask = null, foundStory = null;
  for (const story of state.backlog.stories) {
    for (const t of story.tasks) {
      if (t.id === backlogTaskId) { foundTask = t; foundStory = story; break; }
    }
    if (foundTask) break;
  }
  if (!foundTask) return;
  if (sprint.tasks.some(t => t.backlogTaskId === backlogTaskId)) return; // dup guard
  sprint.tasks.push({
    id: createId(), backlogTaskId,
    taskId: foundTask.taskId,
    name: foundTask.description,
    assignedTo: foundTask.assignedTo,
    estimate: Number(foundTask.estimate) || 0,
    actual: null, status: "Todo", doneDate: "",
  });
  save(); onChange();
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

// --- Backlog CRUD ---

export const getBacklog = () => state.backlog;

export const addStory = () => {
  const id = createId();
  const storyNum = state.backlog.stories.length + 1;
  state.backlog.stories.push({
    id,
    storyId: `${storyNum}`,
    description: "",
    priority: 100,
    tasks: [],
  });
  save(); onChange();
  return id;
};

export const updateStory = (id, updates) => {
  const story = state.backlog.stories.find((s) => s.id === id);
  if (!story) return;
  Object.assign(story, updates);
  save(); onChange();
};

export const deleteStory = (id) => {
  state.backlog.stories = state.backlog.stories.filter((s) => s.id !== id);
  save(); onChange();
};

export const addBacklogTask = (storyId) => {
  const story = state.backlog.stories.find((s) => s.id === storyId);
  if (!story) return null;
  const id = createId();
  const taskNum = story.tasks.length + 1;
  story.tasks.push({
    id,
    taskId: `${story.storyId}.${taskNum}`,
    description: "",
    estimate: 0,
    assignedTo: "",
  });
  save(); onChange();
  return id;
};

export const updateBacklogTask = (storyId, taskId, updates) => {
  const story = state.backlog.stories.find((s) => s.id === storyId);
  if (!story) return;
  const task = story.tasks.find((t) => t.id === taskId);
  if (!task) return;
  Object.assign(task, updates);
  save(); onChange();
};

export const deleteBacklogTask = (storyId, taskId) => {
  const story = state.backlog.stories.find((s) => s.id === storyId);
  if (!story) return;
  story.tasks = story.tasks.filter((t) => t.id !== taskId);
  save(); onChange();
};

export const replaceBacklog = (newBacklog) => {
  state.backlog = newBacklog;
  save(); onChange();
};
