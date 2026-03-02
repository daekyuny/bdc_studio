import { todayIso, addWorkingDays, createId, getNextWorkingDay } from "./utils.ts";
import type { AppState, Sprint, SprintTask, Backlog, BacklogStory, BacklogTask, Preferences } from "./types.ts";

// --- Render hint bitmask constants ---
export const H_SIDEBAR = 1;
export const H_HEADER  = 2;
export const H_TASKS   = 4;
export const H_PANEL   = 8;
export const H_STATS   = 16;
export const H_CHART   = 32;
export const H_BACKLOG = 64;
export const H_ALL     = 0x7F;

// Convenience groups
export const H_SPRINT_TASKS = H_TASKS | H_PANEL | H_STATS | H_CHART;
export const H_BACKLOG_DATA = H_BACKLOG | H_PANEL;

const STORAGE_KEY = "burndown-studio";

let onChange: (hints?: number) => void = () => {};
export const setOnStateChange = (callback: (hints?: number) => void): void => {
  onChange = callback;
};

const sortSprints = (): void => {
  state.sprints.sort((a, b) => a.startDate.localeCompare(b.startDate));
};

const migrateState = (parsed: any): AppState => {
  if (!parsed.backlog) parsed.backlog = { stories: [] };
  if (!parsed.preferences) parsed.preferences = { holidays: [], workWeekends: [], members: [] };
  for (const sprint of parsed.sprints) {
    delete sprint.scopeLog;
    delete sprint.locked;
    delete sprint.lockedAt;
    delete sprint.lockedBaseline;
    for (const task of sprint.tasks) {
      if (task.points !== undefined && task.estimate === undefined) {
        task.estimate = task.points;
        task.actual = null;
        delete task.points;
      }
    }
  }
  return parsed as AppState;
};

