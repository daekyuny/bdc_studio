export type TaskStatus = "Todo" | "In Progress" | "Done";

export interface RemainEntry {
  date: string;
  remain: number;
}

export interface WorkedEntry {
  date: string;
  worked: number;
}

export interface SprintTask {
  id: string;
  backlogTaskId?: string;
  taskId?: string;
  name: string;
  assignedTo?: string;
  estimate: number;
  worked: number;
  remain: number;
  status: TaskStatus;
  doneDate: string;
  remainLog?: RemainEntry[];
  workedLog?: WorkedEntry[];
  addedDate?: string;
}

export interface ScopeDrop {
  addedDate: string;
  removedDate: string;
  estimate: number;
  taskId?: string;
  name: string;
}

export interface ScopeDropMarker {
  dateIndex: number;
  label: string;
}

export interface Sprint {
  id: string;
  description: string;
  startDate: string;
  endDate: string;
  today?: string;
  developers: number;
  efficiency: number;
  plannedPoints?: number;
  tasks: SprintTask[];
  scopeDrops?: ScopeDrop[];
  createdAt: string;
}

export interface BacklogTask {
  id: string;
  taskId: string;
  description: string;
  estimate: number;
  assignedTo: string;
}

export interface BacklogStory {
  id: string;
  storyId: string;
  description: string;
  priority: number;
  tasks: BacklogTask[];
}

export interface Backlog {
  stories: BacklogStory[];
}

export interface Holiday {
  date: string;
  name: string;
}

export interface Preferences {
  holidays: Holiday[];
  workWeekends: string[];
  members: string[];
}

export interface AppState {
  activeSprintId: string;
  projectToday?: string;
  backlog: Backlog;
  preferences: Preferences;
  sprints: Sprint[];
}

export interface BurndownData {
  dates: string[];
  totalPoints: number;
  ideal: number[];
  actual: (number | null)[];
  scope: (number | null)[];
  scopeDropMarkers: ScopeDropMarker[];
  manDays: number;
  effectiveManDays: number;
  idealDailyBurn: number;
  todayIndex: number;
}

export interface SortState {
  key: string | null;
  asc: boolean;
}

export interface GapInfo {
  after: Sprint;
  before: Sprint;
}
