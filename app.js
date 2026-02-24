(() => {
  // src/dom.js
  var dom = {
    mainLayout: document.getElementById("mainLayout"),
    sprintSubHeader: document.getElementById("sprintSubHeader"),
    sprintList: document.getElementById("sprintList"),
    newSprintBtn: document.getElementById("newSprintBtn"),
    deleteSprintBtn: document.getElementById("deleteSprintBtn"),
    sprintTitleText: document.getElementById("sprintTitleText"),
    editSprintBtn: document.getElementById("editSprintBtn"),
    summaryDuration: document.getElementById("summaryDuration"),
    sprintToday: document.getElementById("sprintToday"),
    efficiencyDisplay: document.getElementById("efficiencyDisplay"),
    taskRows: document.getElementById("taskRows"),
    totalPoints: document.getElementById("totalPoints"),
    remainingPoints: document.getElementById("remainingPoints"),
    workingDays: document.getElementById("workingDays"),
    doneTasks: document.getElementById("doneTasks"),
    availableDays: document.getElementById("availableDays"),
    availableDaysValue: document.getElementById("availableDaysValue"),
    chart: document.getElementById("burndownChart"),
    showDayNumbers: document.getElementById("showDayNumbers"),
    exportCsvBtn: document.getElementById("exportCsvBtn"),
    exportBtn: document.getElementById("exportBtn"),
    importBtn: document.getElementById("importBtn"),
    importFile: document.getElementById("importFile"),
    sprintModal: document.getElementById("sprintModal"),
    modalTitle: document.getElementById("modalTitle"),
    modalDescription: document.getElementById("modalDescription"),
    modalStartDate: document.getElementById("modalStartDate"),
    modalWorkingDays: document.getElementById("modalWorkingDays"),
    modalEndDate: document.getElementById("modalEndDate"),
    modalDevelopers: document.getElementById("modalDevelopers"),
    modalEfficiency: document.getElementById("modalEfficiency"),
    modalError: document.getElementById("modalError"),
    modalSave: document.getElementById("modalSave"),
    modalCancel: document.getElementById("modalCancel"),
    modalClose: document.getElementById("modalClose"),
    sprintItemTemplate: document.getElementById("sprintItemTemplate"),
    taskRowTemplate: document.getElementById("taskRowTemplate"),
    // Tabs
    tabSprint: document.getElementById("tabSprint"),
    tabBacklog: document.getElementById("tabBacklog"),
    sprintView: document.getElementById("sprintView"),
    backlogView: document.getElementById("backlogView"),
    // Sprint task card — add-by-ID
    addByIdInput: document.getElementById("addByIdInput"),
    addByIdBtn: document.getElementById("addByIdBtn"),
    // Backlog panel (sprint view, drag-to-add)
    backlogPanel: document.getElementById("backlogPanel"),
    backlogPanelToggle: document.getElementById("backlogPanelToggle"),
    backlogPanelRows: document.getElementById("backlogPanelRows"),
    backlogPanelRowTemplate: document.getElementById("backlogPanelRowTemplate"),
    // Backlog view
    backlogExpandAllBtn: document.getElementById("backlogExpandAllBtn"),
    backlogCollapseAllBtn: document.getElementById("backlogCollapseAllBtn"),
    backlogAddStoryBtn: document.getElementById("backlogAddStoryBtn"),
    backlogImportCsvBtn: document.getElementById("backlogImportCsvBtn"),
    backlogExportCsvBtn: document.getElementById("backlogExportCsvBtn"),
    backlogDeleteAllBtn: document.getElementById("backlogDeleteAllBtn"),
    backlogImportFile: document.getElementById("backlogImportFile"),
    backlogTableBody: document.getElementById("backlogTableBody"),
    backlogStoryRowTemplate: document.getElementById("backlogStoryRowTemplate"),
    backlogTaskRowTemplate: document.getElementById("backlogTaskRowTemplate"),
    // Backlog "Clear All" confirm dialog
    confirmDeleteBacklogModal: document.getElementById("confirmDeleteBacklogModal"),
    confirmDeleteBacklogCancel: document.getElementById("confirmDeleteBacklogCancel"),
    confirmDeleteBacklogConfirm: document.getElementById("confirmDeleteBacklogConfirm"),
    // Task remove confirm dialog
    confirmRemoveTaskModal: document.getElementById("confirmRemoveTaskModal"),
    confirmRemoveTaskName: document.getElementById("confirmRemoveTaskName"),
    confirmRemoveTaskCancel: document.getElementById("confirmRemoveTaskCancel"),
    confirmRemoveTaskConfirm: document.getElementById("confirmRemoveTaskConfirm")
  };

  // src/utils.js
  var statusOptions = ["Todo", "In Progress", "Done"];
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
  var getWorkingDates = (startIso, endIso) => {
    if (!startIso || !endIso) return [];
    const dates = [];
    let cursor = /* @__PURE__ */ new Date(startIso + "T00:00:00");
    const end = /* @__PURE__ */ new Date(endIso + "T00:00:00");
    while (cursor <= end) {
      const day = cursor.getDay();
      if (day !== 0 && day !== 6) {
        dates.push(localIso(cursor));
      }
      cursor.setDate(cursor.getDate() + 1);
    }
    return dates;
  };
  var formatSprintRange = (sprint) => `${toShortDate(sprint.startDate)} \u2013 ${toShortDate(sprint.endDate)}`;
  var createId = () => crypto.randomUUID();
  var getNextWorkingDay = (isoDate) => {
    const d = /* @__PURE__ */ new Date(isoDate + "T00:00:00");
    d.setDate(d.getDate() + 1);
    while (d.getDay() === 0 || d.getDay() === 6) {
      d.setDate(d.getDate() + 1);
    }
    return localIso(d);
  };
  var addWorkingDays = (isoDate, n) => {
    const d = /* @__PURE__ */ new Date(isoDate + "T00:00:00");
    let count = 0;
    while (count < n) {
      d.setDate(d.getDate() + 1);
      if (d.getDay() !== 0 && d.getDay() !== 6) count++;
    }
    return localIso(d);
  };
  var sprintsOverlap = (a, b) => a.startDate <= b.endDate && a.endDate >= b.startDate;
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

  // src/state.js
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
    for (const sprint of parsed.sprints) {
      for (const task of sprint.tasks) {
        if (task.points !== void 0 && task.estimate === void 0) {
          task.estimate = task.points;
          task.actual = null;
          delete task.points;
        }
      }
    }
    return parsed;
  };
  var defaultState = () => {
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
      return migrateState(parsed);
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
    onChange();
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
    onChange();
  };
  var updateSprintById = (id, updates) => {
    const sprint = state.sprints.find((s) => s.id === id);
    if (!sprint) return;
    Object.assign(sprint, updates);
    sortSprints();
    save();
    onChange();
  };
  var deleteActiveSprint = () => {
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
        createdAt: (/* @__PURE__ */ new Date()).toISOString()
      };
      state.sprints = [newSprint];
      state.activeSprintId = newSprint.id;
    } else {
      state.activeSprintId = state.sprints[0].id;
    }
    save();
    onChange();
  };
  var updateTask = (taskId, updates) => {
    const sprint = getActiveSprint();
    if (!sprint) return;
    const task = sprint.tasks.find((item) => item.id === taskId);
    if (!task) return;
    Object.assign(task, updates);
    save();
    onChange();
  };
  var removeTaskFromSprint = (taskId) => {
    const sprint = getActiveSprint();
    if (!sprint) return;
    sprint.tasks = sprint.tasks.filter((task) => task.id !== taskId);
    save();
    onChange();
  };
  var addTaskFromBacklog = (backlogTaskId) => {
    const sprint = getActiveSprint();
    if (!sprint) return;
    let foundTask = null, foundStory = null;
    for (const story of state.backlog.stories) {
      for (const t of story.tasks) {
        if (t.id === backlogTaskId) {
          foundTask = t;
          foundStory = story;
          break;
        }
      }
      if (foundTask) break;
    }
    if (!foundTask) return;
    if (sprint.tasks.some((t) => t.backlogTaskId === backlogTaskId)) return;
    sprint.tasks.push({
      id: createId(),
      backlogTaskId,
      taskId: foundTask.taskId,
      name: foundTask.description,
      assignedTo: foundTask.assignedTo,
      estimate: Number(foundTask.estimate) || 0,
      actual: null,
      status: "Todo",
      doneDate: ""
    });
    save();
    onChange();
  };
  var updateToday = (date) => {
    const sprint = getActiveSprint();
    if (!sprint || !date) return;
    const maxDate = sprint.endDate ? getNextWorkingDay(sprint.endDate) : sprint.endDate;
    const clamped = date < sprint.startDate ? sprint.startDate : date > maxDate ? maxDate : date;
    sprint.today = clamped;
    save();
    onChange();
  };
  var replaceState = (newState) => {
    state = newState;
    save();
    onChange();
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
    onChange();
    return id;
  };
  var updateStory = (id, updates) => {
    const story = state.backlog.stories.find((s) => s.id === id);
    if (!story) return;
    Object.assign(story, updates);
    save();
    onChange();
  };
  var deleteStory = (id) => {
    state.backlog.stories = state.backlog.stories.filter((s) => s.id !== id);
    save();
    onChange();
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
    onChange();
    return id;
  };
  var updateBacklogTask = (storyId, taskId, updates) => {
    const story = state.backlog.stories.find((s) => s.id === storyId);
    if (!story) return;
    const task = story.tasks.find((t) => t.id === taskId);
    if (!task) return;
    Object.assign(task, updates);
    save();
    onChange();
  };
  var deleteBacklogTask = (storyId, taskId) => {
    const story = state.backlog.stories.find((s) => s.id === storyId);
    if (!story) return;
    story.tasks = story.tasks.filter((t) => t.id !== taskId);
    save();
    onChange();
  };
  var replaceBacklog = (newBacklog) => {
    state.backlog = newBacklog;
    save();
    onChange();
  };

  // src/burndown.js
  var calculateBurndown = (sprint, today) => {
    const sprintDates = getWorkingDates(sprint.startDate, sprint.endDate);
    const extraDay = sprint.endDate ? getNextWorkingDay(sprint.endDate) : null;
    const dates = extraDay ? [...sprintDates, extraDay] : sprintDates;
    const totalPoints = sprint.tasks.reduce((sum, task) => sum + Number(task.estimate || 0), 0);
    const workingDays = sprintDates.length || 0;
    const developers = Math.max(0, Number(sprint.developers || 0));
    const efficiency = Math.min(1, Math.max(0, Number(sprint.efficiency || 0)));
    const manDays = developers * workingDays;
    const effectiveManDays = manDays * efficiency;
    const idealDailyBurn = workingDays > 0 ? effectiveManDays / workingDays : 0;
    const ideal = dates.map((_, index) => {
      if (dates.length <= 1) return totalPoints;
      const remaining = totalPoints - idealDailyBurn * index;
      return Math.round(Math.max(remaining, 0) * 100) / 100;
    });
    const todayIndex = dates.reduce((last, date, i) => date <= today ? i : last, -1);
    const actual = dates.map((date, i) => {
      if (todayIndex < 0 || i > todayIndex) return null;
      const burned = sprint.tasks.reduce((sum, task) => {
        if (!task.doneDate || task.doneDate > date) return sum;
        return sum + Number(task.actual != null ? task.actual : task.estimate || 0);
      }, 0);
      return totalPoints - burned;
    });
    return { dates, totalPoints, ideal, actual, manDays, effectiveManDays, idealDailyBurn, todayIndex };
  };

  // src/chart.js
  var drawChart = ({ dates, totalPoints, ideal, actual, todayIndex }) => {
    const width = 800;
    const height = 320;
    const padding = 50;
    dom.chart.setAttribute("viewBox", `0 0 ${width} ${height}`);
    dom.chart.innerHTML = "";
    if (!dates.length) {
      const emptyText = document.createElementNS("http://www.w3.org/2000/svg", "text");
      emptyText.setAttribute("x", width / 2);
      emptyText.setAttribute("y", height / 2);
      emptyText.setAttribute("text-anchor", "middle");
      emptyText.setAttribute("fill", "#6b7080");
      emptyText.textContent = "Set sprint dates to see the chart.";
      dom.chart.appendChild(emptyText);
      return;
    }
    const nonNullActual = actual.filter((v) => v !== null);
    const maxValue = Math.max(totalPoints, ...nonNullActual, 1);
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
      line.setAttribute("x1", padding);
      line.setAttribute("x2", width - padding);
      line.setAttribute("y1", y);
      line.setAttribute("y2", y);
      grid.appendChild(line);
      const label = document.createElementNS("http://www.w3.org/2000/svg", "text");
      label.setAttribute("x", 14);
      label.setAttribute("y", y + 4);
      label.setAttribute("fill", "#6b7080");
      label.setAttribute("font-size", "11");
      label.textContent = Math.round(maxValue - range * (i / 4));
      dom.chart.appendChild(label);
    }
    dom.chart.appendChild(grid);
    if (minValue < 0) {
      const zeroY = padding + plotHeight * (1 - (0 - minValue) / range);
      const zeroLine = document.createElementNS("http://www.w3.org/2000/svg", "line");
      zeroLine.setAttribute("x1", padding);
      zeroLine.setAttribute("x2", width - padding);
      zeroLine.setAttribute("y1", zeroY);
      zeroLine.setAttribute("y2", zeroY);
      zeroLine.setAttribute("stroke", "rgba(44, 47, 58, 0.3)");
      zeroLine.setAttribute("stroke-width", "1.5");
      zeroLine.setAttribute("stroke-dasharray", "4 3");
      dom.chart.appendChild(zeroLine);
    }
    if (todayIndex >= 0) {
      const tx = padding + plotWidth * (dates.length === 1 ? 0 : todayIndex / (dates.length - 1));
      const todayLine = document.createElementNS("http://www.w3.org/2000/svg", "line");
      todayLine.setAttribute("x1", tx);
      todayLine.setAttribute("x2", tx);
      todayLine.setAttribute("y1", padding);
      todayLine.setAttribute("y2", height - padding);
      todayLine.setAttribute("stroke", "rgba(92, 103, 242, 0.45)");
      todayLine.setAttribute("stroke-width", "1.5");
      todayLine.setAttribute("stroke-dasharray", "4 3");
      dom.chart.appendChild(todayLine);
      const todayLabel = document.createElementNS("http://www.w3.org/2000/svg", "text");
      todayLabel.setAttribute("x", tx + 4);
      todayLabel.setAttribute("y", padding + 12);
      todayLabel.setAttribute("fill", "rgba(92, 103, 242, 0.65)");
      todayLabel.setAttribute("font-size", "10");
      todayLabel.textContent = "Today";
      dom.chart.appendChild(todayLabel);
    }
    const idealLine = document.createElementNS("http://www.w3.org/2000/svg", "polyline");
    idealLine.setAttribute("fill", "none");
    idealLine.setAttribute("stroke", "#3b82f6");
    idealLine.setAttribute("stroke-width", "3");
    idealLine.setAttribute("points", ideal.map(toPoint).join(" "));
    dom.chart.appendChild(idealLine);
    const actualPoints = actual.map((val, i) => val !== null ? toPoint(val, i) : null).filter(Boolean);
    const actualLine = document.createElementNS("http://www.w3.org/2000/svg", "polyline");
    actualLine.setAttribute("fill", "none");
    actualLine.setAttribute("stroke", "#ef4444");
    actualLine.setAttribute("stroke-width", "3");
    actualLine.setAttribute("points", actualPoints.join(" "));
    actualLine.style.strokeDasharray = "1000";
    actualLine.style.strokeDashoffset = "1000";
    actualLine.style.animation = "dash 1.6s ease forwards";
    dom.chart.appendChild(actualLine);
    const labels = document.createElementNS("http://www.w3.org/2000/svg", "g");
    labels.setAttribute("font-size", "11");
    labels.setAttribute("fill", "#6b7080");
    const showDays = dom.showDayNumbers.checked;
    dates.forEach((date, index) => {
      const x = padding + plotWidth * (dates.length === 1 ? 0 : index / (dates.length - 1));
      const label = document.createElementNS("http://www.w3.org/2000/svg", "text");
      label.setAttribute("x", x);
      label.setAttribute("y", height - 18);
      label.setAttribute("text-anchor", "middle");
      label.textContent = showDays ? `D${index}` : toShortDate(date);
      labels.appendChild(label);
    });
    dom.chart.appendChild(labels);
  };

  // src/render.js
  var fpToday = null;
  var WEEKEND = (date) => date.getDay() === 0 || date.getDay() === 6;
  var activeTab = "sprint";
  var setActiveTab = (tab) => {
    activeTab = tab;
    render();
  };
  var editingIds = /* @__PURE__ */ new Set();
  var expandedStoryIds = /* @__PURE__ */ new Set();
  var startEditing = (id, focusAfter = false) => {
    if (!id) return;
    editingIds.clear();
    editingIds.add(id);
    render();
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
    render();
  };
  var collapseAll = () => {
    expandedStoryIds.clear();
    render();
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
  var renderTasks = (sprint) => {
    dom.taskRows.innerHTML = "";
    sprint.tasks.forEach((task) => {
      const row = dom.taskRowTemplate.content.firstElementChild.cloneNode(true);
      row.dataset.taskId = task.id;
      const taskIdSpan = row.querySelector(".task-taskid");
      const nameSpan = row.querySelector(".task-name");
      const estimateSpan = row.querySelector(".task-estimate");
      const actualInput = row.querySelector(".task-actual");
      const statusSelect = row.querySelector(".task-status");
      const doneInput = row.querySelector(".task-done");
      const removeBtn = row.querySelector(".task-remove");
      taskIdSpan.textContent = task.taskId || "";
      nameSpan.textContent = task.name;
      nameSpan.title = task.assignedTo || "";
      estimateSpan.textContent = task.estimate ?? "";
      actualInput.value = task.actual ?? "";
      actualInput.disabled = task.status !== "Done";
      statusSelect.value = statusOptions.includes(task.status) ? task.status : "Todo";
      doneInput.value = task.doneDate || "";
      doneInput.disabled = statusSelect.value !== "Done";
      if (statusSelect.value === "Done") {
        flatpickr(doneInput, {
          dateFormat: "Y-m-d",
          defaultDate: task.doneDate || null,
          minDate: sprint.startDate || null,
          maxDate: sprint.endDate || null,
          disableMobile: true,
          disable: [WEEKEND],
          allowInput: false,
          onChange: ([date]) => {
            if (date) {
              updateTask(task.id, { doneDate: localIso(date), status: "Done" });
            }
          }
        });
      }
      const commitActual = () => {
        const val = actualInput.value;
        updateTask(task.id, { actual: val === "" ? null : Number(val) });
      };
      actualInput.addEventListener("change", commitActual);
      actualInput.addEventListener("blur", commitActual);
      actualInput.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          commitActual();
          actualInput.blur();
        }
      });
      const commitStatus = (statusValue) => {
        const status = statusValue;
        let doneDate = task.doneDate;
        let actual = task.actual;
        if (status === "Done" && !doneDate) {
          const candidate = sprint.today || todayIso();
          doneDate = candidate >= sprint.startDate && candidate <= sprint.endDate ? candidate : sprint.endDate;
        }
        if (status === "Done" && (actual === null || actual === void 0)) {
          actual = task.estimate;
        }
        if (status !== "Done") {
          doneDate = "";
          actual = null;
        }
        updateTask(task.id, { status, doneDate, actual });
        if (status === "Done") {
          const tid = task.id;
          setTimeout(() => {
            const found = dom.taskRows.querySelector(`[data-task-id="${tid}"]`);
            found?.querySelector(".task-actual")?.focus();
          }, 0);
        }
      };
      statusSelect.addEventListener("change", (e) => commitStatus(e.target.value));
      statusSelect.addEventListener("blur", (e) => commitStatus(e.target.value));
      statusSelect.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          commitStatus(e.target.value);
          statusSelect.blur();
        }
      });
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
        row.classList.add("drag-over");
      });
      row.addEventListener("dragleave", () => row.classList.remove("drag-over"));
      row.addEventListener("drop", (e) => {
        e.preventDefault();
        row.classList.remove("drag-over");
        const backlogTaskId = e.dataTransfer.getData("backlogTaskId");
        if (backlogTaskId) addTaskFromBacklog(backlogTaskId);
      });
      dom.taskRows.appendChild(row);
    });
  };
  var renderBacklogPanel = (sprint) => {
    const backlog = getBacklog();
    if (!backlog || !dom.backlogPanelRows) return;
    const assignedIds = new Set(sprint.tasks.map((t) => t.backlogTaskId).filter(Boolean));
    dom.backlogPanelRows.innerHTML = "";
    for (const story of backlog.stories) {
      for (const task of story.tasks) {
        if (assignedIds.has(task.id)) continue;
        const row = dom.backlogPanelRowTemplate.content.firstElementChild.cloneNode(true);
        row.querySelector(".bp-taskid").textContent = task.taskId || "";
        row.querySelector(".bp-description").textContent = task.description;
        row.querySelector(".bp-estimate").textContent = task.estimate ?? "";
        row.addEventListener("dragstart", (e) => {
          e.dataTransfer.setData("backlogTaskId", task.id);
        });
        row.querySelector(".bp-add-btn").addEventListener("click", () => {
          addTaskFromBacklog(task.id);
        });
        dom.backlogPanelRows.appendChild(row);
      }
    }
  };
  var renderBacklog = () => {
    const backlog = getBacklog();
    if (!backlog) return;
    const sprint = getActiveSprint();
    const assignedIds = new Set(sprint?.tasks.map((t) => t.backlogTaskId).filter(Boolean) || []);
    dom.backlogTableBody.innerHTML = "";
    for (const story of backlog.stories) {
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
        render();
      });
      storyIdView.textContent = story.storyId || "";
      storyDescView.textContent = story.description || "";
      storyPriorityView.textContent = story.priority ?? 100;
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
        storyPriorityEdit.value = story.priority ?? 100;
        storyPriorityEdit.addEventListener("keydown", (e) => {
          const cur = parseInt(storyPriorityEdit.value, 10) || 0;
          if (e.key === "ArrowUp") {
            e.preventDefault();
            storyPriorityEdit.value = Math.floor(cur / 10) * 10 + 10;
          } else if (e.key === "ArrowDown") {
            e.preventDefault();
            storyPriorityEdit.value = Math.max(0, Math.ceil(cur / 10) * 10 - 10);
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
        render();
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
        render();
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
        for (const task of story.tasks) {
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
          taskEstView.textContent = task.estimate ?? "";
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
            taskEstEdit.value = task.estimate ?? "";
            taskAssignedView.hidden = true;
            taskAssignedEdit.hidden = false;
            taskAssignedEdit.value = task.assignedTo || "";
            taskEditBtn.hidden = true;
            taskSaveBtn.hidden = false;
            taskCancelBtn.hidden = false;
            taskDeleteBtn.hidden = false;
          }
          taskEditBtn.addEventListener("click", () => {
            editingIds.clear();
            editingIds.add(task.id);
            render();
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
            render();
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
  var renderStats = (sprint, burndown) => {
    const doneTasks = sprint.tasks.filter((t) => t.status === "Done").length;
    const availableDays = burndown.effectiveManDays - burndown.totalPoints;
    dom.summaryDuration.textContent = formatSprintRange(sprint);
    dom.workingDays.textContent = burndown.dates.length;
    dom.totalPoints.textContent = burndown.totalPoints.toFixed(1).replace(/\.0$/, "");
    const lastActual = [...burndown.actual].reverse().find((v) => v !== null) ?? 0;
    dom.remainingPoints.textContent = lastActual.toFixed(1).replace(/\.0$/, "");
    dom.doneTasks.textContent = doneTasks;
    dom.availableDaysValue.textContent = availableDays.toFixed(1).replace(/\.0$/, "");
    dom.availableDays.classList.remove("ok", "alert");
    if (availableDays < -1) {
      dom.availableDays.classList.add("alert");
    } else if (availableDays >= -1 && availableDays <= 1) {
      dom.availableDays.classList.add("ok");
    }
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
  var render = () => {
    dom.tabSprint.classList.toggle("active", activeTab === "sprint");
    dom.tabBacklog.classList.toggle("active", activeTab === "backlog");
    dom.sprintView.hidden = activeTab !== "sprint";
    dom.backlogView.hidden = activeTab !== "backlog";
    dom.sprintSubHeader.hidden = activeTab === "backlog";
    renderSprintList();
    if (activeTab === "backlog") {
      renderBacklog();
      return;
    }
    const sprint = getActiveSprint();
    if (!sprint) return;
    patchActiveSprint({ developers: 0, efficiency: 1 });
    const maxToday = sprint.endDate ? getNextWorkingDay(sprint.endDate) : sprint.endDate;
    const real = todayIso();
    const defaultToday = real >= sprint.startDate && real <= maxToday ? real : real < sprint.startDate ? sprint.startDate : maxToday;
    patchActiveSprint({ today: defaultToday });
    const effectiveToday = sprint.today < sprint.startDate ? sprint.startDate : sprint.today > maxToday ? maxToday : sprint.today;
    const state2 = getState();
    const sprintNumber = state2.sprints.findIndex((s) => s.id === sprint.id) + 1;
    dom.sprintTitleText.textContent = sprint.description || `Sprint ${sprintNumber}`;
    if (fpToday) fpToday.destroy();
    fpToday = flatpickr(dom.sprintToday, {
      dateFormat: "Y-m-d",
      defaultDate: effectiveToday,
      minDate: sprint.startDate || null,
      maxDate: maxToday || null,
      disableMobile: true,
      disable: [WEEKEND],
      onChange: ([date]) => {
        if (date) updateToday(localIso(date));
      }
    });
    renderTasks(sprint);
    renderBacklogPanel(sprint);
    const burndown = calculateBurndown(sprint, effectiveToday);
    renderStats(sprint, burndown);
    drawChart(burndown);
  };

  // src/io.js
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
      ["Task ID", "Task", "Estimate", "Actual", "Status", "Done Date"],
      ...sprint.tasks.map((t) => [t.taskId || "", t.name, t.estimate ?? "", t.actual ?? "", t.status, t.doneDate || ""])
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
          task.actual = null;
          delete task.points;
        }
      }
    }
    return imported;
  };
  var importData = (file) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const imported = JSON.parse(e.target.result);
        if (!imported || !Array.isArray(imported.sprints)) {
          alert("Invalid file: expected a Burndown Studio JSON export.");
          return;
        }
        const confirmImport = window.confirm(
          `Import ${imported.sprints.length} sprint(s)? This will replace all current data.`
        );
        if (!confirmImport) return;
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
    reader.onload = (e) => {
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
      const warning = hasExisting ? `Warning: This will permanently replace all ${existing.stories.length} existing story/stories with ${stories.length} imported story/stories.

This cannot be undone. Proceed?` : `Import ${stories.length} story/stories into the backlog?`;
      if (!window.confirm(warning)) return;
      replaceBacklog({ stories });
    };
    reader.readAsArrayBuffer(file);
  };

  // src/main.js
  setOnStateChange(render);
  var fpStart = null;
  var fpEnd = null;
  var getDisabledRanges = (excludeId) => {
    const others = getState().sprints.filter((s) => s.id !== excludeId);
    return [
      (date) => date.getDay() === 0 || date.getDay() === 6,
      // weekends
      ...others.map((s) => ({ from: s.startDate, to: s.endDate }))
      // occupied ranges
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
      const startIso = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, "0")}-${String(start.getDate()).padStart(2, "0")}`;
      const endIso = `${end.getFullYear()}-${String(end.getMonth() + 1).padStart(2, "0")}-${String(end.getDate()).padStart(2, "0")}`;
      const count = getWorkingDates(startIso, endIso).length;
      dom.modalWorkingDays.textContent = `${count} working days`;
    } else {
      dom.modalWorkingDays.textContent = "";
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
      onOpen: (_, __, instance) => fixCalendarPosition(instance),
      onChange: () => updateWorkingDaysChip()
    };
    fpStart = flatpickr(dom.modalStartDate, { ...base, defaultDate: defaultStart || null });
    fpEnd = flatpickr(dom.modalEndDate, { ...base, defaultDate: defaultEnd || null });
    updateWorkingDaysChip();
  };
  var modalMode = "edit";
  var modalSprintId = null;
  var openModal = (mode, sprint) => {
    modalMode = mode;
    modalSprintId = sprint ? sprint.id : null;
    dom.modalTitle.textContent = mode === "create" ? "New Sprint" : "Edit Sprint";
    dom.modalDescription.value = sprint?.description || "";
    dom.modalDevelopers.value = sprint?.developers ?? 4;
    dom.modalEfficiency.value = sprint?.efficiency ?? 0.8;
    dom.modalError.hidden = true;
    dom.sprintModal.hidden = false;
    initDatePickers(sprint?.id || null, sprint?.startDate, sprint?.endDate);
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
    if (!startDate || !endDate || startDate > endDate) {
      dom.modalError.textContent = "Please select a valid start and end date.";
      dom.modalError.hidden = false;
      return;
    }
    const state2 = getState();
    const otherSprints = state2.sprints.filter((s) => s.id !== modalSprintId);
    const conflicting = otherSprints.find((s) => sprintsOverlap({ startDate, endDate }, s));
    if (conflicting) {
      const conflictNum = state2.sprints.indexOf(conflicting) + 1;
      dom.modalError.textContent = `Date range overlaps with Sprint ${conflictNum}. Please choose different dates.`;
      dom.modalError.hidden = false;
      return;
    }
    const updates = { description, startDate, endDate, developers, efficiency };
    if (modalMode === "create") {
      createSprint(updates);
    } else {
      updateSprintById(modalSprintId, updates);
    }
    closeModal();
    const gaps = findGaps(getState().sprints);
    if (gaps.length > 0) {
      alert("Note: There is a gap of working days between some sprints. You can close the gap by editing the sprint dates.");
    }
  });
  dom.newSprintBtn.addEventListener("click", () => {
    const sprints = getState().sprints;
    const latestEnd = sprints.length > 0 ? sprints[sprints.length - 1].endDate : "";
    const start = latestEnd ? getNextWorkingDay(latestEnd) : todayIso();
    const end = addWorkingDays(start, 10);
    openModal("create", { description: "", startDate: start, endDate: end, developers: 0, efficiency: 1 });
  });
  dom.editSprintBtn.addEventListener("click", () => {
    const sprint = getActiveSprint();
    if (sprint) openModal("edit", sprint);
  });
  dom.deleteSprintBtn.addEventListener("click", deleteActiveSprint);
  if (dom.exportCsvBtn) dom.exportCsvBtn.addEventListener("click", exportSprintExcel);
  dom.exportBtn.addEventListener("click", exportData);
  dom.importBtn.addEventListener("click", () => dom.importFile.click());
  dom.importFile.addEventListener("change", (e) => {
    if (e.target.files[0]) importData(e.target.files[0]);
    e.target.value = "";
  });
  dom.showDayNumbers.addEventListener("change", render);
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
    if (backlogTaskId) addTaskFromBacklog(backlogTaskId);
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
    if (e.target.files[0]) importBacklogExcel(e.target.files[0]);
    e.target.value = "";
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
        const startX = e.clientX;
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
        e.preventDefault();
      });
    });
  })();
  render();
})();
