"use strict";
(() => {
  // src/dom.ts
  var $ = (id) => document.getElementById(id);
  var dom = {
    mainLayout: $("mainLayout"),
    sprintSubHeader: $("sprintSubHeader"),
    sprintList: $("sprintList"),
    projectTodayInput: $("projectTodayInput"),
    newSprintBtn: $("newSprintBtn"),
    resetSprintBtn: $("resetSprintBtn"),
    deleteSprintBtn: $("deleteSprintBtn"),
    sprintTitleText: $("sprintTitleText"),
    editSprintBtn: $("editSprintBtn"),
    summaryDuration: $("summaryDuration"),
    efficiencyDisplay: $("efficiencyDisplay"),
    taskRows: $("taskRows"),
    totalPoints: $("totalPoints"),
    remainingPoints: $("remainingPoints"),
    workingDays: $("workingDays"),
    doneTasks: $("doneTasks"),
    availableDays: $("availableDays"),
    availableDaysValue: $("availableDaysValue"),
    progressPercent: $("progressPercent"),
    progressBarFill: $("progressBarFill"),
    chart: $("burndownChart"),
    showDayNumbers: $("showDayNumbers"),
    exportCsvBtn: document.getElementById("exportCsvBtn"),
    exportBtn: $("exportBtn"),
    importBtn: $("importBtn"),
    importFile: $("importFile"),
    sprintModal: $("sprintModal"),
    modalTitle: $("modalTitle"),
    modalDescription: $("modalDescription"),
    modalStartDate: $("modalStartDate"),
    modalWorkingDays: $("modalWorkingDays"),
    modalManDays: $("modalManDays"),
    modalEndDate: $("modalEndDate"),
    modalDevelopers: $("modalDevelopers"),
    modalEfficiency: $("modalEfficiency"),
    modalError: $("modalError"),
    modalSave: $("modalSave"),
    modalCancel: $("modalCancel"),
    modalClose: $("modalClose"),
    sprintItemTemplate: $("sprintItemTemplate"),
    taskRowTemplate: $("taskRowTemplate"),
    // Tabs
    tabSprint: $("tabSprint"),
    tabBacklog: $("tabBacklog"),
    sprintView: $("sprintView"),
    backlogView: $("backlogView"),
    // Sprint task card — add-by-ID
    addByIdInput: $("addByIdInput"),
    addByIdBtn: $("addByIdBtn"),
    // Backlog panel (sprint view, drag-to-add)
    backlogPanel: $("backlogPanel"),
    backlogPanelToggle: $("backlogPanelToggle"),
    backlogPanelRows: $("backlogPanelRows"),
    backlogPanelRowTemplate: $("backlogPanelRowTemplate"),
    // Backlog view
    backlogExpandAllBtn: $("backlogExpandAllBtn"),
    backlogCollapseAllBtn: $("backlogCollapseAllBtn"),
    backlogAddStoryBtn: $("backlogAddStoryBtn"),
    backlogImportCsvBtn: $("backlogImportCsvBtn"),
    backlogExportCsvBtn: $("backlogExportCsvBtn"),
    backlogDeleteAllBtn: $("backlogDeleteAllBtn"),
    backlogImportFile: $("backlogImportFile"),
    backlogTableBody: $("backlogTableBody"),
    backlogStoryRowTemplate: $("backlogStoryRowTemplate"),
    backlogTaskRowTemplate: $("backlogTaskRowTemplate"),
    // Sprint Planning Modal
    sprintPlanModal: $("sprintPlanModal"),
    sprintPlanTitle: $("sprintPlanTitle"),
    sprintPlanClose: $("sprintPlanClose"),
    sprintPlanDone: $("sprintPlanDone"),
    planStatDuration: $("planStatDuration"),
    planStatWorkingDays: $("planStatWorkingDays"),
    planStatTotalPoints: $("planStatTotalPoints"),
    planStatAvailableDays: $("planStatAvailableDays"),
    planTaskRows: $("planTaskRows"),
    planBacklogRows: $("planBacklogRows"),
    planTaskRowTemplate: $("planTaskRowTemplate"),
    // Delete Sprint confirm dialog
    confirmDeleteSprintModal: $("confirmDeleteSprintModal"),
    confirmDeleteSprintName: $("confirmDeleteSprintName"),
    confirmDeleteSprintCancel: $("confirmDeleteSprintCancel"),
    confirmDeleteSprintConfirm: $("confirmDeleteSprintConfirm"),
    // Reset Sprint confirm dialog
    confirmResetSprintModal: $("confirmResetSprintModal"),
    confirmResetSprintName: $("confirmResetSprintName"),
    confirmResetSprintCancel: $("confirmResetSprintCancel"),
    confirmResetSprintConfirm: $("confirmResetSprintConfirm"),
    // Backlog "Clear All" confirm dialog
    confirmDeleteBacklogModal: $("confirmDeleteBacklogModal"),
    confirmDeleteBacklogCancel: $("confirmDeleteBacklogCancel"),
    confirmDeleteBacklogConfirm: $("confirmDeleteBacklogConfirm"),
    // Task remove confirm dialog
    confirmRemoveTaskModal: $("confirmRemoveTaskModal"),
    confirmRemoveTaskName: $("confirmRemoveTaskName"),
    confirmRemoveTaskCancel: $("confirmRemoveTaskCancel"),
    confirmRemoveTaskConfirm: $("confirmRemoveTaskConfirm"),
    // Import confirm dialog (reusable)
    importConfirmModal: $("importConfirmModal"),
    importConfirmTitle: $("importConfirmTitle"),
    importConfirmMessage: $("importConfirmMessage"),
    importConfirmSubtext: $("importConfirmSubtext"),
    importConfirmCancel: $("importConfirmCancel"),
    importConfirmOk: $("importConfirmOk"),
    // Preferences modal
    settingsBtn: $("settingsBtn"),
    preferencesModal: $("preferencesModal"),
    prefClose: $("prefClose"),
    prefDone: $("prefDone"),
    prefHolidayDate: $("prefHolidayDate"),
    prefHolidayName: $("prefHolidayName"),
    prefHolidayAddBtn: $("prefHolidayAddBtn"),
    prefHolidayList: $("prefHolidayList"),
    prefWeekendDate: $("prefWeekendDate"),
    prefWeekendAddBtn: $("prefWeekendAddBtn"),
    prefWeekendList: $("prefWeekendList"),
    // Members
    prefMemberName: $("prefMemberName"),
    prefMemberAddBtn: $("prefMemberAddBtn"),
    prefMemberList: $("prefMemberList")
  };

  // src/utils.ts
  var localIso = (date) => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  };
  var todayIso = () => localIso(/* @__PURE__ */ new Date());
  var toShortDate = (isoDate) => {
    if (!isoDate) return "";
    const date = /* @__PURE__ */ new Date(isoDate + "T00:00:00");
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    return `${m}/${d}`;
  };
  var getWorkingDates = (startIso, endIso, holidays, workWeekends) => {
    if (!startIso || !endIso) return [];
    const dates = [];
    const cursor = /* @__PURE__ */ new Date(startIso + "T00:00:00");
    const end = /* @__PURE__ */ new Date(endIso + "T00:00:00");
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
  var formatSprintRange = (sprint) => `${toShortDate(sprint.startDate)} \u2013 ${toShortDate(sprint.endDate)}`;
  var createId = () => crypto.randomUUID();
  var getNextWorkingDay = (isoDate, holidays, workWeekends) => {
    const d = /* @__PURE__ */ new Date(isoDate + "T00:00:00");
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
  var addWorkingDays = (isoDate, n, holidays, workWeekends) => {
    const d = /* @__PURE__ */ new Date(isoDate + "T00:00:00");
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
  var findGaps = (sprints) => {
    const gaps = [];
    for (let i = 0; i < sprints.length - 1; i++) {
      const nextWorking = getNextWorkingDay(sprints[i].endDate);
      if (nextWorking < sprints[i + 1].startDate) {
        gaps.push({ after: sprints[i], before: sprints[i + 1] });
      }
    }
    return gaps;
  };

  // src/state.ts
  var H_SIDEBAR = 1;
  var H_HEADER = 2;
  var H_TASKS = 4;
  var H_PANEL = 8;
  var H_STATS = 16;
  var H_CHART = 32;
  var H_BACKLOG = 64;
  var H_ALL = 127;
  var H_SPRINT_TASKS = H_TASKS | H_PANEL | H_STATS | H_CHART;
  var H_BACKLOG_DATA = H_BACKLOG | H_PANEL;
  var STORAGE_KEY = "burndown-studio";
  var onChange = () => {
  };
  var setOnStateChange = (callback) => {
    onChange = callback;
  };
  var sortSprints = () => {
    state.sprints.sort((a, b) => a.startDate.localeCompare(b.startDate));
  };
  var migrateState = (parsed) => {
    if (!parsed.backlog) parsed.backlog = { stories: [] };
    if (!parsed.preferences) parsed.preferences = { holidays: [], workWeekends: [], members: [] };
    if (!parsed.projectToday) parsed.projectToday = todayIso();
    for (const sprint of parsed.sprints) {
      delete sprint.locked;
      delete sprint.lockedAt;
      delete sprint.lockedBaseline;
      for (const task of sprint.tasks) {
        if (task.points !== void 0 && task.estimate === void 0) {
          task.estimate = task.points;
          delete task.points;
        }
        if (task.worked === void 0) {
          const old = task.actual ?? null;
          if (task.status === "Done") {
            task.worked = old != null ? old : task.estimate ?? 0;
            task.remain = 0;
          } else {
            task.worked = 0;
            task.remain = task.estimate ?? 0;
          }
          delete task.actual;
        }
        if (!task.remainLog) task.remainLog = [];
        if (!task.workedLog) task.workedLog = [];
        if (task.removedDate) {
          const removedDate = task.removedDate;
          if (task.worked === 0) {
            if (!task.addedDate || task.addedDate < sprint.startDate) {
              if (!sprint.scopeDrops) sprint.scopeDrops = [];
              sprint.scopeDrops.push({
                addedDate: task.addedDate || sprint.startDate,
                removedDate,
                estimate: task.estimate ?? 0,
                taskId: task.taskId,
                name: task.name
              });
              task._delete = true;
            } else {
              task._delete = true;
            }
          }
          delete task.removedDate;
        }
      }
      sprint.tasks = sprint.tasks.filter((t) => !t._delete);
    }
    return parsed;
  };
  var defaultState = () => {
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
          createdAt: (/* @__PURE__ */ new Date()).toISOString()
        }
      ]
    };
  };
  var loadState = () => {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultState();
    try {
      const parsed = JSON.parse(raw);
      if (!parsed || !Array.isArray(parsed.sprints)) return defaultState();
      const appState = migrateState(parsed);
      const today = todayIso();
      appState.projectToday = today;
      const holidaySet = new Set(appState.preferences.holidays.map((h) => h.date));
      const workWeekendSet = new Set(appState.preferences.workWeekends);
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
    } catch {
      console.warn("Burndown Studio: corrupt localStorage data, resetting to defaults.");
      localStorage.removeItem(STORAGE_KEY);
      return defaultState();
    }
  };
  var save = () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  };
  var state = loadState();
  var getState = () => state;
  var getActiveSprint = () => state.sprints.find((sprint) => sprint.id === state.activeSprintId);
  var setActiveSprint = (id) => {
    state.activeSprintId = id;
    save();
    onChange(H_ALL);
  };
  var createSprint = ({ description, startDate, endDate, developers, efficiency }) => {
    const newSprint = {
      id: createId(),
      description: description || "",
      startDate,
      endDate,
      developers,
      efficiency,
      tasks: [],
      createdAt: (/* @__PURE__ */ new Date()).toISOString()
    };
    state.sprints.push(newSprint);
    sortSprints();
    state.activeSprintId = newSprint.id;
    save();
    onChange(H_ALL);
  };
  var updateSprintById = (id, updates) => {
    const sprint = state.sprints.find((s) => s.id === id);
    if (!sprint) return;
    Object.assign(sprint, updates);
    sortSprints();
    save();
    onChange(H_SIDEBAR | H_HEADER | H_STATS | H_CHART);
  };
  var resetActiveSprint = () => {
    const sprint = getActiveSprint();
    if (!sprint) return;
    sprint.tasks = sprint.tasks.map((t) => ({ ...t, worked: 0, remain: t.estimate, status: "Todo", doneDate: "", remainLog: [], workedLog: [] }));
    sprint.scopeDrops = [];
    sprint.today = getProjectToday();
    save();
    onChange(H_ALL);
  };
  var deleteActiveSprint = () => {
    const sprint = getActiveSprint();
    if (!sprint) return;
    const sortedIndex = state.sprints.findIndex((s) => s.id === sprint.id) + 1;
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
        createdAt: (/* @__PURE__ */ new Date()).toISOString()
      };
      state.sprints = [newSprint];
      state.activeSprintId = newSprint.id;
    } else {
      state.activeSprintId = state.sprints[0].id;
    }
    save();
    onChange(H_ALL);
  };
  var reorderTasks = (taskIds) => {
    const sprint = getActiveSprint();
    if (!sprint) return;
    const taskMap = new Map(sprint.tasks.map((t) => [t.id, t]));
    const reordered = taskIds.map((id) => taskMap.get(id)).filter((t) => Boolean(t));
    for (const t of sprint.tasks) {
      if (!taskIds.includes(t.id)) reordered.push(t);
    }
    sprint.tasks = reordered;
    save();
    onChange(H_TASKS);
  };
  var updateTask = (taskId, updates) => {
    const sprint = getActiveSprint();
    if (!sprint) return;
    const task = sprint.tasks.find((item) => item.id === taskId);
    if (!task) return;
    Object.assign(task, updates);
    save();
    onChange(H_SPRINT_TASKS);
  };
  var removeTaskFromSprint = (taskId) => {
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
        name: task.name
      });
    }
    sprint.tasks = sprint.tasks.filter((t) => t.id !== taskId);
    save();
    onChange(H_SPRINT_TASKS);
  };
  var addTaskFromBacklog = (backlogTaskId) => {
    const sprint = getActiveSprint();
    if (!sprint) return;
    let foundTask = null;
    for (const story of state.backlog.stories) {
      for (const t of story.tasks) {
        if (t.id === backlogTaskId) {
          foundTask = t;
          break;
        }
      }
      if (foundTask) break;
    }
    if (!foundTask) return;
    if (sprint.tasks.some((t) => t.backlogTaskId === backlogTaskId)) return;
    const drops = sprint.scopeDrops ?? [];
    let dropIdx = -1;
    for (let i = drops.length - 1; i >= 0; i--) {
      const d = drops[i];
      if (foundTask.taskId && d.taskId === foundTask.taskId || d.name === foundTask.description) {
        dropIdx = i;
        break;
      }
    }
    const addedDate = dropIdx >= 0 ? drops[dropIdx].addedDate : getProjectToday();
    if (dropIdx >= 0) sprint.scopeDrops.splice(dropIdx, 1);
    const estimate = Number(foundTask.estimate) || 0;
    sprint.tasks.push({
      id: createId(),
      backlogTaskId,
      taskId: foundTask.taskId,
      name: foundTask.description,
      assignedTo: foundTask.assignedTo,
      estimate,
      worked: 0,
      remain: estimate,
      status: "Todo",
      doneDate: "",
      remainLog: [],
      workedLog: [],
      addedDate
    });
    save();
    onChange(H_SPRINT_TASKS);
  };
  var updateToday = (date) => {
    const sprint = getActiveSprint();
    if (!sprint || !date) return;
    const maxDate = sprint.endDate ? getNextWorkingDay(sprint.endDate) : sprint.endDate;
    const clamped = date < sprint.startDate ? sprint.startDate : date > maxDate ? maxDate : date;
    sprint.today = clamped;
    save();
    onChange(H_HEADER | H_TASKS | H_STATS | H_CHART);
  };
  var getProjectToday = () => state.projectToday || todayIso();
  var finalizeSprintPlan = () => {
    const sprint = getActiveSprint();
    if (!sprint) return;
    sprint.plannedPoints = sprint.tasks.reduce((sum, t) => sum + Number(t.estimate || 0), 0);
    save();
    onChange(H_CHART);
  };
  var setProjectToday = (date) => {
    if (!date) return;
    state.projectToday = date;
    const holidaySet = new Set(state.preferences.holidays.map((h) => h.date));
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
  var replaceState = (newState) => {
    state = newState;
    save();
    onChange(H_ALL);
  };
  var patchActiveSprint = (fields) => {
    const sprint = getActiveSprint();
    if (!sprint) return false;
    let changed = false;
    for (const [key, value] of Object.entries(fields)) {
      if (sprint[key] === void 0 || sprint[key] === null) {
        sprint[key] = value;
        changed = true;
      }
    }
    if (changed) save();
    return changed;
  };
  var getBacklog = () => state.backlog;
  var addStory = () => {
    const id = createId();
    const storyNum = state.backlog.stories.length + 1;
    state.backlog.stories.push({
      id,
      storyId: `${storyNum}`,
      description: "",
      priority: 100,
      tasks: []
    });
    save();
    onChange(H_BACKLOG_DATA);
    return id;
  };
  var updateStory = (id, updates) => {
    const story = state.backlog.stories.find((s) => s.id === id);
    if (!story) return;
    Object.assign(story, updates);
    save();
    onChange(H_BACKLOG_DATA | H_TASKS);
  };
  var deleteStory = (id) => {
    state.backlog.stories = state.backlog.stories.filter((s) => s.id !== id);
    save();
    onChange(H_BACKLOG_DATA);
  };
  var addBacklogTask = (storyId) => {
    const story = state.backlog.stories.find((s) => s.id === storyId);
    if (!story) return null;
    const id = createId();
    const taskNum = story.tasks.length + 1;
    story.tasks.push({
      id,
      taskId: `${story.storyId}.${taskNum}`,
      description: "",
      estimate: 0,
      assignedTo: ""
    });
    save();
    onChange(H_BACKLOG_DATA);
    return id;
  };
  var updateBacklogTask = (storyId, taskId, updates) => {
    const story = state.backlog.stories.find((s) => s.id === storyId);
    if (!story) return;
    const task = story.tasks.find((t) => t.id === taskId);
    if (!task) return;
    Object.assign(task, updates);
    save();
    onChange(H_BACKLOG_DATA);
  };
  var deleteBacklogTask = (storyId, taskId) => {
    const story = state.backlog.stories.find((s) => s.id === storyId);
    if (!story) return;
    story.tasks = story.tasks.filter((t) => t.id !== taskId);
    save();
    onChange(H_BACKLOG_DATA);
  };
  var replaceBacklog = (newBacklog) => {
    state.backlog = newBacklog;
    save();
    onChange(H_ALL);
  };
  var findOrphanedSprintTasks = (newStories) => {
    const incomingIds = /* @__PURE__ */ new Set();
    for (const story of newStories)
      for (const task of story.tasks)
        if (task.taskId) incomingIds.add(task.taskId);
    const orphans = [];
    for (const sprint of state.sprints) {
      const idx = state.sprints.indexOf(sprint) + 1;
      for (const task of sprint.tasks) {
        if (task.taskId && !incomingIds.has(task.taskId))
          orphans.push({ sprintIndex: idx, taskId: task.taskId, name: task.name });
      }
    }
    return orphans;
  };
  var relinkSprintTasks = () => {
    const taskIdMap = /* @__PURE__ */ new Map();
    for (const story of state.backlog.stories)
      for (const task of story.tasks)
        if (task.taskId) taskIdMap.set(task.taskId, task);
    for (const sprint of state.sprints) {
      sprint.tasks = sprint.tasks.filter((t) => {
        const bt = taskIdMap.get(t.taskId);
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
  var getPreferences = () => state.preferences;
  var addHoliday = (date, name) => {
    if (state.preferences.holidays.some((h) => h.date === date)) return;
    state.preferences.holidays.push({ date, name });
    state.preferences.holidays.sort((a, b) => a.date.localeCompare(b.date));
    save();
    onChange(H_ALL);
  };
  var removeHoliday = (date) => {
    state.preferences.holidays = state.preferences.holidays.filter((h) => h.date !== date);
    save();
    onChange(H_ALL);
  };
  var addWorkWeekend = (date) => {
    if (state.preferences.workWeekends.includes(date)) return;
    state.preferences.workWeekends.push(date);
    state.preferences.workWeekends.sort();
    save();
    onChange(H_ALL);
  };
  var removeWorkWeekend = (date) => {
    state.preferences.workWeekends = state.preferences.workWeekends.filter((d) => d !== date);
    save();
    onChange(H_ALL);
  };
  var getMembers = () => state.preferences.members;
  var addMember = (name) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    if (state.preferences.members.includes(trimmed)) return;
    state.preferences.members.push(trimmed);
    state.preferences.members.sort((a, b) => a.localeCompare(b));
    save();
    onChange(H_ALL);
  };
  var removeMember = (name) => {
    state.preferences.members = state.preferences.members.filter((m) => m !== name);
    save();
    onChange(H_ALL);
  };
  var addMembersFromImport = (names) => {
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
      save();
      onChange(H_ALL);
    }
  };

  // src/burndown.ts
  var getWorkedAtDate = (task, date) => {
    const log = task.workedLog;
    if (!log || log.length === 0) return task.worked ?? 0;
    let best;
    for (const entry of log) {
      if (entry.date <= date && (!best || entry.date >= best.date)) best = entry;
    }
    return best !== void 0 ? best.worked : 0;
  };
  var getRemainAtDate = (task, date) => {
    if (task.doneDate && task.doneDate <= date) return 0;
    const log = task.remainLog;
    if (!log || log.length === 0) return task.remain ?? task.estimate ?? 0;
    let best;
    for (const entry of log) {
      if (entry.date <= date && (!best || entry.date >= best.date)) best = entry;
    }
    return best !== void 0 ? best.remain : task.estimate ?? 0;
  };
  var calculateBurndown = (sprint, today, holidays, workWeekends) => {
    const dates = getWorkingDates(sprint.startDate, sprint.endDate, holidays, workWeekends);
    const totalPoints = sprint.tasks.reduce((sum, task) => sum + Number(task.estimate || 0), 0);
    const plannedPoints = sprint.plannedPoints ?? totalPoints;
    const workingDays = dates.length || 0;
    const developers = Math.max(0, Number(sprint.developers || 0));
    const efficiency = Math.min(1, Math.max(0, Number(sprint.efficiency || 0)));
    const manDays = developers * workingDays;
    const effectiveManDays = manDays * efficiency;
    const idealDailyBurn = workingDays > 0 ? effectiveManDays / workingDays : 0;
    const ideal = dates.map((_, index) => {
      if (dates.length <= 1) return plannedPoints;
      const remaining = plannedPoints - idealDailyBurn * index;
      return Math.round(Math.max(remaining, 0) * 100) / 100;
    });
    const todayIndex = dates.reduce((last, date, i) => date <= today ? i : last, -1);
    const taskActiveAt = (task, date) => !task.addedDate || task.addedDate <= date;
    const scopeDropContribAt = (date) => (sprint.scopeDrops ?? []).filter((d) => d.addedDate <= date && d.removedDate > date).reduce((sum, d) => sum + d.estimate, 0);
    const actual = dates.map((date, i) => {
      if (todayIndex < 0 || i > todayIndex) return null;
      const taskPart = sprint.tasks.filter((t) => taskActiveAt(t, date)).reduce((sum, task) => sum + getRemainAtDate(task, date), 0);
      return taskPart + scopeDropContribAt(date);
    });
    const scope = dates.map((date, i) => {
      if (todayIndex < 0 || i > todayIndex) return null;
      const taskPart = sprint.tasks.filter((t) => taskActiveAt(t, date)).reduce((sum, task) => sum + getWorkedAtDate(task, date) + getRemainAtDate(task, date), 0);
      return taskPart + scopeDropContribAt(date);
    });
    const markerMap = /* @__PURE__ */ new Map();
    for (const drop of sprint.scopeDrops ?? []) {
      const idx = dates.indexOf(drop.removedDate);
      if (idx < 0 || idx > todayIndex) continue;
      const label = `${drop.taskId ? `[${drop.taskId}] ` : ""}${drop.name} (\u2212${drop.estimate})`;
      if (!markerMap.has(idx)) markerMap.set(idx, []);
      markerMap.get(idx).push(label);
    }
    const scopeDropMarkers = Array.from(markerMap.entries()).map(([dateIndex, labels]) => ({ dateIndex, label: labels.join("\n") }));
    return { dates, totalPoints, ideal, actual, scope, scopeDropMarkers, manDays, effectiveManDays, idealDailyBurn, todayIndex };
  };

  // src/chart.ts
  var drawChart = ({ dates, totalPoints, ideal, actual, scope, scopeDropMarkers, todayIndex }, onDateClick, browseIndex, showTodayLabel) => {
    const width = 800;
    const height = 320;
    const padding = 50;
    dom.chart.setAttribute("viewBox", `0 0 ${width} ${height}`);
    dom.chart.innerHTML = "";
    if (!dates.length) {
      const emptyText = document.createElementNS("http://www.w3.org/2000/svg", "text");
      emptyText.setAttribute("x", String(width / 2));
      emptyText.setAttribute("y", String(height / 2));
      emptyText.setAttribute("text-anchor", "middle");
      emptyText.setAttribute("fill", "#6b7080");
      emptyText.textContent = "Set sprint dates to see the chart.";
      dom.chart.appendChild(emptyText);
      return;
    }
    const nonNullActual = actual.filter((v) => v !== null);
    const nonNullScope = scope.filter((v) => v !== null);
    const maxValue = Math.max(totalPoints, ...nonNullActual, ...nonNullScope, 1);
    const minValue = Math.min(0, ...nonNullActual);
    const range = maxValue - minValue;
    const plotWidth = width - padding * 2;
    const plotHeight = height - padding * 2;
    const toPoint = (value, index) => {
      const x = padding + plotWidth * (dates.length === 1 ? 0 : index / (dates.length - 1));
      const y = padding + plotHeight * (1 - (value - minValue) / range);
      return `${x},${y}`;
    };
    const grid = document.createElementNS("http://www.w3.org/2000/svg", "g");
    grid.setAttribute("stroke", "rgba(44, 47, 58, 0.1)");
    for (let i = 0; i <= 4; i++) {
      const y = padding + plotHeight * (i / 4);
      const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
      line.setAttribute("x1", String(padding));
      line.setAttribute("x2", String(width - padding));
      line.setAttribute("y1", String(y));
      line.setAttribute("y2", String(y));
      grid.appendChild(line);
      const label = document.createElementNS("http://www.w3.org/2000/svg", "text");
      label.setAttribute("x", "14");
      label.setAttribute("y", String(y + 4));
      label.setAttribute("fill", "#6b7080");
      label.setAttribute("font-size", "11");
      label.textContent = String(Math.round(maxValue - range * (i / 4)));
      dom.chart.appendChild(label);
    }
    dom.chart.appendChild(grid);
    if (minValue < 0) {
      const zeroY = padding + plotHeight * (1 - (0 - minValue) / range);
      const zeroLine = document.createElementNS("http://www.w3.org/2000/svg", "line");
      zeroLine.setAttribute("x1", String(padding));
      zeroLine.setAttribute("x2", String(width - padding));
      zeroLine.setAttribute("y1", String(zeroY));
      zeroLine.setAttribute("y2", String(zeroY));
      zeroLine.setAttribute("stroke", "rgba(44, 47, 58, 0.3)");
      zeroLine.setAttribute("stroke-width", "1.5");
      zeroLine.setAttribute("stroke-dasharray", "4 3");
      dom.chart.appendChild(zeroLine);
    }
    const effectiveBrowseIndex = browseIndex !== void 0 ? browseIndex : todayIndex;
    if (effectiveBrowseIndex >= 0 && effectiveBrowseIndex !== todayIndex) {
      const bx = padding + plotWidth * (dates.length === 1 ? 0 : effectiveBrowseIndex / (dates.length - 1));
      const browseLine = document.createElementNS("http://www.w3.org/2000/svg", "line");
      browseLine.setAttribute("x1", String(bx));
      browseLine.setAttribute("x2", String(bx));
      browseLine.setAttribute("y1", String(padding));
      browseLine.setAttribute("y2", String(height - padding));
      browseLine.setAttribute("stroke", "rgba(107, 114, 128, 0.5)");
      browseLine.setAttribute("stroke-width", "1.5");
      browseLine.setAttribute("stroke-dasharray", "4 3");
      dom.chart.appendChild(browseLine);
    }
    if (todayIndex >= 0) {
      const tx = padding + plotWidth * (dates.length === 1 ? 0 : todayIndex / (dates.length - 1));
      const todayLine = document.createElementNS("http://www.w3.org/2000/svg", "line");
      todayLine.setAttribute("x1", String(tx));
      todayLine.setAttribute("x2", String(tx));
      todayLine.setAttribute("y1", String(padding));
      todayLine.setAttribute("y2", String(height - padding));
      todayLine.setAttribute("stroke", "rgba(92, 103, 242, 0.45)");
      todayLine.setAttribute("stroke-width", "1.5");
      todayLine.setAttribute("stroke-dasharray", "4 3");
      dom.chart.appendChild(todayLine);
      if (showTodayLabel) {
        const todayLabel = document.createElementNS("http://www.w3.org/2000/svg", "text");
        todayLabel.setAttribute("x", String(tx + 4));
        todayLabel.setAttribute("y", String(padding + 12));
        todayLabel.setAttribute("fill", "rgba(92, 103, 242, 0.65)");
        todayLabel.setAttribute("font-size", "10");
        todayLabel.textContent = "Today";
        dom.chart.appendChild(todayLabel);
      }
    }
    const idealLine = document.createElementNS("http://www.w3.org/2000/svg", "polyline");
    idealLine.setAttribute("fill", "none");
    idealLine.setAttribute("stroke", "#3b82f6");
    idealLine.setAttribute("stroke-width", "1.5");
    idealLine.setAttribute("points", ideal.map(toPoint).join(" "));
    dom.chart.appendChild(idealLine);
    ideal.forEach((val, i) => {
      const [cx, cy] = toPoint(val, i).split(",");
      const dot = document.createElementNS("http://www.w3.org/2000/svg", "circle");
      dot.setAttribute("cx", cx);
      dot.setAttribute("cy", cy);
      dot.setAttribute("r", "3");
      dot.setAttribute("fill", "#3b82f6");
      dom.chart.appendChild(dot);
    });
    const scopePoints = scope.map((val, i) => val !== null ? toPoint(val, i) : null).filter((v) => v !== null);
    if (scopePoints.length) {
      const scopeLine = document.createElementNS("http://www.w3.org/2000/svg", "polyline");
      scopeLine.setAttribute("fill", "none");
      scopeLine.setAttribute("stroke", "#10b981");
      scopeLine.setAttribute("stroke-width", "1.5");
      scopeLine.setAttribute("stroke-dasharray", "5 3");
      scopeLine.setAttribute("points", scopePoints.join(" "));
      dom.chart.appendChild(scopeLine);
      const dropDateIndices = new Set(scopeDropMarkers.map((m) => m.dateIndex));
      scope.forEach((val, i) => {
        if (val === null) return;
        if (dropDateIndices.has(i)) return;
        const [cx, cy] = toPoint(val, i).split(",");
        const dot = document.createElementNS("http://www.w3.org/2000/svg", "circle");
        dot.setAttribute("cx", cx);
        dot.setAttribute("cy", cy);
        dot.setAttribute("r", "3");
        dot.setAttribute("fill", "#10b981");
        dom.chart.appendChild(dot);
      });
      for (const marker of scopeDropMarkers) {
        const val = scope[marker.dateIndex];
        if (val === null) continue;
        const [cxStr, cyStr] = toPoint(val, marker.dateIndex).split(",");
        const cx = Number(cxStr);
        const cy = Number(cyStr);
        const tri = document.createElementNS("http://www.w3.org/2000/svg", "polygon");
        tri.setAttribute("points", `${cx - 6},${cy - 4} ${cx + 6},${cy - 4} ${cx},${cy + 5}`);
        tri.setAttribute("fill", "#f59e0b");
        tri.setAttribute("stroke", "white");
        tri.setAttribute("stroke-width", "1");
        const title = document.createElementNS("http://www.w3.org/2000/svg", "title");
        title.textContent = `Scope drop:
${marker.label}`;
        tri.appendChild(title);
        dom.chart.appendChild(tri);
      }
    }
    const actualPoints = actual.map((val, i) => val !== null ? toPoint(val, i) : null).filter((v) => v !== null);
    const actualLine = document.createElementNS("http://www.w3.org/2000/svg", "polyline");
    actualLine.setAttribute("fill", "none");
    actualLine.setAttribute("stroke", "#ef4444");
    actualLine.setAttribute("stroke-width", "1.5");
    actualLine.setAttribute("points", actualPoints.join(" "));
    actualLine.style.strokeDasharray = "1000";
    actualLine.style.strokeDashoffset = "1000";
    actualLine.style.animation = "dash 1.6s ease forwards";
    dom.chart.appendChild(actualLine);
    actual.forEach((val, i) => {
      if (val === null) return;
      const [cx, cy] = toPoint(val, i).split(",");
      const dot = document.createElementNS("http://www.w3.org/2000/svg", "circle");
      dot.setAttribute("cx", cx);
      dot.setAttribute("cy", cy);
      dot.setAttribute("r", "3");
      dot.setAttribute("fill", "#ef4444");
      dom.chart.appendChild(dot);
    });
    const labels = document.createElementNS("http://www.w3.org/2000/svg", "g");
    labels.setAttribute("font-size", "11");
    labels.setAttribute("fill", "#6b7080");
    const showDays = dom.showDayNumbers.checked;
    dates.forEach((date, index) => {
      const x = padding + plotWidth * (dates.length === 1 ? 0 : index / (dates.length - 1));
      const isToday = index === todayIndex;
      const isBrowse = index === effectiveBrowseIndex && effectiveBrowseIndex !== todayIndex;
      const label = document.createElementNS("http://www.w3.org/2000/svg", "text");
      label.setAttribute("x", String(x));
      label.setAttribute("y", String(height - 18));
      label.setAttribute("text-anchor", "middle");
      label.setAttribute("fill", isToday ? "rgba(92, 103, 242, 0.85)" : isBrowse ? "rgba(107, 114, 128, 0.9)" : "#6b7080");
      if (isToday) label.setAttribute("font-weight", "bold");
      if (isBrowse) label.setAttribute("font-weight", "600");
      label.textContent = showDays ? `D${index}` : toShortDate(date);
      if (onDateClick) {
        label.style.cursor = "pointer";
        label.addEventListener("click", () => onDateClick(date));
      }
      labels.appendChild(label);
    });
    dom.chart.appendChild(labels);
  };

  // src/render.ts
  var fpProjectToday = null;
  var activeTab = "sprint";
  var setActiveTab = (tab) => {
    activeTab = tab;
    render();
  };
  var editingIds = /* @__PURE__ */ new Set();
  var expandedStoryIds = /* @__PURE__ */ new Set();
  var highlightBacklogTaskId = null;
  var taskSort = { key: null, asc: true };
  var backlogPanelSort = { key: null, asc: true };
  var backlogSort = { key: null, asc: true };
  var planTaskSort = { key: null, asc: true };
  var planBacklogSort = { key: null, asc: true };
  var setHighlightBacklogTaskId = (id) => {
    highlightBacklogTaskId = id;
  };
  var toggleTaskSort = (key) => {
    if (taskSort.key === key) taskSort.asc = !taskSort.asc;
    else {
      taskSort.key = key;
      taskSort.asc = true;
    }
    render(H_TASKS);
  };
  var toggleBacklogPanelSort = (key) => {
    if (backlogPanelSort.key === key) backlogPanelSort.asc = !backlogPanelSort.asc;
    else {
      backlogPanelSort.key = key;
      backlogPanelSort.asc = true;
    }
    render(H_PANEL);
  };
  var toggleBacklogSort = (key) => {
    if (backlogSort.key === key) backlogSort.asc = !backlogSort.asc;
    else {
      backlogSort.key = key;
      backlogSort.asc = true;
    }
    render(H_BACKLOG);
  };
  var togglePlanTaskSort = (key) => {
    if (planTaskSort.key === key) planTaskSort.asc = !planTaskSort.asc;
    else {
      planTaskSort.key = key;
      planTaskSort.asc = true;
    }
    render(H_TASKS);
  };
  var togglePlanBacklogSort = (key) => {
    if (planBacklogSort.key === key) planBacklogSort.asc = !planBacklogSort.asc;
    else {
      planBacklogSort.key = key;
      planBacklogSort.asc = true;
    }
    render(H_PANEL);
  };
  var NUMERIC_KEYS = /* @__PURE__ */ new Set(["estimate", "worked", "remain", "priority", "actualEst"]);
  var sortItems = (items, key, asc) => {
    if (!key) return items;
    const sorted = [...items].sort((a, b) => {
      let va = a[key] ?? "";
      let vb = b[key] ?? "";
      if (NUMERIC_KEYS.has(key)) {
        va = Number(va) || 0;
        vb = Number(vb) || 0;
        return va - vb;
      }
      return String(va).localeCompare(String(vb));
    });
    return asc ? sorted : sorted.reverse();
  };
  var startEditing = (id, focusAfter = false) => {
    if (!id) return;
    editingIds.clear();
    editingIds.add(id);
    render(H_BACKLOG);
    if (focusAfter) {
      setTimeout(() => {
        const row = dom.backlogTableBody.querySelector(`[data-id="${id}"]`);
        if (row) {
          row.scrollIntoView({ behavior: "smooth", block: "nearest" });
          row.querySelector("input")?.focus();
        }
      }, 0);
    }
  };
  var expandAll = () => {
    const backlog = getBacklog();
    for (const story of backlog.stories) expandedStoryIds.add(story.id);
    render(H_BACKLOG);
  };
  var collapseAll = () => {
    expandedStoryIds.clear();
    render(H_BACKLOG);
  };
  var renderSprintList = () => {
    dom.sprintList.innerHTML = "";
    if (activeTab === "backlog") return;
    const state2 = getState();
    state2.sprints.forEach((sprint, index) => {
      const node = dom.sprintItemTemplate.content.firstElementChild.cloneNode(true);
      node.querySelector(".sprint-label").textContent = `Sprint ${index + 1}`;
      if (sprint.id === state2.activeSprintId) node.classList.add("active");
      node.addEventListener("click", () => setActiveSprint(sprint.id));
      dom.sprintList.appendChild(node);
    });
  };
  var applySortClasses = (container, sortState) => {
    container.querySelectorAll("th.sortable").forEach((th) => {
      th.classList.remove("sort-asc", "sort-desc");
      if (th.dataset.sortKey === sortState.key) {
        th.classList.add(sortState.asc ? "sort-asc" : "sort-desc");
      }
    });
  };
  var getLogValueAt = (log, date, key, defaultVal) => {
    const entries = log.filter((e) => e.date <= date);
    if (!entries.length) return defaultVal;
    const latest = entries.reduce((a, b) => a.date >= b.date ? a : b);
    return latest[key];
  };
  var renderTasks = (sprint, holidaySet, workWeekendSet, isSprintActive) => {
    dom.taskRows.innerHTML = "";
    const taskTable = dom.taskRows.closest("table");
    if (taskTable) applySortClasses(taskTable, taskSort);
    const viewDate = sprint.today || todayIso();
    const projectTodayNow = getProjectToday();
    const isSorted = taskSort.key !== null;
    const tasks = sortItems(
      sprint.tasks.map((t) => {
        const isBeforeAdded = t.addedDate ? t.addedDate > viewDate : false;
        const histWorked = isBeforeAdded ? 0 : getLogValueAt(t.workedLog ?? [], viewDate, "worked", 0);
        const histRemain = isBeforeAdded ? t.estimate : getLogValueAt(t.remainLog ?? [], viewDate, "remain", t.estimate);
        const existsNow = !t.addedDate || t.addedDate <= projectTodayNow;
        return { ...t, actualEst: histWorked + histRemain, histWorked, histRemain, isBeforeAdded, existsNow };
      }),
      taskSort.key,
      taskSort.asc
    );
    tasks.forEach((task) => {
      const row = dom.taskRowTemplate.content.firstElementChild.cloneNode(true);
      row.dataset.taskId = task.id;
      const dragHandle = row.querySelector(".drag-handle");
      if (isSorted) {
        row.draggable = false;
        if (dragHandle) dragHandle.classList.add("drag-handle-disabled");
      } else {
        row.draggable = true;
        let dragStartedFromHandle = false;
        if (dragHandle) {
          dragHandle.addEventListener("mousedown", () => {
            dragStartedFromHandle = true;
          });
        }
        row.addEventListener("dragstart", (e) => {
          if (!dragStartedFromHandle) {
            e.preventDefault();
            return;
          }
          dragStartedFromHandle = false;
          e.dataTransfer.effectAllowed = "move";
          e.dataTransfer.setData("text/plain", task.id);
          row.classList.add("dragging");
        });
        row.addEventListener("dragend", () => {
          row.classList.remove("dragging");
          dragStartedFromHandle = false;
          dom.taskRows.querySelectorAll(".drag-over-above, .drag-over-below").forEach((el) => {
            el.classList.remove("drag-over-above", "drag-over-below");
          });
        });
      }
      if (highlightBacklogTaskId && task.backlogTaskId === highlightBacklogTaskId) {
        row.classList.add("task-row-highlight");
      }
      if (task.isBeforeAdded) {
        row.classList.add("task-row-before-added");
      }
      const taskIdSpan = row.querySelector(".task-taskid");
      const nameSpan = row.querySelector(".task-name");
      const estimateSpan = row.querySelector(".task-estimate");
      const workedView = row.querySelector(".task-worked-view");
      const workedInput = row.querySelector(".task-worked-input");
      const remainView = row.querySelector(".task-remain-view");
      const remainChangeBtn = row.querySelector(".task-remain-change");
      const remainInput = row.querySelector(".task-remain-input");
      const statusToggle = row.querySelector(".task-status-toggle");
      const doneSpan = row.querySelector(".task-done");
      const removeBtn = row.querySelector(".task-remove");
      taskIdSpan.textContent = task.taskId || "";
      nameSpan.textContent = task.name;
      let currentAssigned = task.assignedTo || "";
      let parentStoryDesc = "";
      if (task.backlogTaskId) {
        const backlog = getBacklog();
        for (const story of backlog.stories) {
          const bt = story.tasks.find((t) => t.id === task.backlogTaskId);
          if (bt) {
            currentAssigned = bt.assignedTo || "";
            parentStoryDesc = story.description || "";
            break;
          }
        }
      }
      if (parentStoryDesc) taskIdSpan.title = parentStoryDesc;
      nameSpan.title = currentAssigned;
      estimateSpan.textContent = `${task.histWorked + task.histRemain} / ${task.estimate}`;
      workedView.textContent = String(task.histWorked);
      remainView.textContent = String(task.histRemain);
      workedInput.value = String(task.histWorked);
      remainInput.value = String(task.histRemain);
      workedInput.hidden = true;
      workedView.hidden = false;
      remainInput.hidden = true;
      remainView.hidden = false;
      remainChangeBtn.hidden = !isSprintActive || !task.existsNow;
      remainChangeBtn.textContent = "Update";
      if (!task.isBeforeAdded && isSprintActive) {
        remainChangeBtn.addEventListener("click", () => {
          if (remainChangeBtn.textContent === "Update") {
            workedView.hidden = true;
            workedInput.hidden = false;
            remainView.hidden = true;
            remainInput.hidden = false;
            remainChangeBtn.textContent = "Save";
            workedInput.focus();
          } else {
            commitSave();
          }
        });
      }
      const histStatus = task.histRemain === 0 ? "Done" : task.histWorked === 0 ? "Todo" : "In Progress";
      statusToggle.textContent = histStatus;
      statusToggle.classList.remove("clickable");
      const histDoneDate = task.doneDate && task.doneDate <= viewDate ? task.doneDate : "";
      doneSpan.textContent = histDoneDate;
      const logRemain = (log, date, remain) => [
        ...log.filter((e) => e.date !== date),
        { date, remain }
      ];
      const logWorked = (log, date, worked) => [
        ...log.filter((e) => e.date !== date),
        { date, worked }
      ];
      const commitSave = () => {
        const newWorked = Math.max(0, Number(workedInput.value) || 0);
        const newRemain = Math.max(0, Number(remainInput.value) || 0);
        const logDate = getProjectToday();
        const newRemainLog = logRemain(task.remainLog ?? [], logDate, newRemain);
        const newWorkedLog = logWorked(task.workedLog ?? [], logDate, newWorked);
        const latestWorked = newWorkedLog.reduce((a, b) => a.date >= b.date ? a : b).worked;
        const latestRemain = newRemainLog.reduce((a, b) => a.date >= b.date ? a : b).remain;
        let newStatus;
        let newDoneDate;
        if (latestRemain === 0) {
          newStatus = "Done";
          newDoneDate = task.doneDate || logDate;
        } else if (latestWorked === 0) {
          newStatus = "Todo";
          newDoneDate = "";
        } else {
          newStatus = "In Progress";
          newDoneDate = "";
        }
        updateTask(task.id, { worked: latestWorked, remain: latestRemain, remainLog: newRemainLog, workedLog: newWorkedLog, status: newStatus, doneDate: newDoneDate });
      };
      workedInput.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          commitSave();
        }
      });
      remainInput.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          commitSave();
        }
      });
      removeBtn.hidden = !isSprintActive || !task.existsNow || task.worked > 0;
      removeBtn.addEventListener("click", () => {
        const label = task.taskId ? `[${task.taskId}] ${task.name}` : task.name || "this task";
        dom.confirmRemoveTaskName.textContent = label;
        dom.confirmRemoveTaskModal.hidden = false;
        const onConfirm = () => {
          removeTaskFromSprint(task.id);
          cleanup();
        };
        const onCancel = () => cleanup();
        const cleanup = () => {
          dom.confirmRemoveTaskModal.hidden = true;
          dom.confirmRemoveTaskConfirm.removeEventListener("click", onConfirm);
          dom.confirmRemoveTaskCancel.removeEventListener("click", onCancel);
        };
        dom.confirmRemoveTaskConfirm.addEventListener("click", onConfirm);
        dom.confirmRemoveTaskCancel.addEventListener("click", onCancel);
      });
      row.addEventListener("dragover", (e) => {
        e.preventDefault();
        const rect = row.getBoundingClientRect();
        const midY = rect.top + rect.height / 2;
        row.classList.remove("drag-over-above", "drag-over-below", "drag-over");
        if (e.dataTransfer.types.includes("text/plain")) {
          if (e.clientY < midY) {
            row.classList.add("drag-over-above");
          } else {
            row.classList.add("drag-over-below");
          }
        } else {
          row.classList.add("drag-over");
        }
      });
      row.addEventListener("dragleave", () => {
        row.classList.remove("drag-over", "drag-over-above", "drag-over-below");
      });
      row.addEventListener("drop", (e) => {
        e.preventDefault();
        row.classList.remove("drag-over", "drag-over-above", "drag-over-below");
        const backlogTaskId = e.dataTransfer.getData("backlogTaskId");
        if (backlogTaskId) {
          if (!isSprintActive) return;
          highlightBacklogTaskId = backlogTaskId;
          addTaskFromBacklog(backlogTaskId);
          return;
        }
        const draggedId = e.dataTransfer.getData("text/plain");
        if (!draggedId || draggedId === task.id) return;
        const currentIds = Array.from(dom.taskRows.querySelectorAll("tr[data-task-id]")).map((tr) => tr.dataset.taskId);
        const filtered = currentIds.filter((id) => id !== draggedId);
        const targetIdx = filtered.indexOf(task.id);
        const rect = row.getBoundingClientRect();
        const midY = rect.top + rect.height / 2;
        const insertIdx = e.clientY < midY ? targetIdx : targetIdx + 1;
        filtered.splice(insertIdx, 0, draggedId);
        reorderTasks(filtered);
      });
      dom.taskRows.appendChild(row);
    });
  };
  var renderBacklogPanel = (sprint, isSprintActive) => {
    const backlog = getBacklog();
    if (!backlog || !dom.backlogPanelRows) return;
    const allSprints = getState().sprints;
    const assignedIds = new Set(
      allSprints.flatMap((s) => s.tasks.map((t) => t.backlogTaskId).filter((id) => Boolean(id)))
    );
    dom.backlogPanelRows.innerHTML = "";
    let unassigned = [];
    const taskStoryMap = /* @__PURE__ */ new Map();
    for (const story of backlog.stories) {
      for (const task of story.tasks) {
        if (!assignedIds.has(task.id)) {
          unassigned.push(task);
          taskStoryMap.set(task.id, story);
        }
      }
    }
    unassigned = sortItems(unassigned, backlogPanelSort.key, backlogPanelSort.asc);
    const header = document.createElement("div");
    header.className = "backlog-panel-header";
    header.innerHTML = `<span class="bp-drag-col"></span><span class="bp-taskid sortable" data-sort-key="taskId">Task ID</span><span class="bp-description sortable" data-sort-key="description">Description</span><span class="bp-estimate sortable" data-sort-key="estimate">Est.</span><span class="bp-actions-col"></span>`;
    header.querySelectorAll(".sortable").forEach((el) => {
      const htmlEl = el;
      if (htmlEl.dataset.sortKey === backlogPanelSort.key) {
        htmlEl.classList.add(backlogPanelSort.asc ? "sort-asc" : "sort-desc");
      }
      htmlEl.addEventListener("click", () => toggleBacklogPanelSort(htmlEl.dataset.sortKey));
    });
    dom.backlogPanelRows.appendChild(header);
    unassigned.forEach((task, idx) => {
      const row = dom.backlogPanelRowTemplate.content.firstElementChild.cloneNode(true);
      const bpTaskId = row.querySelector(".bp-taskid");
      bpTaskId.textContent = task.taskId || "";
      const parentStory = taskStoryMap.get(task.id);
      if (parentStory?.description) bpTaskId.title = parentStory.description;
      const bpDesc = row.querySelector(".bp-description");
      bpDesc.textContent = task.description;
      if (task.assignedTo) bpDesc.title = task.assignedTo;
      row.querySelector(".bp-estimate").textContent = String(task.estimate ?? "");
      if (!isSprintActive) {
        row.draggable = false;
        row.querySelector(".bp-add-btn").disabled = true;
      } else {
        row.addEventListener("dragstart", (e) => {
          e.dataTransfer.setData("backlogTaskId", task.id);
        });
      }
      row.querySelector(".bp-add-btn").addEventListener("click", () => {
        if (!isSprintActive) return;
        highlightBacklogTaskId = task.id;
        const focusIdx = idx;
        addTaskFromBacklog(task.id);
        setTimeout(() => {
          const btns = dom.backlogPanelRows.querySelectorAll(".bp-add-btn");
          const target = btns[focusIdx] || btns[btns.length - 1];
          if (target) target.focus();
        }, 0);
      });
      dom.backlogPanelRows.appendChild(row);
    });
  };
  var STORY_SORT_KEYS = /* @__PURE__ */ new Set(["storyId", "description", "priority"]);
  var renderBacklog = () => {
    const backlog = getBacklog();
    if (!backlog) return;
    const assignedIds = new Set(
      getState().sprints.flatMap((s) => s.tasks.map((t) => t.backlogTaskId).filter((id) => Boolean(id)))
    );
    dom.backlogTableBody.innerHTML = "";
    const blTable = dom.backlogTableBody.closest("table");
    if (blTable) applySortClasses(blTable, backlogSort);
    let stories = backlog.stories;
    if (backlogSort.key) {
      if (STORY_SORT_KEYS.has(backlogSort.key)) {
        stories = sortItems([...stories], backlogSort.key, backlogSort.asc);
      }
    }
    for (const story of stories) {
      const isExpanded = expandedStoryIds.has(story.id);
      const isEditing = editingIds.has(story.id);
      const storyRow = dom.backlogStoryRowTemplate.content.firstElementChild.cloneNode(true);
      storyRow.dataset.id = story.id;
      const expandToggle = storyRow.querySelector(".story-expand-toggle");
      const storyIdView = storyRow.querySelector(".story-id-view");
      const storyIdEdit = storyRow.querySelector(".story-id-edit");
      const storyDescView = storyRow.querySelector(".story-desc-view");
      const storyDescEdit = storyRow.querySelector(".story-desc-edit");
      const storyPriorityView = storyRow.querySelector(".story-priority-view");
      const storyPriorityEdit = storyRow.querySelector(".story-priority-edit");
      const editBtn = storyRow.querySelector(".story-edit-btn");
      const addTaskBtn = storyRow.querySelector(".story-add-task-btn");
      const saveBtn = storyRow.querySelector(".story-save-btn");
      const cancelBtn = storyRow.querySelector(".story-cancel-btn");
      const deleteBtn = storyRow.querySelector(".story-delete-btn");
      expandToggle.textContent = isExpanded ? "\u25BC" : "\u25B6";
      expandToggle.addEventListener("click", () => {
        if (expandedStoryIds.has(story.id)) expandedStoryIds.delete(story.id);
        else expandedStoryIds.add(story.id);
        render(H_BACKLOG);
      });
      storyIdView.textContent = story.storyId || "";
      storyDescView.textContent = story.description || "";
      storyPriorityView.textContent = String(story.priority ?? 100);
      if (isEditing) {
        storyRow.classList.add("row-editing");
        expandToggle.hidden = true;
        storyIdView.hidden = true;
        storyIdEdit.hidden = false;
        storyIdEdit.value = story.storyId || "";
        storyDescView.hidden = true;
        storyDescEdit.hidden = false;
        storyDescEdit.value = story.description || "";
        storyPriorityView.hidden = true;
        storyPriorityEdit.hidden = false;
        storyPriorityEdit.value = String(story.priority ?? 100);
        storyPriorityEdit.addEventListener("keydown", (e) => {
          const cur = parseInt(storyPriorityEdit.value, 10) || 0;
          if (e.key === "ArrowUp") {
            e.preventDefault();
            storyPriorityEdit.value = String(Math.floor(cur / 10) * 10 + 10);
          } else if (e.key === "ArrowDown") {
            e.preventDefault();
            storyPriorityEdit.value = String(Math.max(0, Math.ceil(cur / 10) * 10 - 10));
          }
        });
        editBtn.hidden = true;
        addTaskBtn.hidden = true;
        saveBtn.hidden = false;
        cancelBtn.hidden = false;
        deleteBtn.hidden = false;
      } else {
        addTaskBtn.hidden = !isExpanded;
      }
      editBtn.addEventListener("click", () => {
        editingIds.clear();
        editingIds.add(story.id);
        render(H_BACKLOG);
      });
      saveBtn.addEventListener("click", () => {
        editingIds.delete(story.id);
        updateStory(story.id, {
          storyId: storyIdEdit.value.trim(),
          description: storyDescEdit.value.trim(),
          priority: Math.max(0, parseInt(storyPriorityEdit.value, 10) || 0)
        });
      });
      cancelBtn.addEventListener("click", () => {
        editingIds.delete(story.id);
        render(H_BACKLOG);
      });
      deleteBtn.addEventListener("click", () => {
        if (window.confirm(`Delete story "${story.description || story.storyId}"? This cannot be undone.`)) {
          editingIds.delete(story.id);
          deleteStory(story.id);
        }
      });
      addTaskBtn.addEventListener("click", () => {
        expandedStoryIds.add(story.id);
        const newTaskId = addBacklogTask(story.id);
        startEditing(newTaskId);
      });
      dom.backlogTableBody.appendChild(storyRow);
      if (isExpanded) {
        let storyTasks = story.tasks;
        if (backlogSort.key && !STORY_SORT_KEYS.has(backlogSort.key)) {
          const taskKeyMap = { taskId: "taskId", taskDesc: "description", estimate: "estimate", assignedTo: "assignedTo" };
          const mappedKey = taskKeyMap[backlogSort.key] || backlogSort.key;
          storyTasks = sortItems([...storyTasks], mappedKey, backlogSort.asc);
        }
        for (const task of storyTasks) {
          const isTaskEditing = editingIds.has(task.id);
          const taskRow = dom.backlogTaskRowTemplate.content.firstElementChild.cloneNode(true);
          const taskIdView = taskRow.querySelector(".task-id-view");
          const taskIdEdit = taskRow.querySelector(".task-id-edit");
          const taskDescView = taskRow.querySelector(".task-desc-view");
          const taskDescEdit = taskRow.querySelector(".task-desc-edit");
          const taskEstView = taskRow.querySelector(".task-estimate-view");
          const taskEstEdit = taskRow.querySelector(".task-estimate-edit");
          const taskAssignedView = taskRow.querySelector(".task-assigned-view");
          const taskAssignedEdit = taskRow.querySelector(".task-assigned-edit");
          const taskEditBtn = taskRow.querySelector(".task-edit-btn");
          const taskSaveBtn = taskRow.querySelector(".task-save-btn");
          const taskCancelBtn = taskRow.querySelector(".task-cancel-btn");
          const taskDeleteBtn = taskRow.querySelector(".task-delete-btn");
          taskIdView.textContent = task.taskId || "";
          taskDescView.textContent = task.description || "";
          taskEstView.textContent = String(task.estimate ?? "");
          taskAssignedView.textContent = task.assignedTo || "";
          if (assignedIds.has(task.id)) taskRow.classList.add("assigned");
          if (isTaskEditing) {
            taskRow.classList.add("row-editing");
            taskIdView.hidden = true;
            taskIdEdit.hidden = false;
            taskIdEdit.value = task.taskId || "";
            taskDescView.hidden = true;
            taskDescEdit.hidden = false;
            taskDescEdit.value = task.description || "";
            taskEstView.hidden = true;
            taskEstEdit.hidden = false;
            taskEstEdit.value = String(task.estimate ?? "");
            taskAssignedView.hidden = true;
            taskAssignedEdit.hidden = false;
            taskAssignedEdit.innerHTML = "";
            const members = getMembers();
            const emptyOpt = document.createElement("option");
            emptyOpt.value = "";
            emptyOpt.textContent = "\u2014";
            taskAssignedEdit.appendChild(emptyOpt);
            for (const m of members) {
              const opt = document.createElement("option");
              opt.value = m;
              opt.textContent = m;
              taskAssignedEdit.appendChild(opt);
            }
            if (task.assignedTo && !members.includes(task.assignedTo)) {
              const legacyOpt = document.createElement("option");
              legacyOpt.value = task.assignedTo;
              legacyOpt.textContent = task.assignedTo;
              taskAssignedEdit.appendChild(legacyOpt);
            }
            taskAssignedEdit.value = task.assignedTo || "";
            taskEditBtn.hidden = true;
            taskSaveBtn.hidden = false;
            taskCancelBtn.hidden = false;
            taskDeleteBtn.hidden = false;
          }
          taskEditBtn.addEventListener("click", () => {
            editingIds.clear();
            editingIds.add(task.id);
            render(H_BACKLOG);
          });
          taskSaveBtn.addEventListener("click", () => {
            editingIds.delete(task.id);
            updateBacklogTask(story.id, task.id, {
              taskId: taskIdEdit.value.trim(),
              description: taskDescEdit.value.trim(),
              estimate: Number(taskEstEdit.value) || 0,
              assignedTo: taskAssignedEdit.value.trim()
            });
          });
          taskCancelBtn.addEventListener("click", () => {
            editingIds.delete(task.id);
            render(H_BACKLOG);
          });
          taskDeleteBtn.addEventListener("click", () => {
            if (window.confirm(`Delete task "${task.description || task.taskId}"?`)) {
              editingIds.delete(task.id);
              deleteBacklogTask(story.id, task.id);
            }
          });
          dom.backlogTableBody.appendChild(taskRow);
        }
      }
    }
  };
  var renderPlanTasks = (sprint) => {
    dom.planTaskRows.innerHTML = "";
    let dragStartedFromHandle = false;
    const planTable = dom.planTaskRows.closest("table");
    if (planTable) applySortClasses(planTable, planTaskSort);
    const tasks = sortItems(sprint.tasks, planTaskSort.key, planTaskSort.asc);
    tasks.forEach((task) => {
      const row = dom.planTaskRowTemplate.content.firstElementChild.cloneNode(true);
      row.dataset.taskId = task.id;
      const handle = row.querySelector(".drag-handle");
      handle.addEventListener("mousedown", () => {
        dragStartedFromHandle = true;
      });
      row.addEventListener("dragstart", (e) => {
        if (!dragStartedFromHandle) {
          e.preventDefault();
          return;
        }
        dragStartedFromHandle = false;
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData("text/plain", task.id);
        row.classList.add("dragging");
      });
      row.addEventListener("dragend", () => {
        row.classList.remove("dragging");
        dragStartedFromHandle = false;
        dom.planTaskRows.querySelectorAll(".drag-over-above, .drag-over-below").forEach((el) => el.classList.remove("drag-over-above", "drag-over-below"));
      });
      row.querySelector(".plan-col-taskid").textContent = task.taskId || "";
      row.querySelector(".plan-col-name").textContent = task.name;
      row.querySelector(".plan-col-estimate").textContent = String(task.estimate);
      const removeBtn = row.querySelector(".plan-remove-btn");
      removeBtn.addEventListener("click", () => removeTaskFromSprint(task.id));
      row.addEventListener("dragover", (e) => {
        e.preventDefault();
        const mid = row.getBoundingClientRect().top + row.getBoundingClientRect().height / 2;
        row.classList.remove("drag-over-above", "drag-over-below");
        row.classList.add(e.clientY < mid ? "drag-over-above" : "drag-over-below");
      });
      row.addEventListener("dragleave", () => row.classList.remove("drag-over-above", "drag-over-below"));
      row.addEventListener("drop", (e) => {
        e.preventDefault();
        row.classList.remove("drag-over-above", "drag-over-below");
        const backlogTaskId = e.dataTransfer.getData("backlogTaskId");
        if (backlogTaskId) {
          addTaskFromBacklog(backlogTaskId);
          return;
        }
        const draggedId = e.dataTransfer.getData("text/plain");
        if (!draggedId || draggedId === task.id) return;
        const ids = Array.from(dom.planTaskRows.querySelectorAll("tr[data-task-id]")).map((tr) => tr.dataset.taskId);
        const filtered = ids.filter((id) => id !== draggedId);
        const targetIdx = filtered.indexOf(task.id);
        const mid = row.getBoundingClientRect().top + row.getBoundingClientRect().height / 2;
        filtered.splice(e.clientY < mid ? targetIdx : targetIdx + 1, 0, draggedId);
        reorderTasks(filtered);
      });
      dom.planTaskRows.appendChild(row);
    });
    dom.planTaskRows.addEventListener("dragover", (e) => e.preventDefault(), { once: false });
    dom.planTaskRows.addEventListener("drop", (e) => {
      const target = e.target;
      if (target.closest("tr[data-task-id]")) return;
      const backlogTaskId = e.dataTransfer.getData("backlogTaskId");
      if (backlogTaskId) {
        e.preventDefault();
        addTaskFromBacklog(backlogTaskId);
      }
    });
  };
  var renderPlanBacklog = (sprint) => {
    dom.planBacklogRows.innerHTML = "";
    const backlog = getBacklog();
    if (!backlog) return;
    const assignedIds = new Set(
      getState().sprints.flatMap((s) => s.tasks.map((t) => t.backlogTaskId).filter((id) => Boolean(id)))
    );
    const unassigned = [];
    for (const story of backlog.stories)
      for (const task of story.tasks)
        if (!assignedIds.has(task.id)) unassigned.push(task);
    if (unassigned.length === 0) {
      const empty = document.createElement("p");
      empty.className = "plan-backlog-empty";
      empty.textContent = "All backlog tasks are assigned.";
      dom.planBacklogRows.appendChild(empty);
      return;
    }
    const sortedUnassigned = sortItems(unassigned, planBacklogSort.key, planBacklogSort.asc);
    const header = document.createElement("div");
    header.className = "plan-backlog-header";
    header.innerHTML = `<span class="plan-bl-hdr-taskid sortable" data-sort-key="taskId">Task ID</span><span class="plan-bl-hdr-desc sortable" data-sort-key="description">Description</span><span class="plan-bl-hdr-est sortable" data-sort-key="estimate">Est</span><span></span>`;
    header.querySelectorAll(".sortable").forEach((el) => {
      const htmlEl = el;
      if (htmlEl.dataset.sortKey === planBacklogSort.key) {
        htmlEl.classList.add(planBacklogSort.asc ? "sort-asc" : "sort-desc");
      }
      htmlEl.addEventListener("click", () => togglePlanBacklogSort(htmlEl.dataset.sortKey));
    });
    dom.planBacklogRows.appendChild(header);
    sortedUnassigned.forEach((task) => {
      const row = document.createElement("div");
      row.className = "plan-backlog-row";
      row.draggable = true;
      row.title = "Drag to add to sprint";
      row.innerHTML = `
      <span class="plan-bl-taskid">${task.taskId || ""}</span>
      <span class="plan-bl-desc">${task.description || ""}</span>
      <span class="plan-bl-est">${task.estimate ?? ""}</span>
      <span><button class="btn ghost small plan-bl-add-btn">+</button></span>
    `;
      row.addEventListener("dragstart", (e) => {
        e.dataTransfer.effectAllowed = "copy";
        e.dataTransfer.setData("backlogTaskId", task.id);
        row.classList.add("dragging");
      });
      row.addEventListener("dragend", () => row.classList.remove("dragging"));
      row.querySelector(".plan-bl-add-btn").addEventListener("click", () => {
        addTaskFromBacklog(task.id);
      });
      dom.planBacklogRows.appendChild(row);
    });
  };
  var renderPlanningModal = (sprint, holidaySet, workWeekendSet) => {
    if (dom.sprintPlanModal.hidden) return;
    const sprintNumber = getState().sprints.findIndex((s) => s.id === sprint.id) + 1;
    dom.sprintPlanTitle.textContent = sprint.description ? `Sprint ${sprintNumber} \u2014 ${sprint.description}` : `Sprint ${sprintNumber}`;
    const workingDays = getWorkingDates(sprint.startDate, sprint.endDate, holidaySet, workWeekendSet).length;
    const totalPoints = sprint.tasks.reduce((sum, t) => sum + Number(t.estimate || 0), 0);
    const developers = Math.max(0, Number(sprint.developers || 0));
    const efficiency = Math.min(1, Math.max(0, Number(sprint.efficiency || 0)));
    const availableDays = developers * workingDays * efficiency - totalPoints;
    dom.planStatDuration.textContent = formatSprintRange(sprint);
    dom.planStatWorkingDays.textContent = String(workingDays);
    dom.planStatTotalPoints.textContent = totalPoints.toFixed(1).replace(/\.0$/, "");
    dom.planStatAvailableDays.textContent = availableDays.toFixed(1).replace(/\.0$/, "");
    dom.planStatAvailableDays.className = "plan-stat-value" + (availableDays < -1.5 ? " available-red" : availableDays <= 1.5 ? " available-green" : "");
    renderPlanTasks(sprint);
    renderPlanBacklog(sprint);
  };
  var renderStats = (sprint, burndown) => {
    const effectiveToday = burndown.todayIndex >= 0 ? burndown.dates[burndown.todayIndex] : "";
    const doneTasks = sprint.tasks.filter((t) => t.status === "Done" && t.doneDate && t.doneDate <= effectiveToday).length;
    const availableDays = burndown.effectiveManDays - burndown.totalPoints;
    dom.summaryDuration.textContent = formatSprintRange(sprint);
    dom.workingDays.textContent = String(burndown.dates.length);
    dom.totalPoints.textContent = burndown.totalPoints.toFixed(1).replace(/\.0$/, "");
    const lastActual = [...burndown.actual].reverse().find((v) => v !== null) ?? 0;
    dom.remainingPoints.textContent = lastActual.toFixed(1).replace(/\.0$/, "");
    dom.doneTasks.textContent = String(doneTasks);
    dom.availableDaysValue.textContent = availableDays.toFixed(1).replace(/\.0$/, "");
    dom.availableDays.classList.remove("ok", "alert");
    if (availableDays < -1) {
      dom.availableDays.classList.add("alert");
    } else if (availableDays >= -1 && availableDays <= 1) {
      dom.availableDays.classList.add("ok");
    }
    const ti = burndown.todayIndex;
    const scopeToday = ti >= 0 ? burndown.scope[ti] ?? 0 : 0;
    const remainToday = ti >= 0 ? burndown.actual[ti] ?? 0 : 0;
    const workedToday = scopeToday - remainToday;
    const progressPct = scopeToday > 0 ? (workedToday / scopeToday * 100).toFixed(2) : "0.00";
    dom.progressPercent.textContent = `${progressPct}%`;
    dom.progressBarFill.style.width = `${progressPct}%`;
    const developers = Math.max(0, Number(sprint.developers || 0));
    const idealEff = Math.min(1, Math.max(0, Number(sprint.efficiency || 0)));
    const daysElapsed = burndown.todayIndex;
    const pointsBurned = burndown.totalPoints - lastActual;
    let actualEff = 0;
    if (developers > 0 && daysElapsed > 0) {
      actualEff = pointsBurned / (developers * daysElapsed);
    }
    const fmt = (v) => v.toFixed(2).replace(/0$/, "");
    dom.efficiencyDisplay.textContent = `${fmt(actualEff)} : ${fmt(idealEff)}`;
  };
  var render = (hints) => {
    if (hints === void 0) hints = H_ALL;
    const has = (h) => (hints & h) !== 0;
    dom.tabSprint.classList.toggle("active", activeTab === "sprint");
    dom.tabBacklog.classList.toggle("active", activeTab === "backlog");
    dom.sprintView.hidden = activeTab !== "sprint";
    dom.backlogView.hidden = activeTab !== "backlog";
    dom.sprintSubHeader.hidden = activeTab === "backlog";
    if (has(H_SIDEBAR)) renderSprintList();
    const prefs = getPreferences();
    const holidaySet = new Set(prefs.holidays.map((h) => h.date));
    const workWeekendSet = new Set(prefs.workWeekends);
    if (fpProjectToday) fpProjectToday.destroy();
    fpProjectToday = flatpickr(dom.projectTodayInput, {
      dateFormat: "Y-m-d",
      disableMobile: true,
      disable: [
        (date) => {
          const iso = localIso(date);
          if (holidaySet.has(iso)) return true;
          const isWeekend = date.getDay() === 0 || date.getDay() === 6;
          if (isWeekend && workWeekendSet.has(iso)) return false;
          return isWeekend;
        }
      ],
      onChange: ([date]) => {
        if (date) setProjectToday(localIso(date));
      }
    });
    fpProjectToday.setDate(getProjectToday(), false);
    if (activeTab === "backlog") {
      if (has(H_BACKLOG)) renderBacklog();
      return;
    }
    const sprint = getActiveSprint();
    if (!sprint) return;
    patchActiveSprint({ developers: 0, efficiency: 1 });
    const maxToday = sprint.endDate ? getNextWorkingDay(sprint.endDate, holidaySet, workWeekendSet) : sprint.endDate;
    const real = todayIso();
    const defaultToday = real >= sprint.startDate && real <= maxToday ? real : real < sprint.startDate ? sprint.startDate : maxToday;
    patchActiveSprint({ today: defaultToday });
    const effectiveToday = sprint.today < sprint.startDate ? sprint.startDate : sprint.today > maxToday ? maxToday : sprint.today;
    const projectToday = getProjectToday();
    const isSprintActive = projectToday >= sprint.startDate && projectToday <= sprint.endDate;
    if (has(H_HEADER)) {
      const state2 = getState();
      const sprintNumber = state2.sprints.findIndex((s) => s.id === sprint.id) + 1;
      dom.sprintTitleText.textContent = sprint.description || `Sprint ${sprintNumber}`;
      dom.resetSprintBtn.textContent = `Reset Sprint ${sprintNumber}`;
      dom.deleteSprintBtn.textContent = `Delete Sprint ${sprintNumber}`;
      dom.editSprintBtn.disabled = sprint.endDate < projectToday;
      dom.addByIdInput.disabled = !isSprintActive;
      dom.addByIdBtn.disabled = !isSprintActive;
    }
    if (has(H_TASKS)) renderTasks(sprint, holidaySet, workWeekendSet, isSprintActive);
    if (has(H_PANEL)) renderBacklogPanel(sprint, isSprintActive);
    if (has(H_STATS) || has(H_CHART)) {
      const chartToday = projectToday < sprint.startDate ? sprint.startDate : projectToday > maxToday ? maxToday : projectToday;
      const burndown = calculateBurndown(sprint, chartToday, holidaySet, workWeekendSet);
      const browseIndex = burndown.dates.reduce((last, date, i) => date <= effectiveToday ? i : last, -1);
      if (has(H_STATS)) renderStats(sprint, burndown);
      if (has(H_CHART)) {
        drawChart(burndown, (date) => {
          if (isSprintActive) {
            setProjectToday(date);
          } else {
            if (date === effectiveToday && date !== chartToday) updateToday(chartToday);
            else updateToday(date);
          }
        }, browseIndex >= 0 ? browseIndex : void 0, chartToday === projectToday);
      }
    }
    if (has(H_TASKS | H_PANEL | H_STATS)) renderPlanningModal(sprint, holidaySet, workWeekendSet);
  };

  // src/io.ts
  var showImportConfirm = ({ title, message, subtext = "", okLabel = "Proceed" }) => new Promise((resolve) => {
    dom.importConfirmTitle.textContent = title;
    dom.importConfirmMessage.innerHTML = message;
    dom.importConfirmSubtext.textContent = subtext;
    dom.importConfirmSubtext.hidden = !subtext;
    dom.importConfirmOk.textContent = okLabel;
    dom.importConfirmModal.hidden = false;
    const cleanup = () => {
      dom.importConfirmModal.hidden = true;
      dom.importConfirmOk.removeEventListener("click", onOk);
      dom.importConfirmCancel.removeEventListener("click", onCancel);
    };
    const onOk = () => {
      cleanup();
      resolve(true);
    };
    const onCancel = () => {
      cleanup();
      resolve(false);
    };
    dom.importConfirmOk.addEventListener("click", onOk);
    dom.importConfirmCancel.addEventListener("click", onCancel);
  });
  var exportData = () => {
    const state2 = getState();
    const blob = new Blob([JSON.stringify(state2, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `burndown-studio-${todayIso()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };
  var exportSprintExcel = () => {
    const sprint = getActiveSprint();
    if (!sprint) return;
    const state2 = getState();
    const sprintNumber = state2.sprints.findIndex((s) => s.id === sprint.id) + 1;
    const aoa = [
      ["Task ID", "Task", "Estimate", "Worked", "Remain", "Actual/Est", "Status", "Done Date"],
      ...sprint.tasks.map((t) => [
        t.taskId || "",
        t.name,
        t.estimate ?? "",
        t.worked ?? 0,
        t.remain ?? t.estimate ?? 0,
        (t.worked ?? 0) + (t.remain ?? t.estimate ?? 0),
        t.status,
        t.doneDate || ""
      ])
    ];
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, `Sprint ${sprintNumber}`);
    XLSX.writeFile(wb, `sprint-${sprintNumber}-tasks-${todayIso()}.xlsx`);
  };
  var migrateImported = (imported) => {
    if (!imported.backlog) imported.backlog = { stories: [] };
    for (const sprint of imported.sprints) {
      for (const task of sprint.tasks) {
        if (task.points !== void 0 && task.estimate === void 0) {
          task.estimate = task.points;
          delete task.points;
        }
        if (task.worked === void 0) {
          const old = task.actual ?? null;
          if (task.status === "Done") {
            task.worked = old != null ? old : task.estimate ?? 0;
            task.remain = 0;
          } else {
            task.worked = 0;
            task.remain = task.estimate ?? 0;
          }
          delete task.actual;
        }
        if (!task.remainLog) task.remainLog = [];
        if (!task.workedLog) task.workedLog = [];
      }
    }
    return imported;
  };
  var importData = (file) => {
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const imported = JSON.parse(e.target.result);
        if (!imported || !Array.isArray(imported.sprints)) {
          alert("Invalid file: expected a Burndown Studio JSON export.");
          return;
        }
        const ok = await showImportConfirm({
          title: "\u26A0 Import Sprint Data",
          message: `Import <strong>${imported.sprints.length}</strong> sprint(s)? This will replace all current data.`,
          subtext: "This action cannot be undone.",
          okLabel: "Import"
        });
        if (!ok) return;
        if (!imported.activeSprintId && imported.sprints.length > 0) {
          imported.activeSprintId = imported.sprints[0].id;
        }
        replaceState(migrateImported(imported));
      } catch {
        alert("Failed to parse file. Please select a valid JSON export.");
      }
    };
    reader.readAsText(file);
  };
  var exportBacklogExcel = () => {
    const backlog = getBacklog();
    const aoa = [
      ["Story ID", "User Stories", "Priority", "Task ID", "Task Description", "Estimate(days)", "Assigned To"]
    ];
    for (const story of backlog.stories) {
      if (story.tasks.length === 0) {
        aoa.push([story.storyId, story.description, story.priority ?? 100, "", "", "", ""]);
      } else {
        story.tasks.forEach((task, i) => {
          if (i === 0) {
            aoa.push([story.storyId, story.description, story.priority ?? 100, task.taskId, task.description, task.estimate, task.assignedTo]);
          } else {
            aoa.push(["", "", "", task.taskId, task.description, task.estimate, task.assignedTo]);
          }
        });
      }
    }
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Backlog");
    XLSX.writeFile(wb, `backlog-${todayIso()}.xlsx`);
  };
  var importBacklogExcel = (file) => {
    const reader = new FileReader();
    reader.onload = async (e) => {
      const data = new Uint8Array(e.target.result);
      let workbook;
      try {
        workbook = XLSX.read(data, { type: "array" });
      } catch {
        alert("Failed to read file. Please select a valid Excel (.xlsx/.xls) file.");
        return;
      }
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];
      const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false, defval: "" });
      if (rows.length < 2) {
        alert("File is empty or has no data rows.");
        return;
      }
      const stories = [];
      let currentStory = null;
      for (let i = 1; i < rows.length; i++) {
        const cols = rows[i];
        if (cols.every((c) => String(c ?? "").trim() === "")) continue;
        const storyId = String(cols[0] ?? "").trim();
        const storyDesc = String(cols[1] ?? "").trim();
        const priorityRaw = parseInt(String(cols[2] ?? "").trim(), 10);
        const priority = isNaN(priorityRaw) ? 100 : Math.max(0, priorityRaw);
        const taskId = String(cols[3] ?? "").trim();
        const taskDesc = String(cols[4] ?? "").trim();
        const estimateRaw = parseFloat(String(cols[5] ?? ""));
        const estimate = isNaN(estimateRaw) ? 0 : estimateRaw;
        const assignedTo = String(cols[6] ?? "").trim();
        if (storyId) {
          currentStory = { id: createId(), storyId, description: storyDesc, priority, tasks: [] };
          stories.push(currentStory);
        }
        if (taskId && currentStory) {
          currentStory.tasks.push({ id: createId(), taskId, description: taskDesc, estimate, assignedTo });
        }
      }
      if (stories.length === 0) {
        alert("No stories found. Check that the file format matches:\nStory ID | User Stories | Priority | Task ID | Task Description | Time Estimate (days) | Assigned To");
        return;
      }
      const existing = getBacklog();
      const hasExisting = existing?.stories?.length > 0;
      const message = hasExisting ? `Import <strong>${stories.length}</strong> story/stories into backlog? This will replace all <strong>${existing.stories.length}</strong> existing story/stories.` : `Import <strong>${stories.length}</strong> story/stories into the backlog?`;
      const ok = await showImportConfirm({
        title: "\u26A0 Import Backlog",
        message,
        subtext: hasExisting ? "This action cannot be undone." : "",
        okLabel: "Import"
      });
      if (!ok) return;
      const orphans = findOrphanedSprintTasks(stories);
      if (orphans.length > 0) {
        const lines = orphans.map(
          (o) => `<strong>Sprint ${o.sprintIndex}:</strong> [${o.taskId}] ${o.name}`
        ).join("<br>");
        const ok2 = await showImportConfirm({
          title: "\u26A0 Sprint Tasks Will Be Removed",
          message: `${orphans.length} task(s) will be removed from sprints because their Task ID is not in the imported backlog:<br><br>${lines}`,
          okLabel: "Proceed"
        });
        if (!ok2) return;
      }
      replaceBacklog({ stories });
      relinkSprintTasks();
      const uniqueNames = [...new Set(
        stories.flatMap((s) => s.tasks.map((t) => t.assignedTo)).filter(Boolean)
      )];
      if (uniqueNames.length > 0) addMembersFromImport(uniqueNames);
    };
    reader.readAsArrayBuffer(file);
  };

  // src/main.ts
  setOnStateChange(render);
  var fpStart = null;
  var fpEnd = null;
  var getDisabledRanges = (excludeId) => {
    const others = getState().sprints.filter((s) => s.id !== excludeId);
    const prefs = getPreferences();
    const holidaySet = new Set(prefs.holidays.map((h) => h.date));
    const workWeekendSet = new Set(prefs.workWeekends);
    return [
      (date) => {
        const iso = localIso(date);
        if (holidaySet.has(iso)) return true;
        const isWeekend = date.getDay() === 0 || date.getDay() === 6;
        if (isWeekend && workWeekendSet.has(iso)) return false;
        return isWeekend;
      },
      ...others.map((s) => ({ from: s.startDate, to: s.endDate }))
    ];
  };
  var fixCalendarPosition = (instance) => {
    setTimeout(() => {
      const rect = instance.input.getBoundingClientRect();
      const cal = instance.calendarContainer;
      cal.style.position = "fixed";
      cal.style.top = rect.bottom + 4 + "px";
      cal.style.left = rect.left + "px";
      cal.style.zIndex = "1000";
    }, 0);
  };
  var updateWorkingDaysChip = () => {
    const start = fpStart?.selectedDates[0];
    const end = fpEnd?.selectedDates[0];
    if (start && end) {
      const startIso = localIso(start);
      const endIso = localIso(end);
      const prefs = getPreferences();
      const holidaySet = new Set(prefs.holidays.map((h) => h.date));
      const workWeekendSet = new Set(prefs.workWeekends);
      const count = getWorkingDates(startIso, endIso, holidaySet, workWeekendSet).length;
      dom.modalWorkingDays.textContent = `${count} working days`;
      const developers = Number(dom.modalDevelopers.value) || 0;
      const efficiency = Math.min(1, Math.max(0, Number(dom.modalEfficiency.value) || 0));
      const manDays = developers * count * efficiency;
      dom.modalManDays.textContent = `${manDays.toFixed(1).replace(/\.0$/, "")} man-days`;
    } else {
      dom.modalWorkingDays.textContent = "";
      dom.modalManDays.textContent = "";
    }
  };
  var isoAddDays = (iso, n) => {
    const d = /* @__PURE__ */ new Date(iso + "T12:00:00");
    d.setDate(d.getDate() + n);
    return d.toISOString().slice(0, 10);
  };
  var updateGapBounds = (excludeId, startIso, endIso) => {
    const others = getState().sprints.filter((s) => s.id !== excludeId).sort((a, b) => a.startDate.localeCompare(b.startDate));
    if (startIso && fpEnd) {
      const next = others.find((s) => s.startDate > startIso);
      fpEnd.set("maxDate", next ? isoAddDays(next.startDate, -1) : null);
    }
    if (endIso && fpStart) {
      const prev = [...others].reverse().find((s) => s.endDate < endIso);
      fpStart.set("minDate", prev ? isoAddDays(prev.endDate, 1) : null);
    }
  };
  var initDatePickers = (excludeId, defaultStart, defaultEnd) => {
    if (fpStart) fpStart.destroy();
    if (fpEnd) fpEnd.destroy();
    const disabled = getDisabledRanges(excludeId);
    const base = {
      dateFormat: "Y-m-d",
      disableMobile: true,
      disable: disabled,
      onOpen: (_, __, instance) => fixCalendarPosition(instance)
    };
    fpStart = flatpickr(dom.modalStartDate, {
      ...base,
      defaultDate: defaultStart || null,
      onChange: ([date]) => {
        const iso = date ? localIso(date) : null;
        if (fpEnd) fpEnd.set("minDate", iso);
        updateGapBounds(excludeId, iso, fpEnd?.selectedDates[0] ? localIso(fpEnd.selectedDates[0]) : null);
        updateWorkingDaysChip();
      }
    });
    fpEnd = flatpickr(dom.modalEndDate, {
      ...base,
      defaultDate: defaultEnd || null,
      minDate: defaultStart || null,
      onChange: ([date]) => {
        const iso = date ? localIso(date) : null;
        if (fpStart) fpStart.set("maxDate", iso);
        updateGapBounds(excludeId, fpStart?.selectedDates[0] ? localIso(fpStart.selectedDates[0]) : null, iso);
        updateWorkingDaysChip();
      }
    });
    updateGapBounds(excludeId, defaultStart || null, defaultEnd || null);
    updateWorkingDaysChip();
  };
  dom.modalDevelopers.addEventListener("input", updateWorkingDaysChip);
  dom.modalEfficiency.addEventListener("input", updateWorkingDaysChip);
  var modalMode = "edit";
  var modalSprintId = null;
  var openModal = (mode, sprint) => {
    modalMode = mode;
    modalSprintId = sprint.id ?? null;
    dom.modalTitle.textContent = mode === "create" ? "New Sprint" : "Edit Sprint";
    dom.modalSave.textContent = mode === "create" ? "Save & Add Tasks" : mode === "plan-edit" ? "Add/Remove Tasks" : "Save";
    dom.modalDescription.value = sprint.description || "";
    dom.modalDevelopers.value = String(sprint.developers ?? 4);
    dom.modalEfficiency.value = String(sprint.efficiency ?? 0.8);
    dom.modalError.hidden = true;
    dom.sprintModal.hidden = false;
    initDatePickers(sprint.id || null, sprint.startDate, sprint.endDate);
  };
  var closeModal = () => {
    dom.sprintModal.hidden = true;
    if (fpStart) {
      fpStart.destroy();
      fpStart = null;
    }
    if (fpEnd) {
      fpEnd.destroy();
      fpEnd = null;
    }
  };
  dom.modalClose.addEventListener("click", closeModal);
  dom.modalCancel.addEventListener("click", closeModal);
  dom.sprintModal.addEventListener("click", (e) => {
    if (e.target === dom.sprintModal) closeModal();
  });
  dom.modalSave.addEventListener("click", () => {
    const description = dom.modalDescription.value.trim();
    const startDate = dom.modalStartDate.value;
    const endDate = dom.modalEndDate.value;
    const developers = Number(dom.modalDevelopers.value);
    const efficiency = Number(dom.modalEfficiency.value);
    if (!startDate || !endDate) return;
    const updates = { description, startDate, endDate, developers, efficiency };
    if (modalMode === "create") {
      createSprint(updates);
      closeModal();
      dom.sprintPlanModal.hidden = false;
      render();
    } else if (modalMode === "plan-edit") {
      updateSprintById(modalSprintId, updates);
      closeModal();
      dom.sprintPlanModal.hidden = false;
      render();
    } else {
      updateSprintById(modalSprintId, updates);
      closeModal();
    }
    const gaps = findGaps(getState().sprints);
    if (gaps.length > 0) {
      alert("Note: There is a gap of working days between some sprints. You can close the gap by editing the sprint dates.");
    }
  });
  dom.newSprintBtn.addEventListener("click", () => {
    const state2 = getState();
    const sprints = state2.sprints;
    const latestSprint = sprints.length > 0 ? sprints[sprints.length - 1] : null;
    const latestEnd = latestSprint ? latestSprint.endDate : "";
    const start = latestEnd ? getNextWorkingDay(latestEnd) : todayIso();
    const end = addWorkingDays(start, 10);
    const defaultDevelopers = latestSprint ? latestSprint.developers : state2.preferences.members.length || 4;
    openModal("create", { description: "", startDate: start, endDate: end, developers: defaultDevelopers, efficiency: 1 });
  });
  dom.editSprintBtn.addEventListener("click", () => {
    const sprint = getActiveSprint();
    if (!sprint) return;
    const mode = sprint.startDate > getProjectToday() ? "plan-edit" : "edit";
    openModal(mode, sprint);
  });
  var closePlanModal = () => {
    dom.sprintPlanModal.hidden = true;
    finalizeSprintPlan();
  };
  dom.sprintPlanClose.addEventListener("click", closePlanModal);
  dom.sprintPlanDone.addEventListener("click", closePlanModal);
  dom.sprintPlanModal.addEventListener("click", (e) => {
    if (e.target === dom.sprintPlanModal) closePlanModal();
  });
  dom.resetSprintBtn.addEventListener("click", () => {
    const sprint = getActiveSprint();
    if (!sprint) return;
    const idx = getState().sprints.findIndex((s) => s.id === sprint.id) + 1;
    dom.confirmResetSprintName.textContent = sprint.description || `Sprint ${idx}`;
    dom.confirmResetSprintModal.hidden = false;
  });
  dom.confirmResetSprintCancel.addEventListener("click", () => {
    dom.confirmResetSprintModal.hidden = true;
  });
  dom.confirmResetSprintConfirm.addEventListener("click", () => {
    dom.confirmResetSprintModal.hidden = true;
    resetActiveSprint();
  });
  dom.deleteSprintBtn.addEventListener("click", () => {
    const sprint = getActiveSprint();
    if (!sprint) return;
    const idx = getState().sprints.findIndex((s) => s.id === sprint.id) + 1;
    dom.confirmDeleteSprintName.textContent = sprint.description || `Sprint ${idx}`;
    dom.confirmDeleteSprintModal.hidden = false;
  });
  dom.confirmDeleteSprintCancel.addEventListener("click", () => {
    dom.confirmDeleteSprintModal.hidden = true;
  });
  dom.confirmDeleteSprintConfirm.addEventListener("click", () => {
    dom.confirmDeleteSprintModal.hidden = true;
    deleteActiveSprint();
  });
  if (dom.exportCsvBtn) dom.exportCsvBtn.addEventListener("click", exportSprintExcel);
  dom.exportBtn.addEventListener("click", exportData);
  dom.importBtn.addEventListener("click", () => dom.importFile.click());
  dom.importFile.addEventListener("change", (e) => {
    const target = e.target;
    if (target.files?.[0]) importData(target.files[0]);
    target.value = "";
  });
  dom.showDayNumbers.addEventListener("change", () => render(H_CHART));
  dom.tabSprint.addEventListener("click", () => setActiveTab("sprint"));
  dom.tabBacklog.addEventListener("click", () => setActiveTab("backlog"));
  var commitAddById = () => {
    const input = dom.addByIdInput.value.trim();
    if (!input) return;
    const backlog = getState().backlog;
    let uuid = null;
    for (const story of backlog?.stories ?? []) {
      const found = story.tasks.find((t) => t.taskId === input);
      if (found) {
        uuid = found.id;
        break;
      }
    }
    if (!uuid) {
      alert(`Task "${input}" not found in backlog.`);
      return;
    }
    setHighlightBacklogTaskId(uuid);
    addTaskFromBacklog(uuid);
    dom.addByIdInput.value = "";
  };
  dom.addByIdBtn.addEventListener("click", commitAddById);
  dom.addByIdInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      commitAddById();
    }
  });
  var backlogPanelOpen = false;
  document.getElementById("backlogPanelToggle").addEventListener("click", () => {
    backlogPanelOpen = !backlogPanelOpen;
    document.getElementById("backlogPanelRows").hidden = !backlogPanelOpen;
    document.getElementById("backlogPanelToggle").querySelector(".panel-toggle-chevron").textContent = backlogPanelOpen ? "\u25B2" : "\u25BC";
  });
  dom.taskRows.addEventListener("dragover", (e) => {
    e.preventDefault();
    dom.taskRows.classList.add("drag-over");
  });
  dom.taskRows.addEventListener("dragleave", () => dom.taskRows.classList.remove("drag-over"));
  dom.taskRows.addEventListener("drop", (e) => {
    e.preventDefault();
    dom.taskRows.classList.remove("drag-over");
    const backlogTaskId = e.dataTransfer.getData("backlogTaskId");
    if (backlogTaskId) {
      setHighlightBacklogTaskId(backlogTaskId);
      addTaskFromBacklog(backlogTaskId);
    }
  });
  dom.backlogExpandAllBtn.addEventListener("click", expandAll);
  dom.backlogCollapseAllBtn.addEventListener("click", collapseAll);
  dom.backlogAddStoryBtn.addEventListener("click", () => {
    const newId = addStory();
    startEditing(newId, true);
  });
  dom.backlogExportCsvBtn.addEventListener("click", exportBacklogExcel);
  dom.backlogDeleteAllBtn.addEventListener("click", () => {
    dom.confirmDeleteBacklogModal.hidden = false;
  });
  dom.confirmDeleteBacklogCancel.addEventListener("click", () => {
    dom.confirmDeleteBacklogModal.hidden = true;
  });
  dom.confirmDeleteBacklogConfirm.addEventListener("click", () => {
    dom.confirmDeleteBacklogModal.hidden = true;
    replaceBacklog({ stories: [] });
  });
  dom.backlogImportCsvBtn.addEventListener("click", () => dom.backlogImportFile.click());
  dom.backlogImportFile.addEventListener("change", (e) => {
    const target = e.target;
    if (target.files?.[0]) importBacklogExcel(target.files[0]);
    target.value = "";
  });
  document.querySelectorAll(".task-table thead th.sortable").forEach((th) => {
    th.addEventListener("click", () => toggleTaskSort(th.dataset.sortKey));
  });
  document.querySelectorAll(".backlog-table thead th.sortable").forEach((th) => {
    th.addEventListener("click", (e) => {
      if (e.target.classList.contains("col-resizer")) return;
      toggleBacklogSort(th.dataset.sortKey);
    });
  });
  document.querySelectorAll(".plan-task-table thead th.sortable").forEach((th) => {
    th.addEventListener("click", () => togglePlanTaskSort(th.dataset.sortKey));
  });
  (function initBacklogResize() {
    const table = document.querySelector(".backlog-table");
    const ths = Array.from(table.querySelectorAll("thead th"));
    const cols = Array.from(table.querySelectorAll("col"));
    let frozen = false;
    function freezeWidths() {
      if (frozen) return;
      frozen = true;
      ths.forEach((th, i) => {
        const w = th.offsetWidth + "px";
        th.style.width = w;
        if (cols[i]) cols[i].style.width = w;
      });
      table.style.width = table.offsetWidth + "px";
    }
    ths.slice(0, -1).forEach((th, i) => {
      const resizer = th.querySelector(".col-resizer");
      if (!resizer) return;
      const col = cols[i];
      resizer.addEventListener("mousedown", (e) => {
        freezeWidths();
        const me = e;
        const startX = me.clientX;
        const startW = th.offsetWidth;
        const tableW = table.offsetWidth;
        resizer.classList.add("resizing");
        document.body.style.cursor = "col-resize";
        document.body.style.userSelect = "none";
        const onMove = (ev) => {
          const delta = ev.clientX - startX;
          const newColW = Math.max(40, startW + delta);
          const diff = newColW - startW;
          th.style.width = newColW + "px";
          if (col) col.style.width = newColW + "px";
          table.style.width = tableW + diff + "px";
        };
        const onUp = () => {
          resizer.classList.remove("resizing");
          document.body.style.cursor = "";
          document.body.style.userSelect = "";
          document.removeEventListener("mousemove", onMove);
          document.removeEventListener("mouseup", onUp);
        };
        document.addEventListener("mousemove", onMove);
        document.addEventListener("mouseup", onUp);
        me.preventDefault();
      });
    });
  })();
  var fpPrefHoliday = null;
  var fpPrefWeekend = null;
  var renderPrefLists = () => {
    const prefs = getPreferences();
    dom.prefHolidayList.innerHTML = "";
    for (const h of prefs.holidays) {
      const row = document.createElement("div");
      row.className = "pref-list-row";
      row.innerHTML = `<span class="pref-list-date">${h.date}</span><span class="pref-list-name">${h.name || ""}</span><button class="btn ghost small pref-list-delete">&times;</button>`;
      row.querySelector(".pref-list-delete").addEventListener("click", () => {
        removeHoliday(h.date);
        renderPrefLists();
      });
      dom.prefHolidayList.appendChild(row);
    }
    dom.prefWeekendList.innerHTML = "";
    for (const d of prefs.workWeekends) {
      const row = document.createElement("div");
      row.className = "pref-list-row";
      row.innerHTML = `<span class="pref-list-date">${d}</span><button class="btn ghost small pref-list-delete">&times;</button>`;
      row.querySelector(".pref-list-delete").addEventListener("click", () => {
        removeWorkWeekend(d);
        renderPrefLists();
      });
      dom.prefWeekendList.appendChild(row);
    }
    dom.prefMemberList.innerHTML = "";
    const members = getMembers();
    for (const name of members) {
      const row = document.createElement("div");
      row.className = "pref-list-row";
      row.innerHTML = `<span class="pref-list-name">${name}</span><button class="btn ghost small pref-list-delete">&times;</button>`;
      row.querySelector(".pref-list-delete").addEventListener("click", () => {
        removeMember(name);
        renderPrefLists();
      });
      dom.prefMemberList.appendChild(row);
    }
  };
  var openPreferences = () => {
    dom.preferencesModal.hidden = false;
    dom.prefHolidayDate.value = "";
    dom.prefHolidayName.value = "";
    dom.prefWeekendDate.value = "";
    if (fpPrefHoliday) fpPrefHoliday.destroy();
    fpPrefHoliday = flatpickr(dom.prefHolidayDate, {
      dateFormat: "Y-m-d",
      disableMobile: true,
      onOpen: (_, __, instance) => fixCalendarPosition(instance)
    });
    if (fpPrefWeekend) fpPrefWeekend.destroy();
    fpPrefWeekend = flatpickr(dom.prefWeekendDate, {
      dateFormat: "Y-m-d",
      disableMobile: true,
      disable: [(date) => date.getDay() !== 0 && date.getDay() !== 6],
      onOpen: (_, __, instance) => fixCalendarPosition(instance)
    });
    renderPrefLists();
  };
  var closePreferences = () => {
    dom.preferencesModal.hidden = true;
    if (fpPrefHoliday) {
      fpPrefHoliday.destroy();
      fpPrefHoliday = null;
    }
    if (fpPrefWeekend) {
      fpPrefWeekend.destroy();
      fpPrefWeekend = null;
    }
    render();
  };
  dom.settingsBtn.addEventListener("click", openPreferences);
  dom.prefClose.addEventListener("click", closePreferences);
  dom.prefDone.addEventListener("click", closePreferences);
  dom.preferencesModal.addEventListener("click", (e) => {
    if (e.target === dom.preferencesModal) closePreferences();
  });
  dom.prefHolidayAddBtn.addEventListener("click", () => {
    const date = dom.prefHolidayDate.value;
    const name = dom.prefHolidayName.value.trim();
    if (!date) return;
    addHoliday(date, name);
    dom.prefHolidayDate.value = "";
    dom.prefHolidayName.value = "";
    if (fpPrefHoliday) fpPrefHoliday.clear();
    renderPrefLists();
  });
  dom.prefWeekendAddBtn.addEventListener("click", () => {
    const date = dom.prefWeekendDate.value;
    if (!date) return;
    addWorkWeekend(date);
    dom.prefWeekendDate.value = "";
    if (fpPrefWeekend) fpPrefWeekend.clear();
    renderPrefLists();
  });
  var commitAddMember = () => {
    const name = dom.prefMemberName.value.trim();
    if (!name) return;
    addMember(name);
    dom.prefMemberName.value = "";
    renderPrefLists();
  };
  dom.prefMemberAddBtn.addEventListener("click", commitAddMember);
  dom.prefMemberName.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      commitAddMember();
    }
  });
  document.addEventListener("click", (e) => {
    const target = e.target;
    if (target.closest(".bp-add-btn") || target.closest(".add-by-id-row")) return;
    const highlighted = document.querySelector(".task-row-highlight");
    if (highlighted) highlighted.classList.remove("task-row-highlight");
    setHighlightBacklogTaskId(null);
  }, true);
  render();
})();
