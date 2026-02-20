import { dom } from "./dom.js";
import { statusOptions, todayIso, formatSprintRange } from "./utils.js";
import {
  getState,
  getActiveSprint,
  setActiveSprint,
  updateTask,
  removeTask,
  updateToday,
  patchActiveSprint,
} from "./state.js";
import { calculateBurndown } from "./burndown.js";
import { drawChart } from "./chart.js";

let fpToday = null;
const WEEKEND = (date) => date.getDay() === 0 || date.getDay() === 6;

const renderSprintList = () => {
  const state = getState();
  dom.sprintList.innerHTML = "";
  state.sprints.forEach((sprint, index) => {
    const node = dom.sprintItemTemplate.content.firstElementChild.cloneNode(true);
    node.querySelector(".sprint-label").textContent = `Sprint ${index + 1}`;
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
    const commitPoints = () => updateTask(task.id, { points: Number(pointsInput.value) });

    nameInput.addEventListener("change", commitName);
    nameInput.addEventListener("blur", commitName);
    nameInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") { e.preventDefault(); commitName(); nameInput.blur(); }
    });

    pointsInput.addEventListener("change", commitPoints);
    pointsInput.addEventListener("blur", commitPoints);
    pointsInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") { e.preventDefault(); commitPoints(); pointsInput.blur(); }
    });

    const commitStatus = (statusValue) => {
      const status = statusValue;
      let doneDate = task.doneDate;
      if (status === "Done" && !doneDate) {
        const candidate = todayIso();
        doneDate =
          candidate >= sprint.startDate && candidate <= sprint.endDate
            ? candidate
            : sprint.endDate;
      }
      if (status !== "Done") doneDate = "";
      updateTask(task.id, { status, doneDate });
    };

    statusSelect.addEventListener("change", (e) => commitStatus(e.target.value));
    statusSelect.addEventListener("blur", (e) => commitStatus(e.target.value));
    statusSelect.addEventListener("keydown", (e) => {
      if (e.key === "Enter") { e.preventDefault(); commitStatus(e.target.value); statusSelect.blur(); }
    });

    const commitDoneDate = () =>
      updateTask(task.id, { doneDate: doneInput.value, status: "Done" });

    doneInput.addEventListener("change", commitDoneDate);
    doneInput.addEventListener("blur", commitDoneDate);
    doneInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") { e.preventDefault(); commitDoneDate(); doneInput.blur(); }
    });

    deleteBtn.addEventListener("click", () => removeTask(task.id));
    dom.taskRows.appendChild(row);
  });
};

const renderStats = (sprint, burndown) => {
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

export const render = () => {
  renderSprintList();
  const sprint = getActiveSprint();
  if (!sprint) return;

  patchActiveSprint({ developers: 0, efficiency: 1 });

  const real = todayIso();
  const defaultToday =
    real >= sprint.startDate && real <= sprint.endDate ? real :
    real < sprint.startDate ? sprint.startDate : sprint.endDate;
  patchActiveSprint({ today: defaultToday });

  const effectiveToday =
    sprint.today < sprint.startDate ? sprint.startDate :
    sprint.today > sprint.endDate ? sprint.endDate :
    sprint.today;

  const state = getState();
  const sprintNumber = state.sprints.findIndex((s) => s.id === sprint.id) + 1;
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
    },
  });

  renderTasks(sprint);
  const burndown = calculateBurndown(sprint, effectiveToday);
  renderStats(sprint, burndown);
  drawChart(burndown);
};
