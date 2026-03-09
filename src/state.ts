import { todayIso, addDays, addWorkingDays, createId, getNextWorkingDay } from "./utils.ts";
import type { AppState, Sprint, SprintTask, Backlog, BacklogStory, BacklogTask, Preferences, ScopeDrop } from "./types.ts";
import { isFirebaseConfigured } from "./firebase.ts";
import { loadTeamState, saveTeamState, subscribeToTeamState } from "./db.ts";

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

// --- Firestore integration state ---
let currentTeamId: string | null = null;
let unsubscribeSnapshot: (() => void) | null = null;
let saveDebounceTimer: ReturnType<typeof setTimeout> | null = null;
// Timestamp of our last write to Firestore; used to suppress echo snapshots
let lastFirestoreWriteAt = 0;

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
  if (!parsed.projectToday) parsed.projectToday = todayIso();
  for (const sprint of parsed.sprints) {
    delete sprint.locked;
    delete sprint.lockedAt;
    delete sprint.lockedBaseline;
    for (const task of sprint.tasks) {
      if (task.points !== undefined && task.estimate === undefined) {
        task.estimate = task.points;
        delete task.points;
      }
      // migrate old actual → worked/remain
      if ((task as any).worked === undefined) {
        const old = (task as any).actual ?? null;
        if (task.status === 'Done') {
          task.worked = old != null ? old : (task.estimate ?? 0);
          task.remain = 0;
        } else {
          task.worked = 0;
          task.remain = task.estimate ?? 0;
        }
        delete (task as any).actual;
      }
      if (!task.remainLog) task.remainLog = [];
      if (!task.workedLog) task.workedLog = [];
      // migrate soft-deleted tasks (removedDate) to new scopeDrops model
      if ((task as any).removedDate) {
        const removedDate = (task as any).removedDate as string;
        if (task.worked === 0) {
          if (!task.addedDate || task.addedDate < sprint.startDate) {
            if (!sprint.scopeDrops) sprint.scopeDrops = [];
            sprint.scopeDrops.push({
              addedDate: task.addedDate || sprint.startDate,
              removedDate,
              estimate: task.estimate ?? 0,
              taskId: task.taskId,
              name: task.name,
            });
            (task as any)._delete = true;
          } else {
            (task as any)._delete = true;
          }
        }
        delete (task as any).removedDate;
      }
    }
    sprint.tasks = sprint.tasks.filter((t: any) => !t._delete);
  }
  // Migrate BacklogTask.assignedTo from legacy string → string[]
  for (const story of parsed.backlog?.stories ?? []) {
    for (const task of story.tasks ?? []) {
      if (typeof task.assignedTo === "string") {
        task.assignedTo = task.assignedTo ? [task.assignedTo] : [];
      } else if (!Array.isArray(task.assignedTo)) {
        task.assignedTo = [];
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
    projectToday: todayIso(),
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

const fixLoadedState = (appState: AppState): AppState => {
  const holidaySet = new Set(appState.preferences.holidays.map((h: any) => h.date));
  const workWeekendSet = new Set(appState.preferences.workWeekends);
  // Reset project TODAY to real system date, skipping holidays/weekends.
  // getNextWorkingDay(yesterday) = first working day on or after today.
  const today = getNextWorkingDay(addDays(todayIso(), -1), holidaySet, workWeekendSet);
  appState.projectToday = today;
  for (const sprint of appState.sprints) {
    if (sprint.endDate < today) {
      sprint.today = getNextWorkingDay(sprint.endDate, holidaySet, workWeekendSet);
    } else if (sprint.startDate > today) {
      sprint.today = sprint.startDate;
    } else {
      sprint.today = today;
    }
  }
  return appState;
};

const loadState = (): AppState => {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return defaultState();
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || !Array.isArray(parsed.sprints)) return defaultState();
    return fixLoadedState(migrateState(parsed));
  } catch {
    console.warn("Burndown Studio: corrupt localStorage data, resetting to defaults.");
    localStorage.removeItem(STORAGE_KEY);
    return defaultState();
  }
};

const doSaveToFirestore = async (teamId: string): Promise<void> => {
  try {
    await saveTeamState(teamId, JSON.parse(JSON.stringify(state)));
  } catch (err) {
    console.error("Burndown Studio: Firestore save failed:", err);
  }
};

const save = (): void => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  if (isFirebaseConfigured && currentTeamId) {
    // Start the echo-suppression window immediately so the snapshot
    // Firestore sends back for our own write gets ignored.
    lastFirestoreWriteAt = Date.now();
    if (saveDebounceTimer) clearTimeout(saveDebounceTimer);
    const teamId = currentTeamId;
    saveDebounceTimer = setTimeout(() => doSaveToFirestore(teamId), 500);
  }
};

