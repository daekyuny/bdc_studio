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
  getPreferences,
  getMembers,
  H_SIDEBAR, H_HEADER, H_TASKS, H_PANEL, H_STATS, H_CHART, H_BACKLOG, H_ALL,
} from "./state.js";
import { calculateBurndown } from "./burndown.js";
import { drawChart } from "./chart.js";

let fpToday = null;

let activeTab = "sprint";
export const setActiveTab = (tab) => { activeTab = tab; render(); };

// Backlog state — persists across renders
const editingIds = new Set();
const expandedStoryIds = new Set();

// Highlight state — tracks the backlogTaskId of a just-added task
let highlightBacklogTaskId = null;

// Sort state — UI-only, not persisted
let taskSort = { key: null, asc: true };
let backlogPanelSort = { key: null, asc: true };
let backlogSort = { key: null, asc: true };

export const setHighlightBacklogTaskId = (id) => { highlightBacklogTaskId = id; };

export const toggleTaskSort = (key) => {
  if (taskSort.key === key) taskSort.asc = !taskSort.asc;
  else { taskSort.key = key; taskSort.asc = true; }
  render(H_TASKS);
};

export const toggleBacklogPanelSort = (key) => {
  if (backlogPanelSort.key === key) backlogPanelSort.asc = !backlogPanelSort.asc;
  else { backlogPanelSort.key = key; backlogPanelSort.asc = true; }
  render(H_PANEL);
};

export const toggleBacklogSort = (key) => {
  if (backlogSort.key === key) backlogSort.asc = !backlogSort.asc;
  else { backlogSort.key = key; backlogSort.asc = true; }
  render(H_BACKLOG);
};

const NUMERIC_KEYS = new Set(["estimate", "actual", "priority"]);

