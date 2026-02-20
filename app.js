const STORAGE_KEY = "burndown-studio";

const dom = {
  sprintList: document.getElementById("sprintList"),
  newSprintBtn: document.getElementById("newSprintBtn"),
  deleteSprintBtn: document.getElementById("deleteSprintBtn"),
  sprintName: document.getElementById("sprintName"),
  startDate: document.getElementById("startDate"),
  endDate: document.getElementById("endDate"),
  developers: document.getElementById("developers"),
  efficiency: document.getElementById("efficiency"),
  addTaskBtn: document.getElementById("addTaskBtn"),
  taskRows: document.getElementById("taskRows"),
  totalPoints: document.getElementById("totalPoints"),
  remainingPoints: document.getElementById("remainingPoints"),
  workingDays: document.getElementById("workingDays"),
  doneTasks: document.getElementById("doneTasks"),
  manDays: document.getElementById("manDays"),
  effectiveManDays: document.getElementById("effectiveManDays"),
  idealBurn: document.getElementById("idealBurn"),
  availableDays: document.getElementById("availableDays"),
  availableDaysValue: document.getElementById("availableDaysValue"),
  chart: document.getElementById("burndownChart"),
  showDayNumbers: document.getElementById("showDayNumbers"),
  sprintItemTemplate: document.getElementById("sprintItemTemplate"),
  taskRowTemplate: document.getElementById("taskRowTemplate"),
};

const statusOptions = ["Todo", "In Progress", "Done"];

const todayIso = () => new Date().toISOString().slice(0, 10);

const addDays = (isoDate, days) => {
  const date = new Date(isoDate);
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
};

const toShortDate = (isoDate) => {
  if (!isoDate) return "";
  const date = new Date(isoDate + "T00:00:00");
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
};

const getWorkingDates = (startIso, endIso) => {
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

const formatSprintRange = (sprint) =>
  `${toShortDate(sprint.startDate)} – ${toShortDate(sprint.endDate)}`;

const createId = () => crypto.randomUUID();

const loadState = () => {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (raw) return JSON.parse(raw);

  const start = todayIso();
  const end = addDays(start, 13);
  const sprintId = createId();

  return {
    activeSprintId: sprintId,
    sprints: [
      {
        id: sprintId,
        name: "Sprint Alpha",
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

const saveState = (state) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
};

let state = loadState();

const getActiveSprint = () =>
  state.sprints.find((sprint) => sprint.id === state.activeSprintId);

const setActiveSprint = (id) => {
  state.activeSprintId = id;
  saveState(state);
  render();
};

const updateSprint = (updates) => {
  const sprint = getActiveSprint();
  if (!sprint) return;
  Object.assign(sprint, updates);
  saveState(state);
  render();
};

const updateTask = (taskId, updates) => {
  const sprint = getActiveSprint();
  if (!sprint) return;
  const task = sprint.tasks.find((item) => item.id === taskId);
  if (!task) return;
  Object.assign(task, updates);
  saveState(state);
  render();
};

const addSprint = () => {
  const start = todayIso();
  const end = addDays(start, 13);
  const newSprint = {
    id: createId(),
    name: `Sprint ${state.sprints.length + 1}`,
    startDate: start,
    endDate: end,
    developers: 4,
    efficiency: 0.8,
    tasks: [],
    createdAt: new Date().toISOString(),
  };
  state.sprints = [newSprint, ...state.sprints];
  state.activeSprintId = newSprint.id;
  saveState(state);
  render();
};

const deleteActiveSprint = () => {
  const sprint = getActiveSprint();
  if (!sprint) return;
  const confirmDelete = window.confirm(
    `Delete "${sprint.name || "Untitled Sprint"}"? This cannot be undone.`
  );
  if (!confirmDelete) return;

  state.sprints = state.sprints.filter((item) => item.id !== sprint.id);
  if (state.sprints.length === 0) {
    const start = todayIso();
    const end = addDays(start, 13);
    const newSprint = {
      id: createId(),
      name: "Sprint 1",
      startDate: start,
      endDate: end,
      developers: 4,
      efficiency: 0.8,
      tasks: [],
      createdAt: new Date().toISOString(),
    };
    state.sprints = [newSprint];
    state.activeSprintId = newSprint.id;
  } else {
    state.activeSprintId = state.sprints[0].id;
  }
  saveState(state);
  render();
};

const addTask = () => {
  const sprint = getActiveSprint();
  if (!sprint) return;
  sprint.tasks.push({
    id: createId(),
    name: "",
    points: 0,
    status: "Todo",
    doneDate: "",
  });
  saveState(state);
  render();
};

const removeTask = (taskId) => {
  const sprint = getActiveSprint();
  if (!sprint) return;
  sprint.tasks = sprint.tasks.filter((task) => task.id !== taskId);
  saveState(state);
  render();
};

const calculateBurndown = (sprint) => {
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
  const actual = dates.map((date) => {
    return sprint.tasks.reduce((sum, task) => {
      const points = Number(task.points || 0);
      if (!task.doneDate) return sum + points;
      return task.doneDate > date ? sum + points : sum;
    }, 0);
  });

  return { dates, totalPoints, ideal, actual, manDays, effectiveManDays, idealDailyBurn };
};

const renderSprintList = () => {
  dom.sprintList.innerHTML = "";
  state.sprints.forEach((sprint) => {
    const node = dom.sprintItemTemplate.content.firstElementChild.cloneNode(true);
    node.querySelector(".sprint-title").textContent = sprint.name || "Untitled Sprint";
    node.querySelector(".sprint-dates").textContent = formatSprintRange(sprint);
    if (sprint.id === state.activeSprintId) node.classList.add("active");
    node.addEventListener("click", () => setActiveSprint(sprint.id));
    dom.sprintList.appendChild(node);
  });
};

const renderTasks = (sprint) => {
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
    const commitPoints = () =>
      updateTask(task.id, { points: Number(pointsInput.value) });

    nameInput.addEventListener("change", commitName);
    nameInput.addEventListener("blur", commitName);
    nameInput.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        commitName();
        nameInput.blur();
      }
    });

    pointsInput.addEventListener("change", commitPoints);
    pointsInput.addEventListener("blur", commitPoints);
    pointsInput.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        commitPoints();
        pointsInput.blur();
      }
    });
    const commitStatus = (statusValue) => {
      const status = statusValue;
      let doneDate = task.doneDate;
      if (status === "Done" && !doneDate) {
        const candidate = todayIso();
        doneDate = candidate >= sprint.startDate && candidate <= sprint.endDate
          ? candidate
          : sprint.endDate;
      }
      if (status !== "Done") doneDate = "";
      updateTask(task.id, { status, doneDate });
    };

    statusSelect.addEventListener("change", (event) => {
      commitStatus(event.target.value);
    });
    statusSelect.addEventListener("blur", (event) => {
      commitStatus(event.target.value);
    });
    statusSelect.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        commitStatus(event.target.value);
        statusSelect.blur();
      }
    });

    const commitDoneDate = () =>
      updateTask(task.id, { doneDate: doneInput.value, status: "Done" });

    doneInput.addEventListener("change", commitDoneDate);
    doneInput.addEventListener("blur", commitDoneDate);
    doneInput.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        commitDoneDate();
        doneInput.blur();
      }
    });
    deleteBtn.addEventListener("click", () => removeTask(task.id));

    dom.taskRows.appendChild(row);
  });
};