// Load state from Firestore for the given team and subscribe to real-time updates.
export const setCurrentTeam = async (teamId: string): Promise<void> => {
  currentTeamId = teamId;
  if (unsubscribeSnapshot) {
    unsubscribeSnapshot();
    unsubscribeSnapshot = null;
  }
  if (!isFirebaseConfigured) return;

  try {
    const remoteState = await loadTeamState(teamId);
    if (remoteState && Array.isArray(remoteState.sprints)) {
      // Preserve members: always derived from Firebase Auth profiles by main.ts,
      // never from Firestore appdata (which may contain stale emails).
      const preservedMembers = [...state.preferences.members];
      state = fixLoadedState(migrateState(remoteState as any));
      if (preservedMembers.length > 0) state.preferences.members = preservedMembers;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    }
  } catch (err) {
    console.warn("Burndown Studio: failed to load from Firestore, using local cache:", err);
  }

  unsubscribeSnapshot = subscribeToTeamState(teamId, (remoteState) => {
    // Suppress echoes of our own writes (5s suppression window)
    if (Date.now() - lastFirestoreWriteAt < 5000) return;
    if (!remoteState || !Array.isArray(remoteState.sprints)) return;
    // projectToday and members are per-session — preserve the current runtime values.
    // Members are always derived from Firebase Auth profiles, never from Firestore appdata.
    const preservedToday = state.projectToday;
    const preservedMembers = [...state.preferences.members];
    state = fixLoadedState(migrateState(remoteState as any));
    state.projectToday = preservedToday;
    if (preservedMembers.length > 0) state.preferences.members = preservedMembers;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    onChange(H_ALL);
  });
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

export const resetActiveSprint = (): void => {
  const sprint = getActiveSprint();
  if (!sprint) return;
  sprint.tasks = sprint.tasks
    .map(t => ({ ...t, worked: 0, remain: t.estimate, status: "Todo" as const, doneDate: "", remainLog: [], workedLog: [] }));
  sprint.scopeDrops = [];
  sprint.today = getProjectToday();
  save();
  onChange(H_ALL);
};

export const deleteActiveSprint = (): void => {
  const sprint = getActiveSprint();
  if (!sprint) return;
  const sortedIndex = state.sprints.findIndex((s) => s.id === sprint.id) + 1;
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
  const task = sprint.tasks.find((t) => t.id === taskId);
  if (!task || task.worked > 0) return;
  const removedDate = getProjectToday();
  const isPlanned = !task.addedDate || task.addedDate < sprint.startDate;
  if (isPlanned) {
    if (!sprint.scopeDrops) sprint.scopeDrops = [];
    sprint.scopeDrops.push({
      addedDate: task.addedDate || sprint.startDate,
      removedDate,
      estimate: task.estimate ?? 0,
      taskId: task.taskId,
      name: task.name,
    } as ScopeDrop);
  }
  sprint.tasks = sprint.tasks.filter((t) => t.id !== taskId);
  save();
  onChange(H_SPRINT_TASKS);
};

export const moveTaskToSprint = (taskId: string, targetSprintId: string): void => {
  const sprint = getActiveSprint();
  if (!sprint) return;
  const task = sprint.tasks.find((t) => t.id === taskId);
  if (!task || task.worked > 0) return;
  const targetSprint = state.sprints.find((s) => s.id === targetSprintId);
  if (!targetSprint) return;

  // Create ScopeDrop in current sprint (same logic as removeTaskFromSprint)
  const removedDate = getProjectToday();
  const isPlanned = !task.addedDate || task.addedDate < sprint.startDate;
  if (isPlanned) {
    if (!sprint.scopeDrops) sprint.scopeDrops = [];
    sprint.scopeDrops.push({
      addedDate: task.addedDate || sprint.startDate,
      removedDate,
      estimate: task.estimate ?? 0,
      taskId: task.taskId,
      name: task.name,
    } as ScopeDrop);
  }

  // Remove from current sprint
  sprint.tasks = sprint.tasks.filter((t) => t.id !== taskId);

  // Add to target sprint as a planned task (no addedDate → treated as originally planned)
  const estimate = task.estimate ?? 0;
  targetSprint.tasks.push({
    id: createId(),
    backlogTaskId: task.backlogTaskId,
    taskId: task.taskId,
    name: task.name,
    assignedTo: task.assignedTo,
    estimate,
    worked: 0,
    remain: estimate,
    status: "Todo",
    doneDate: "",
    remainLog: [],
    workedLog: [],
  });
  save();
  onChange(H_SPRINT_TASKS);
};

export const splitTaskToSprint = (taskId: string, targetSprintId: string): void => {
  const sprint = getActiveSprint();
  if (!sprint) return;
  const task = sprint.tasks.find((t) => t.id === taskId);
  if (!task || task.worked === 0 || task.remain === 0) return;
  const targetSprint = state.sprints.find((s) => s.id === targetSprintId);
  if (!targetSprint) return;

  const today = getProjectToday();
  const originalRemain = task.remain;
  const originalTaskId = task.taskId;

  // Update original task: suffix 'a', remain → 0, status → Done
  const newRemainLog = [
    ...(task.remainLog ?? []).filter((e) => e.date !== today),
    { date: today, remain: 0 },
  ];
  Object.assign(task, {
    taskId: originalTaskId ? `${originalTaskId}a` : task.taskId,
    remain: 0,
    status: "Done" as const,
    doneDate: today,
    remainLog: newRemainLog,
  });

  // Add new task (suffix 'b') to target sprint as planned
  targetSprint.tasks.push({
    id: createId(),
    backlogTaskId: task.backlogTaskId,
    taskId: originalTaskId ? `${originalTaskId}b` : undefined,
    name: task.name,
    assignedTo: task.assignedTo,
    estimate: originalRemain,
    worked: 0,
    remain: originalRemain,
    status: "Todo",
    doneDate: "",
    remainLog: [],
    workedLog: [],
  });
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

  // If this task was previously removed (matching ScopeDrop exists), cancel the drop
  // and restore its original addedDate — net effect is as if nothing happened.
  const drops = sprint.scopeDrops ?? [];
  let dropIdx = -1;
  for (let i = drops.length - 1; i >= 0; i--) {
    const d = drops[i];
    if ((foundTask.taskId && d.taskId === foundTask.taskId) || d.name === foundTask.description) {
      dropIdx = i;
      break;
    }
  }
  const addedDate = dropIdx >= 0 ? drops[dropIdx].addedDate : getProjectToday();
  if (dropIdx >= 0) sprint.scopeDrops!.splice(dropIdx, 1);

  const estimate = Number(foundTask.estimate) || 0;
  sprint.tasks.push({
    id: createId(), backlogTaskId,
    taskId: foundTask.taskId,
    name: foundTask.description,
    assignedTo: foundTask.assignedTo.join(", "),
    estimate,
    worked: 0,
    remain: estimate,
    status: "Todo", doneDate: "",
    remainLog: [],
    workedLog: [],
    addedDate,
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
  onChange(H_HEADER | H_TASKS | H_STATS | H_CHART);
};

export const getProjectToday = (): string => state.projectToday || todayIso();

export const finalizeSprintPlan = (): void => {
  const sprint = getActiveSprint();
  if (!sprint) return;
  sprint.plannedPoints = sprint.tasks.reduce((sum, t) => sum + Number(t.estimate || 0), 0);
  save();
  onChange(H_CHART);
};

export const setProjectToday = (date: string): void => {
  if (!date) return;
  state.projectToday = date;
  const holidaySet = new Set(state.preferences.holidays.map(h => h.date));
  const workWeekendSet = new Set(state.preferences.workWeekends);
  for (const sprint of state.sprints) {
    if (sprint.endDate < date) {
      sprint.today = getNextWorkingDay(sprint.endDate, holidaySet, workWeekendSet);
    } else if (sprint.startDate > date) {
      sprint.today = sprint.startDate;
    } else {
      sprint.today = date;
    }
  }
  save();
  onChange(H_ALL);
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
  save(); onChange(H_BACKLOG_DATA | H_TASKS);
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
    assignedTo: [],
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
      t.assignedTo = bt.assignedTo.join(", ");
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

// Runtime-only (not persisted): email→name and name→email pairs for the current team.
// Set by main.ts after loading Firebase Auth profiles.
let _memberPairs: { email: string; name: string }[] = [];

export const setMemberPairs = (pairs: { email: string; name: string }[]): void => {
  _memberPairs = pairs;
};

export const getMemberPairs = (): { email: string; name: string }[] => _memberPairs;

export const emailToName = (email: string): string =>
  _memberPairs.find((p) => p.email === email)?.name ?? email;

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

export const replaceMembers = (names: string[]): void => {
  state.preferences.members = [...names].sort((a, b) => a.localeCompare(b));
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
