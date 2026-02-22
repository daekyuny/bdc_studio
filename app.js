(() => {
  // src/dom.js
  var dom = {
    sprintList: document.getElementById("sprintList"),
    newSprintBtn: document.getElementById("newSprintBtn"),
    deleteSprintBtn: document.getElementById("deleteSprintBtn"),
    sprintTitleText: document.getElementById("sprintTitleText"),
    editSprintBtn: document.getElementById("editSprintBtn"),
    summaryDuration: document.getElementById("summaryDuration"),
    addTaskBtn: document.getElementById("addTaskBtn"),
    sprintToday: document.getElementById("sprintToday"),
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
    taskRowTemplate: document.getElementById("taskRowTemplate")
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
  var defaultState = () => {
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
      return parsed;
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
  var addTask = () => {
    const sprint = getActiveSprint();
    if (!sprint) return;
    sprint.tasks.push({
      id: createId(),
      name: "",
      points: 0,
      status: "Todo",
      doneDate: ""
    });
    save();
    onChange();
  };
  var removeTask = (taskId) => {
    const sprint = getActiveSprint();
    if (!sprint) return;
    sprint.tasks = sprint.tasks.filter((task) => task.id !== taskId);
    save();
    onChange();
  };
  var updateToday = (date) => {
    const sprint = getActiveSprint();
    if (!sprint || !date) return;
    const clamped = date < sprint.startDate ? sprint.startDate : date > sprint.endDate ? sprint.endDate : date;
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

  // src/burndown.js
  var calculateBurndown = (sprint, today) => {
    const dates = getWorkingDates(sprint.startDate, sprint.endDate);
    const totalPoints = sprint.tasks.reduce((sum, task) => sum + Number(task.points || 0), 0);
    const workingDays = dates.length || 0;
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
      return sprint.tasks.reduce((sum, task) => {
        const points = Number(task.points || 0);
        if (!task.doneDate) return sum + points;
        return task.doneDate > date ? sum + points : sum;
      }, 0);
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
    const plotWidth = width - padding * 2;
    const plotHeight = height - padding * 2;
    const toPoint = (value, index) => {
      const x = padding + plotWidth * (dates.length === 1 ? 0 : index / (dates.length - 1));
      const y = padding + plotHeight * (1 - value / maxValue);
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
      label.textContent = Math.round(maxValue * (1 - i / 4));
      dom.chart.appendChild(label);
    }
    dom.chart.appendChild(grid);
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
      label.textContent = showDays ? `D${index + 1}` : toShortDate(date);
      labels.appendChild(label);
    });
    dom.chart.appendChild(labels);
  };

  // src/render.js
  var fpToday = null;
  var WEEKEND = (date) => date.getDay() === 0 || date.getDay() === 6;
  var renderSprintList = () => {
    const state2 = getState();
    dom.sprintList.innerHTML = "";
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
      const nameInput = row.querySelector(".task-name");
      const pointsInput = row.querySelector(".task-points");
      const statusSelect = row.querySelector(".task-status");
      const doneInput = row.querySelector(".task-done");
      const deleteBtn = row.querySelector(".task-delete");
      nameInput.value = task.name;
      pointsInput.value = task.points;
      statusSelect.value = statusOptions.includes(task.status) ? task.status : "Todo";
      doneInput.value = task.doneDate || "";
      doneInput.min = sprint.startDate || "";
      doneInput.max = sprint.endDate || "";
      doneInput.disabled = statusSelect.value !== "Done";
      const commitName = () => updateTask(task.id, { name: nameInput.value });
      const commitPoints = () => updateTask(task.id, { points: Number(pointsInput.value) });
      nameInput.addEventListener("change", commitName);
      nameInput.addEventListener("blur", commitName);
      nameInput.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          commitName();
          nameInput.blur();
        }
      });
      pointsInput.addEventListener("change", commitPoints);
      pointsInput.addEventListener("blur", commitPoints);
      pointsInput.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          commitPoints();
          pointsInput.blur();
        }
      });
      const commitStatus = (statusValue) => {
        const status = statusValue;
        let doneDate = task.doneDate;
        if (status === "Done" && !doneDate) {
          const candidate = todayIso();
          doneDate = candidate >= sprint.startDate && candidate <= sprint.endDate ? candidate : sprint.endDate;
        }
        if (status !== "Done") doneDate = "";
        updateTask(task.id, { status, doneDate });
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
      const commitDoneDate = () => updateTask(task.id, { doneDate: doneInput.value, status: "Done" });
      doneInput.addEventListener("change", commitDoneDate);
      doneInput.addEventListener("blur", commitDoneDate);
      doneInput.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          commitDoneDate();
          doneInput.blur();
        }
      });
      deleteBtn.addEventListener("click", () => removeTask(task.id));
      dom.taskRows.appendChild(row);
    });
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
  };
  var render = () => {
    renderSprintList();
    const sprint = getActiveSprint();
    if (!sprint) return;
    patchActiveSprint({ developers: 0, efficiency: 1 });
    const real = todayIso();
    const defaultToday = real >= sprint.startDate && real <= sprint.endDate ? real : real < sprint.startDate ? sprint.startDate : sprint.endDate;
    patchActiveSprint({ today: defaultToday });
    const effectiveToday = sprint.today < sprint.startDate ? sprint.startDate : sprint.today > sprint.endDate ? sprint.endDate : sprint.today;
    const state2 = getState();
    const sprintNumber = state2.sprints.findIndex((s) => s.id === sprint.id) + 1;
    dom.sprintTitleText.textContent = sprint.description || `Sprint ${sprintNumber}`;
    if (fpToday) fpToday.destroy();
    fpToday = flatpickr(dom.sprintToday, {
      dateFormat: "Y-m-d",
      defaultDate: effectiveToday,
      minDate: sprint.startDate || null,
      maxDate: sprint.endDate || null,
      disableMobile: true,
      disable: [WEEKEND],
      onChange: ([date]) => {
        if (date) updateToday(date.toISOString().slice(0, 10));
      }
    });
    renderTasks(sprint);
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
  var exportCsv = () => {
    const sprint = getActiveSprint();
    if (!sprint) return;
    const state2 = getState();
    const sprintNumber = state2.sprints.findIndex((s) => s.id === sprint.id) + 1;
    const escape = (val) => `"${String(val ?? "").replace(/"/g, '""')}"`;
    const rows = [
      ["Task", "Days", "Status", "Done Date"].join(","),
      ...sprint.tasks.map(
        (t) => [escape(t.name), t.points, escape(t.status), escape(t.doneDate || "")].join(",")
      )
    ];
    const blob = new Blob([rows.join("\r\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `sprint-${sprintNumber}-tasks-${todayIso()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
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
        replaceState(imported);
      } catch {
        alert("Failed to parse file. Please select a valid JSON export.");
      }
    };
    reader.readAsText(file);
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
  dom.addTaskBtn.addEventListener("click", addTask);
  dom.exportCsvBtn.addEventListener("click", exportCsv);
  dom.exportBtn.addEventListener("click", exportData);
  dom.importBtn.addEventListener("click", () => dom.importFile.click());
  dom.importFile.addEventListener("change", (e) => {
    if (e.target.files[0]) importData(e.target.files[0]);
    e.target.value = "";
  });
  dom.showDayNumbers.addEventListener("change", render);
  render();
})();
