import { dom } from "./dom.js";
import { statusOptions, todayIso, localIso, formatSprintRange, getNextWorkingDay } from "./utils.js";
import {
  getState,
  getActiveSprint,
  setActiveSprint,
  updateTask,
  removeTaskFromSprint,
  addTaskFromBacklog,
  updateToday,
  patchActiveSprint,
  getBacklog,
  addBacklogTask,
  updateStory,
  deleteStory,
  updateBacklogTask,
  deleteBacklogTask,
} from "./state.js";
import { calculateBurndown } from "./burndown.js";
import { drawChart } from "./chart.js";

let fpToday = null;
const WEEKEND = (date) => date.getDay() === 0 || date.getDay() === 6;

let activeTab = "sprint";
export const setActiveTab = (tab) => { activeTab = tab; render(); };

// Backlog state — persists across renders
const editingIds = new Set();
const expandedStoryIds = new Set();

export const startEditing = (id, focusAfter = false) => {
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

export const expandAll = () => {
  const backlog = getBacklog();
  for (const story of backlog.stories) expandedStoryIds.add(story.id);
  render();
};

export const collapseAll = () => {
  expandedStoryIds.clear();
  render();
};

const renderSprintList = () => {
  dom.sprintList.innerHTML = "";

  if (activeTab === "backlog") return;

  const state = getState();
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
        },
      });
    }

    const commitActual = () => {
      const val = actualInput.value;
      updateTask(task.id, { actual: val === "" ? null : Number(val) });
    };
    actualInput.addEventListener("change", commitActual);
    actualInput.addEventListener("blur", commitActual);
    actualInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") { e.preventDefault(); commitActual(); actualInput.blur(); }
    });

    const commitStatus = (statusValue) => {
      const status = statusValue;
      let doneDate = task.doneDate;
      let actual = task.actual;
      if (status === "Done" && !doneDate) {
        const candidate = sprint.today || todayIso();
        doneDate =
          candidate >= sprint.startDate && candidate <= sprint.endDate
            ? candidate
            : sprint.endDate;
      }
      if (status === "Done" && (actual === null || actual === undefined)) {
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
      if (e.key === "Enter") { e.preventDefault(); commitStatus(e.target.value); statusSelect.blur(); }
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

const renderBacklogPanel = (sprint) => {
  const backlog = getBacklog();
  if (!backlog || !dom.backlogPanelRows) return;

  const assignedIds = new Set(sprint.tasks.map(t => t.backlogTaskId).filter(Boolean));

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

const renderBacklog = () => {
  const backlog = getBacklog();
  if (!backlog) return;

  const sprint = getActiveSprint();
  const assignedIds = new Set(sprint?.tasks.map(t => t.backlogTaskId).filter(Boolean) || []);

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

    expandToggle.textContent = isExpanded ? "▼" : "▶";
    expandToggle.addEventListener("click", () => {
      if (expandedStoryIds.has(story.id)) expandedStoryIds.delete(story.id);
      else expandedStoryIds.add(story.id);
      render();
    });

    storyIdView.textContent = story.storyId || "";
    storyDescView.textContent = story.description || "";
    storyPriorityView.textContent = story.priority ?? 100;

    if (isEditing) {
      storyRow.classList.add('row-editing');
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
        priority: Math.max(0, parseInt(storyPriorityEdit.value, 10) || 0),
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
      const newTaskId = addBacklogTask(story.id); // triggers onChange → render
      startEditing(newTaskId); // second render with new task in edit mode
    });

    dom.backlogTableBody.appendChild(storyRow);

    // Task rows (only when expanded)
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
          taskRow.classList.add('row-editing');
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
            assignedTo: taskAssignedEdit.value.trim(),
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

  // Efficiency (Actual : Ideal)
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

export const render = () => {
  dom.tabSprint.classList.toggle("active", activeTab === "sprint");
  dom.tabBacklog.classList.toggle("active", activeTab === "backlog");
  dom.sprintView.hidden = activeTab !== "sprint";
  dom.backlogView.hidden = activeTab !== "backlog";

  // Hide sprint sub-header (toolbar + sprint tabs) on backlog tab
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
  const defaultToday =
    real >= sprint.startDate && real <= maxToday ? real :
    real < sprint.startDate ? sprint.startDate : maxToday;
  patchActiveSprint({ today: defaultToday });

  const effectiveToday =
    sprint.today < sprint.startDate ? sprint.startDate :
    sprint.today > maxToday ? maxToday :
    sprint.today;

  const state = getState();
  const sprintNumber = state.sprints.findIndex((s) => s.id === sprint.id) + 1;
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
    },
  });

  renderTasks(sprint);
  renderBacklogPanel(sprint);
  const burndown = calculateBurndown(sprint, effectiveToday);
  renderStats(sprint, burndown);
  drawChart(burndown);
};