const drawChart = ({ dates, totalPoints, ideal, actual }) => {
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
    emptyText.setAttribute("fill", "#6d6458");
    emptyText.textContent = "Set sprint dates to see the chart.";
    dom.chart.appendChild(emptyText);
    return;
  }

  const maxValue = Math.max(totalPoints, ...actual, 1);
  const plotWidth = width - padding * 2;
  const plotHeight = height - padding * 2;

  const toPoint = (value, index) => {
    const x = padding + (plotWidth * (dates.length === 1 ? 0 : index / (dates.length - 1)));
    const y = padding + (plotHeight * (1 - value / maxValue));
    return `${x},${y}`;
  };

  const grid = document.createElementNS("http://www.w3.org/2000/svg", "g");
  grid.setAttribute("stroke", "rgba(43, 42, 42, 0.12)");
  for (let i = 0; i <= 4; i++) {
    const y = padding + (plotHeight * (i / 4));
    const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
    line.setAttribute("x1", padding);
    line.setAttribute("x2", width - padding);
    line.setAttribute("y1", y);
    line.setAttribute("y2", y);
    grid.appendChild(line);

    const label = document.createElementNS("http://www.w3.org/2000/svg", "text");
    label.setAttribute("x", 14);
    label.setAttribute("y", y + 4);
    label.setAttribute("fill", "#6d6458");
    label.setAttribute("font-size", "11");
    label.textContent = Math.round(maxValue * (1 - i / 4));
    dom.chart.appendChild(label);
  }
  dom.chart.appendChild(grid);

  const idealLine = document.createElementNS("http://www.w3.org/2000/svg", "polyline");
  idealLine.setAttribute("fill", "none");
  idealLine.setAttribute("stroke", "#2a9d57");
  idealLine.setAttribute("stroke-width", "3");
  idealLine.setAttribute("points", ideal.map(toPoint).join(" "));
  dom.chart.appendChild(idealLine);

  const actualLine = document.createElementNS("http://www.w3.org/2000/svg", "polyline");
  actualLine.setAttribute("fill", "none");
  actualLine.setAttribute("stroke", "#3d405b");
  actualLine.setAttribute("stroke-width", "3");
  actualLine.setAttribute("points", actual.map(toPoint).join(" "));
  actualLine.style.strokeDasharray = "1000";
  actualLine.style.strokeDashoffset = "1000";
  actualLine.style.animation = "dash 1.6s ease forwards";
  dom.chart.appendChild(actualLine);

  const labels = document.createElementNS("http://www.w3.org/2000/svg", "g");
  labels.setAttribute("font-size", "11");
  labels.setAttribute("fill", "#6d6458");

  dates.forEach((date, index) => {
    const x = padding + (plotWidth * (dates.length === 1 ? 0 : index / (dates.length - 1)));
    const label = document.createElementNS("http://www.w3.org/2000/svg", "text");
    label.setAttribute("x", x);
    label.setAttribute("y", height - 18);
    label.setAttribute("text-anchor", "middle");
    const dayLabel = `D${index + 1}`;
    label.textContent = dayLabel;
    labels.appendChild(label);
  });
  dom.chart.appendChild(labels);
};