const sortItems = (items, key, asc) => {
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

export const startEditing = (id, focusAfter = false) => {
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

export const expandAll = () => {
  const backlog = getBacklog();
  for (const story of backlog.stories) expandedStoryIds.add(story.id);
  render(H_BACKLOG);
};

export const collapseAll = () => {
  expandedStoryIds.clear();
  render(H_BACKLOG);
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

const applySortClasses = (container, sortState) => {
  container.querySelectorAll("th.sortable").forEach((th) => {
    th.classList.remove("sort-asc", "sort-desc");
    if (th.dataset.sortKey === sortState.key) {
      th.classList.add(sortState.asc ? "sort-asc" : "sort-desc");
    }
  });
};

const renderTasks = (sprint, holidaySet, workWeekendSet) => {
  dom.taskRows.innerHTML = "";

  // Apply sort indicator to task table headers
  const taskTable = dom.taskRows.closest("table");
  if (taskTable) applySortClasses(taskTable, taskSort);

  const tasks = sortItems([...sprint.tasks], taskSort.key, taskSort.asc);
  tasks.forEach((task) => {
    const row = dom.taskRowTemplate.content.firstElementChild.cloneNode(true);
    row.dataset.taskId = task.id;

    // Highlight newly added task
    if (highlightBacklogTaskId && task.backlogTaskId === highlightBacklogTaskId) {
      row.classList.add("task-row-highlight");
    }

    const taskIdSpan = row.querySelector(".task-taskid");
    const nameSpan = row.querySelector(".task-name");
    const estimateSpan = row.querySelector(".task-estimate");
    const actualInput = row.querySelector(".task-actual");
    const statusSelect = row.querySelector(".task-status");
    const doneInput = row.querySelector(".task-done");
    const removeBtn = row.querySelector(".task-remove");

    taskIdSpan.textContent = task.taskId || "";
    nameSpan.textContent = task.name;

    // Look up current assignedTo and parent story from backlog
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
        disable: [
          (date) => {
            const iso = localIso(date);
            if (holidaySet && holidaySet.has(iso)) return true;
            const isWeekend = date.getDay() === 0 || date.getDay() === 6;
            if (isWeekend && workWeekendSet && workWeekendSet.has(iso)) return false;
            return isWeekend;
          },
        ],
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
      if (backlogTaskId) {
        highlightBacklogTaskId = backlogTaskId;
        addTaskFromBacklog(backlogTaskId);
      }
    });

    dom.taskRows.appendChild(row);
  });
};

const renderBacklogPanel = (sprint) => {
  const backlog = getBacklog();
  if (!backlog || !dom.backlogPanelRows) return;

  const allSprints = getState().sprints;
  const assignedIds = new Set(
    allSprints.flatMap(s => s.tasks.map(t => t.backlogTaskId)).filter(Boolean)
  );

  dom.backlogPanelRows.innerHTML = "";

  // Collect unassigned tasks (with parent story reference)
  let unassigned = [];
  const taskStoryMap = new Map();
  for (const story of backlog.stories) {
    for (const task of story.tasks) {
      if (!assignedIds.has(task.id)) {
        unassigned.push(task);
        taskStoryMap.set(task.id, story);
      }
    }
  }

  // Sort if active
  unassigned = sortItems(unassigned, backlogPanelSort.key, backlogPanelSort.asc);

  // Header row
  const header = document.createElement("div");
  header.className = "backlog-panel-header";
  header.innerHTML = `<span class="bp-drag-col"></span><span class="bp-taskid sortable" data-sort-key="taskId">Task ID</span><span class="bp-description sortable" data-sort-key="description">Description</span><span class="bp-estimate sortable" data-sort-key="estimate">Est.</span><span class="bp-actions-col"></span>`;
  header.querySelectorAll(".sortable").forEach((el) => {
    if (el.dataset.sortKey === backlogPanelSort.key) {
      el.classList.add(backlogPanelSort.asc ? "sort-asc" : "sort-desc");
    }
    el.addEventListener("click", () => toggleBacklogPanelSort(el.dataset.sortKey));
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
    row.querySelector(".bp-estimate").textContent = task.estimate ?? "";

    row.addEventListener("dragstart", (e) => {
      e.dataTransfer.setData("backlogTaskId", task.id);
    });

    row.querySelector(".bp-add-btn").addEventListener("click", () => {
      highlightBacklogTaskId = task.id;
      const focusIdx = idx; // after removal, the next task slides into this index
      addTaskFromBacklog(task.id);
      // After re-render, focus the Add button at the same index position
      setTimeout(() => {
        const btns = dom.backlogPanelRows.querySelectorAll(".bp-add-btn");
        const target = btns[focusIdx] || btns[btns.length - 1];
        if (target) target.focus();
      }, 0);
    });

    dom.backlogPanelRows.appendChild(row);
  });
};

const STORY_SORT_KEYS = new Set(["storyId", "description", "priority"]);

const renderBacklog = () => {
  const backlog = getBacklog();
  if (!backlog) return;

  const sprint = getActiveSprint();
  const assignedIds = new Set(sprint?.tasks.map(t => t.backlogTaskId).filter(Boolean) || []);

  dom.backlogTableBody.innerHTML = "";

  // Apply sort indicator to backlog table headers
  const blTable = dom.backlogTableBody.closest("table");
  if (blTable) applySortClasses(blTable, backlogSort);

  // Sort stories or tasks within stories
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

    expandToggle.textContent = isExpanded ? "▼" : "▶";
    expandToggle.addEventListener("click", () => {
      if (expandedStoryIds.has(story.id)) expandedStoryIds.delete(story.id);
      else expandedStoryIds.add(story.id);
      render(H_BACKLOG);
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
      render(H_BACKLOG);
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
      const newTaskId = addBacklogTask(story.id); // triggers onChange → render
      startEditing(newTaskId); // second render with new task in edit mode
    });

    dom.backlogTableBody.appendChild(storyRow);

    // Task rows (only when expanded)
    if (isExpanded) {
      // Sort tasks within story if a task-level sort key is active
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
          taskAssignedEdit.innerHTML = "";
          const members = getMembers();
          const emptyOpt = document.createElement("option");
          emptyOpt.value = "";
          emptyOpt.textContent = "—";
          taskAssignedEdit.appendChild(emptyOpt);
          for (const m of members) {
            const opt = document.createElement("option");
            opt.value = m;
            opt.textContent = m;
            taskAssignedEdit.appendChild(opt);
          }
          // If current assignedTo is not in members (deleted member), still show it
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
            assignedTo: taskAssignedEdit.value.trim(),
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

export const render = (hints) => {
  if (hints === undefined) hints = H_ALL;
  const has = (h) => (hints & h) !== 0;

  // Tab switching — always cheap, always do it
  dom.tabSprint.classList.toggle("active", activeTab === "sprint");
  dom.tabBacklog.classList.toggle("active", activeTab === "backlog");
  dom.sprintView.hidden = activeTab !== "sprint";
  dom.backlogView.hidden = activeTab !== "backlog";

  // Hide sprint sub-header (toolbar + sprint tabs) on backlog tab
  dom.sprintSubHeader.hidden = activeTab === "backlog";

  if (has(H_SIDEBAR)) renderSprintList();

  if (activeTab === "backlog") {
    if (has(H_BACKLOG)) renderBacklog();
    return;
  }

  const sprint = getActiveSprint();
  if (!sprint) return;

  patchActiveSprint({ developers: 0, efficiency: 1 });

  // Build holiday / work-weekend sets from preferences
  const prefs = getPreferences();
  const holidaySet = new Set(prefs.holidays.map((h) => h.date));
  const workWeekendSet = new Set(prefs.workWeekends);

  const maxToday = sprint.endDate ? getNextWorkingDay(sprint.endDate, holidaySet, workWeekendSet) : sprint.endDate;
  const real = todayIso();
  const defaultToday =
    real >= sprint.startDate && real <= maxToday ? real :
    real < sprint.startDate ? sprint.startDate : maxToday;
  patchActiveSprint({ today: defaultToday });

  const effectiveToday =
    sprint.today < sprint.startDate ? sprint.startDate :
    sprint.today > maxToday ? maxToday :
    sprint.today;

  if (has(H_HEADER)) {
    const state = getState();
    const sprintNumber = state.sprints.findIndex((s) => s.id === sprint.id) + 1;
    dom.sprintTitleText.textContent = sprint.description || `Sprint ${sprintNumber}`;
    dom.deleteSprintBtn.textContent = `Delete Sprint ${sprintNumber}`;

    if (fpToday) fpToday.destroy();
    fpToday = flatpickr(dom.sprintToday, {
      dateFormat: "Y-m-d",
      defaultDate: effectiveToday,
      minDate: sprint.startDate || null,
      maxDate: maxToday || null,
      disableMobile: true,
      disable: [
        (date) => {
          const iso = localIso(date);
          if (holidaySet.has(iso)) return true;
          const isWeekend = date.getDay() === 0 || date.getDay() === 6;
          if (isWeekend && workWeekendSet.has(iso)) return false;
          return isWeekend;
        },
      ],
      onChange: ([date]) => {
        if (date) updateToday(localIso(date));
      },
    });
  }

  if (has(H_TASKS)) renderTasks(sprint, holidaySet, workWeekendSet);
  if (has(H_PANEL)) renderBacklogPanel(sprint);

  if (has(H_STATS) || has(H_CHART)) {
    const burndown = calculateBurndown(sprint, effectiveToday, holidaySet, workWeekendSet);
    if (has(H_STATS)) renderStats(sprint, burndown);
    if (has(H_CHART)) drawChart(burndown);
  }
};
