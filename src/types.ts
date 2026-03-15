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
  assignedTo: string[];
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

// --- Multi-user types ---

export type UserRole = "super_manager" | "product_manager" | "member";

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  phoneNumber?: string;
  role: UserRole;
  groupId?: string;
  createdAt: string;
  photoThumb?: string;
  photoFull?: string;
}

export interface Team {
  id: string;
  name: string;
  ownerId: string;
  memberIds: string[];
  groupId: string;
  createdAt: string;
}

export interface Group {
  id: string;
  name: string;
  ownerId: string;
  createdAt: string;
}

export interface Invitation {
  email: string;
  groupId: string;
  teamIds: string[];
  invitedBy: string;
  status: "pending" | "accepted" | "declined" | "cancelled";
  createdAt: string;
  expiresAt: string;
}

export interface PmRequest {
  email: string;
  displayName: string;
  groupName: string;
  organization: string;
  description: string;
  status: "pending" | "approved" | "rejected";
  createdAt: string;
  reviewedBy?: string;
  reviewedAt?: string;
}