const renderStats = (sprint, burndown) => {
  const doneTasks = sprint.tasks.filter((task) => task.status === "Done").length;
  const availableDays = burndown.dates.length - burndown.totalPoints;
  dom.totalPoints.textContent = burndown.totalPoints.toFixed(1).replace(/\.0$/, "");
  dom.remainingPoints.textContent =
    (burndown.actual[burndown.actual.length - 1] || 0).toFixed(1).replace(/\.0$/, "");
  dom.workingDays.textContent = burndown.dates.length;
  dom.doneTasks.textContent = doneTasks;
  dom.manDays.textContent = burndown.manDays.toFixed(1).replace(/\.0$/, "");
  dom.effectiveManDays.textContent = burndown.effectiveManDays.toFixed(1).replace(/\.0$/, "");
  dom.idealBurn.textContent = burndown.idealDailyBurn.toFixed(2).replace(/0$/, "").replace(/\.0$/, "");

  dom.availableDaysValue.textContent = availableDays.toFixed(1).replace(/\.0$/, "");
  dom.availableDays.classList.remove("ok", "alert");
  if (availableDays < -1) {
    dom.availableDays.classList.add("alert");
  } else if (availableDays >= -1 && availableDays <= 1) {
    dom.availableDays.classList.add("ok");
  }
};

const render = () => {
  renderSprintList();
  const sprint = getActiveSprint();
  if (!sprint) return;
  let needsSave = false;
  if (sprint.developers === undefined || sprint.developers === null) {
    sprint.developers = 4;
    needsSave = true;
  }
  if (sprint.efficiency === undefined || sprint.efficiency === null) {
    sprint.efficiency = 0.8;
    needsSave = true;
  }
  if (needsSave) saveState(state);

  dom.sprintName.value = sprint.name;
  dom.startDate.value = sprint.startDate;
  dom.endDate.value = sprint.endDate;
  dom.developers.value = sprint.developers ?? "";
  dom.efficiency.value = sprint.efficiency ?? "";

  renderTasks(sprint);
  const burndown = calculateBurndown(sprint);
  renderStats(sprint, burndown);
  drawChart(burndown);
};

const init = () => {
  dom.newSprintBtn.addEventListener("click", addSprint);
  dom.deleteSprintBtn.addEventListener("click", deleteActiveSprint);
  dom.addTaskBtn.addEventListener("click", addTask);

  const commitSprintName = () => updateSprint({ name: dom.sprintName.value });
  const commitStartDate = () => updateSprint({ startDate: dom.startDate.value });
  const commitEndDate = () => updateSprint({ endDate: dom.endDate.value });
  const commitDevelopers = () =>
    updateSprint({ developers: Number(dom.developers.value) });
  const commitEfficiency = () =>
    updateSprint({ efficiency: Number(dom.efficiency.value) });

  dom.sprintName.addEventListener("change", commitSprintName);
  dom.sprintName.addEventListener("blur", commitSprintName);
  dom.sprintName.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      commitSprintName();
      dom.sprintName.blur();
    }
  });

  dom.startDate.addEventListener("change", commitStartDate);
  dom.endDate.addEventListener("change", commitEndDate);
  dom.developers.addEventListener("change", commitDevelopers);
  dom.efficiency.addEventListener("change", commitEfficiency);

  dom.developers.addEventListener("blur", commitDevelopers);
  dom.efficiency.addEventListener("blur", commitEfficiency);

  dom.developers.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      commitDevelopers();
      dom.developers.blur();
    }
  });
  dom.efficiency.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      commitEfficiency();
      dom.efficiency.blur();
    }
  });
  dom.showDayNumbers.addEventListener("change", render);

  render();
};

init();