const defaultState = (): AppState => {
  const start = todayIso();
  const end = addWorkingDays(start, 9);
  const sprintId = createId();
  return {
    activeSprintId: sprintId,
    backlog: { stories: [] },
    preferences: { holidays: [], workWeekends: [], members: [] },
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

const loadState = (): AppState => {
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

const save = (): void => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
};

let state: AppState = loadState();

export const getState = (): AppState => state;

export const getActiveSprint = (): Sprint | undefined =>
  state.sprints.find((sprint) => sprint.id === state.activeSprintId);

export const setActiveSprint = (id: string): void => {
  state.activeSprintId = id;
  save();
  onChange(H_ALL);
};

export const createSprint = ({ description, startDate, endDate, developers, efficiency }: {
  description: string;
  startDate: string;
  endDate: string;
  developers: number;
  efficiency: number;
}): void => {
  const newSprint: Sprint = {
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
  onChange(H_ALL);
};

export const updateSprintById = (id: string, updates: Partial<Sprint>): void => {
  const sprint = state.sprints.find((s) => s.id === id);
  if (!sprint) return;
  Object.assign(sprint, updates);
  sortSprints();
  save();
  onChange(H_SIDEBAR | H_HEADER | H_STATS | H_CHART);
};

export const deleteActiveSprint = (): void => {
  const sprint = getActiveSprint();
  if (!sprint) return;
  const sortedIndex = state.sprints.findIndex((s) => s.id === sprint.id) + 1;
  const label = sprint.description || `Sprint ${sortedIndex}`;
  if (!window.confirm(`Delete "${label}"? This cannot be undone.`)) return;

  state.sprints = state.sprints.filter((s) => s.id !== sprint.id);
  if (state.sprints.length === 0) {
    const start = todayIso();
    const end = addWorkingDays(start, 9);
    const newSprint: Sprint = {
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
  onChange(H_ALL);
};

export const reorderTasks = (taskIds: string[]): void => {
  const sprint = getActiveSprint();
  if (!sprint) return;
  const taskMap = new Map(sprint.tasks.map((t) => [t.id, t]));
  const reordered = taskIds.map((id) => taskMap.get(id)).filter((t): t is SprintTask => Boolean(t));
  for (const t of sprint.tasks) {
    if (!taskIds.includes(t.id)) reordered.push(t);
  }
  sprint.tasks = reordered;
  save();
  onChange(H_TASKS);
};

export const updateTask = (taskId: string, updates: Partial<SprintTask>): void => {
  const sprint = getActiveSprint();
  if (!sprint) return;
  const task = sprint.tasks.find((item) => item.id === taskId);
  if (!task) return;
  Object.assign(task, updates);
  save();
  onChange(H_SPRINT_TASKS);
};

export const removeTaskFromSprint = (taskId: string): void => {
  const sprint = getActiveSprint();
  if (!sprint) return;
  sprint.tasks = sprint.tasks.filter((task) => task.id !== taskId);
  save();
  onChange(H_SPRINT_TASKS);
};

export const addTaskFromBacklog = (backlogTaskId: string): void => {
  const sprint = getActiveSprint();
  if (!sprint) return;
  let foundTask: BacklogTask | null = null;
  for (const story of state.backlog.stories) {
    for (const t of story.tasks) {
      if (t.id === backlogTaskId) { foundTask = t; break; }
    }
    if (foundTask) break;
  }
  if (!foundTask) return;
  if (sprint.tasks.some(t => t.backlogTaskId === backlogTaskId)) return;
  const estimate = Number(foundTask.estimate) || 0;
  sprint.tasks.push({
    id: createId(), backlogTaskId,
    taskId: foundTask.taskId,
    name: foundTask.description,
    assignedTo: foundTask.assignedTo,
    estimate,
    actual: null, status: "Todo", doneDate: "",
  });
  save(); onChange(H_SPRINT_TASKS);
};

export const updateToday = (date: string): void => {
  const sprint = getActiveSprint();
  if (!sprint || !date) return;
  const maxDate = sprint.endDate ? getNextWorkingDay(sprint.endDate) : sprint.endDate;
  const clamped =
    date < sprint.startDate ? sprint.startDate :
    date > maxDate ? maxDate : date;
  sprint.today = clamped;
  save();
  onChange(H_STATS | H_CHART);
};

export const replaceState = (newState: AppState): void => {
  state = newState;
  save();
  onChange(H_ALL);
};

export const patchActiveSprint = (fields: Record<string, unknown>): boolean => {
  const sprint = getActiveSprint();
  if (!sprint) return false;
  let changed = false;
  for (const [key, value] of Object.entries(fields)) {
    if ((sprint as any)[key] === undefined || (sprint as any)[key] === null) {
      (sprint as any)[key] = value;
      changed = true;
    }
  }
  if (changed) save();
  return changed;
};

// --- Backlog CRUD ---

export const getBacklog = (): Backlog => state.backlog;

export const addStory = (): string => {
  const id = createId();
  const storyNum = state.backlog.stories.length + 1;
  state.backlog.stories.push({
    id,
    storyId: `${storyNum}`,
    description: "",
    priority: 100,
    tasks: [],
  });
  save(); onChange(H_BACKLOG_DATA);
  return id;
};

export const updateStory = (id: string, updates: Partial<BacklogStory>): void => {
  const story = state.backlog.stories.find((s) => s.id === id);
  if (!story) return;
  Object.assign(story, updates);
  save(); onChange(H_BACKLOG_DATA);
};

export const deleteStory = (id: string): void => {
  state.backlog.stories = state.backlog.stories.filter((s) => s.id !== id);
  save(); onChange(H_BACKLOG_DATA);
};

export const addBacklogTask = (storyId: string): string | null => {
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
  save(); onChange(H_BACKLOG_DATA);
  return id;
};

export const updateBacklogTask = (storyId: string, taskId: string, updates: Partial<BacklogTask>): void => {
  const story = state.backlog.stories.find((s) => s.id === storyId);
  if (!story) return;
  const task = story.tasks.find((t) => t.id === taskId);
  if (!task) return;
  Object.assign(task, updates);
  save(); onChange(H_BACKLOG_DATA);
};

export const deleteBacklogTask = (storyId: string, taskId: string): void => {
  const story = state.backlog.stories.find((s) => s.id === storyId);
  if (!story) return;
  story.tasks = story.tasks.filter((t) => t.id !== taskId);
  save(); onChange(H_BACKLOG_DATA);
};

export const replaceBacklog = (newBacklog: Backlog): void => {
  state.backlog = newBacklog;
  save(); onChange(H_ALL);
};

export interface OrphanedTask {
  sprintIndex: number;
  taskId: string;
  name: string;
}

export const findOrphanedSprintTasks = (newStories: BacklogStory[]): OrphanedTask[] => {
  const incomingIds = new Set<string>();
  for (const story of newStories)
    for (const task of story.tasks)
      if (task.taskId) incomingIds.add(task.taskId);

  const orphans: OrphanedTask[] = [];
  for (const sprint of state.sprints) {
    const idx = state.sprints.indexOf(sprint) + 1;
    for (const task of sprint.tasks) {
      if (task.taskId && !incomingIds.has(task.taskId))
        orphans.push({ sprintIndex: idx, taskId: task.taskId, name: task.name });
    }
  }
  return orphans;
};

export const relinkSprintTasks = (): void => {
  const taskIdMap = new Map<string, BacklogTask>();
  for (const story of state.backlog.stories)
    for (const task of story.tasks)
      if (task.taskId) taskIdMap.set(task.taskId, task);

  for (const sprint of state.sprints) {
    sprint.tasks = sprint.tasks.filter((t) => {
      const bt = taskIdMap.get(t.taskId!);
      if (!bt) return false;
      t.backlogTaskId = bt.id;
      t.name = bt.description;
      t.estimate = Number(bt.estimate) || 0;
      t.assignedTo = bt.assignedTo || "";
      return true;
    });
  }
  save();
};

// --- Preferences CRUD ---

export const getPreferences = (): Preferences => state.preferences;

export const addHoliday = (date: string, name: string): void => {
  if (state.preferences.holidays.some((h) => h.date === date)) return;
  state.preferences.holidays.push({ date, name });
  state.preferences.holidays.sort((a, b) => a.date.localeCompare(b.date));
  save(); onChange(H_ALL);
};

export const removeHoliday = (date: string): void => {
  state.preferences.holidays = state.preferences.holidays.filter((h) => h.date !== date);
  save(); onChange(H_ALL);
};

export const addWorkWeekend = (date: string): void => {
  if (state.preferences.workWeekends.includes(date)) return;
  state.preferences.workWeekends.push(date);
  state.preferences.workWeekends.sort();
  save(); onChange(H_ALL);
};

export const removeWorkWeekend = (date: string): void => {
  state.preferences.workWeekends = state.preferences.workWeekends.filter((d) => d !== date);
  save(); onChange(H_ALL);
};

// --- Members CRUD ---

export const getMembers = (): string[] => state.preferences.members;

export const addMember = (name: string): void => {
  const trimmed = name.trim();
  if (!trimmed) return;
  if (state.preferences.members.includes(trimmed)) return;
  state.preferences.members.push(trimmed);
  state.preferences.members.sort((a, b) => a.localeCompare(b));
  save(); onChange(H_ALL);
};

export const removeMember = (name: string): void => {
  state.preferences.members = state.preferences.members.filter((m) => m !== name);
  save(); onChange(H_ALL);
};

export const addMembersFromImport = (names: string[]): void => {
  const existing = new Set(state.preferences.members);
  let added = false;
  for (const name of names) {
    const trimmed = name.trim();
    if (trimmed && !existing.has(trimmed)) {
      state.preferences.members.push(trimmed);
      existing.add(trimmed);
      added = true;
    }
  }
  if (added) {
    state.preferences.members.sort((a, b) => a.localeCompare(b));
    save(); onChange(H_ALL);
  }
};
