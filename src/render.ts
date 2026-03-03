import { dom } from "./dom.ts";
import { statusOptions, todayIso, localIso, formatSprintRange, getNextWorkingDay } from "./utils.ts";
import {
  getState,
  getActiveSprint,
  setActiveSprint,
  updateTask,
  removeTaskFromSprint,
  reorderTasks,
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
} from "./state.ts";
import { calculateBurndown } from "./burndown.ts";
import { drawChart } from "./chart.ts";
import type { Sprint, SprintTask, BacklogTask, BacklogStory, BurndownData, SortState, RemainEntry, WorkedEntry } from "./types.ts";

let fpToday: FlatpickrInstance | null = null;

let activeTab: "sprint" | "backlog" = "sprint";
export const setActiveTab = (tab: "sprint" | "backlog"): void => { activeTab = tab; render(); };

// Backlog state — persists across renders
const editingIds = new Set<string>();
const expandedStoryIds = new Set<string>();

// Highlight state — tracks the backlogTaskId of a just-added task
let highlightBacklogTaskId: string | null = null;

// Sort state — UI-only, not persisted
let taskSort: SortState = { key: null, asc: true };
let backlogPanelSort: SortState = { key: null, asc: true };
let backlogSort: SortState = { key: null, asc: true };

export const setHighlightBacklogTaskId = (id: string | null): void => { highlightBacklogTaskId = id; };

export const toggleTaskSort = (key: string): void => {
  if (taskSort.key === key) taskSort.asc = !taskSort.asc;
  else { taskSort.key = key; taskSort.asc = true; }
  render(H_TASKS);
};

export const toggleBacklogPanelSort = (key: string): void => {
  if (backlogPanelSort.key === key) backlogPanelSort.asc = !backlogPanelSort.asc;
  else { backlogPanelSort.key = key; backlogPanelSort.asc = true; }
  render(H_PANEL);
};

export const toggleBacklogSort = (key: string): void => {
  if (backlogSort.key === key) backlogSort.asc = !backlogSort.asc;
  else { backlogSort.key = key; backlogSort.asc = true; }
  render(H_BACKLOG);
};

const NUMERIC_KEYS = new Set(["estimate", "worked", "remain", "priority", "actualEst"]);

const sortItems = <T extends Record<string, any>>(items: T[], key: string | null, asc: boolean): T[] => {
  if (!key) return items;
  const sorted = [...items].sort((a, b) => {
    let va: any = a[key] ?? "";
    let vb: any = b[key] ?? "";
    if (NUMERIC_KEYS.has(key)) {
      va = Number(va) || 0;
      vb = Number(vb) || 0;
      return va - vb;
    }
    return String(va).localeCompare(String(vb));
  });
  return asc ? sorted : sorted.reverse();
};

export const startEditing = (id: string | null, focusAfter = false): void => {
  if (!id) return;
  editingIds.clear();
  editingIds.add(id);
  render(H_BACKLOG);
  if (focusAfter) {
    setTimeout(() => {
      const row = dom.backlogTableBody.querySelector(`[data-id="${id}"]`);
      if (row) {
        row.scrollIntoView({ behavior: "smooth", block: "nearest" });
        (row.querySelector("input") as HTMLInputElement | null)?.focus();
      }
    }, 0);
  }
};

export const expandAll = (): void => {
  const backlog = getBacklog();
  for (const story of backlog.stories) expandedStoryIds.add(story.id);
  render(H_BACKLOG);
};

export const collapseAll = (): void => {
  expandedStoryIds.clear();
  render(H_BACKLOG);
};

const renderSprintList = (): void => {
  dom.sprintList.innerHTML = "";

  if (activeTab === "backlog") return;

  const state = getState();
  state.sprints.forEach((sprint, index) => {
    const node = (dom.sprintItemTemplate.content.firstElementChild!.cloneNode(true)) as HTMLElement;
    (node.querySelector(".sprint-label") as HTMLElement).textContent = `Sprint ${index + 1}`;
    if (sprint.id === state.activeSprintId) node.classList.add("active");
    node.addEventListener("click", () => setActiveSprint(sprint.id));
    dom.sprintList.appendChild(node);
  });
};

const applySortClasses = (container: HTMLElement, sortState: SortState): void => {
  container.querySelectorAll("th.sortable").forEach((th) => {
    th.classList.remove("sort-asc", "sort-desc");
    if ((th as HTMLElement).dataset.sortKey === sortState.key) {
      th.classList.add(sortState.asc ? "sort-asc" : "sort-desc");
    }
  });
};

const renderTasks = (sprint: Sprint, holidaySet: Set<string>, workWeekendSet: Set<string>): void => {
  dom.taskRows.innerHTML = "";

  const taskTable = dom.taskRows.closest("table");
  if (taskTable) applySortClasses(taskTable as HTMLElement, taskSort);

  const isSorted = taskSort.key !== null;
  const tasks = sortItems(
    sprint.tasks.map(t => ({ ...t, actualEst: t.worked + t.remain })),
    taskSort.key,
    taskSort.asc,
  );
  tasks.forEach((task) => {
    const row = (dom.taskRowTemplate.content.firstElementChild!.cloneNode(true)) as HTMLTableRowElement;
    row.dataset.taskId = task.id;

    const dragHandle = row.querySelector(".drag-handle") as HTMLElement | null;
    if (isSorted) {
      row.draggable = false;
      if (dragHandle) dragHandle.classList.add("drag-handle-disabled");
    } else {
      row.draggable = true;
      let dragStartedFromHandle = false;
      if (dragHandle) {
        dragHandle.addEventListener("mousedown", () => { dragStartedFromHandle = true; });
      }
      row.addEventListener("dragstart", (e) => {
        if (!dragStartedFromHandle) {
          e.preventDefault();
          return;
        }
        dragStartedFromHandle = false;
        e.dataTransfer!.effectAllowed = "move";
        e.dataTransfer!.setData("text/plain", task.id);
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

    const taskIdSpan = row.querySelector(".task-taskid") as HTMLElement;
    const nameSpan = row.querySelector(".task-name") as HTMLElement;
    const estimateSpan = row.querySelector(".task-estimate") as HTMLElement;
    const workedView = row.querySelector(".task-worked-view") as HTMLElement;
    const workedInput = row.querySelector(".task-worked-input") as HTMLInputElement;
    const remainView = row.querySelector(".task-remain-view") as HTMLElement;
    const remainChangeBtn = row.querySelector(".task-remain-change") as HTMLButtonElement;
    const remainInput = row.querySelector(".task-remain-input") as HTMLInputElement;
    const statusToggle = row.querySelector(".task-status-toggle") as HTMLElement;
    const doneSpan = row.querySelector(".task-done") as HTMLElement;
    const removeBtn = row.querySelector(".task-remove") as HTMLButtonElement;

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

    const actualEst = task.worked + task.remain;
    estimateSpan.textContent = `${actualEst} / ${task.estimate}`;

    workedView.textContent = String(task.worked);
    remainView.textContent = String(task.remain);
    workedInput.value = String(task.worked);
    remainInput.value = String(task.remain);

    workedInput.hidden = true;
    workedView.hidden = false;
    remainInput.hidden = true;
    remainView.hidden = false;
    remainChangeBtn.hidden = false;
    remainChangeBtn.textContent = "Update";

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

    const derivedStatus = task.remain === 0 ? "Done" : task.worked === 0 ? "Todo" : "In Progress";
    statusToggle.textContent = derivedStatus;
    statusToggle.classList.remove("clickable");

    doneSpan.textContent = task.doneDate || "";

    const logRemain = (log: RemainEntry[], date: string, remain: number): RemainEntry[] => [
      ...log.filter(e => e.date !== date),
      { date, remain },
    ];

    const logWorked = (log: WorkedEntry[], date: string, worked: number): WorkedEntry[] => [
      ...log.filter(e => e.date !== date),
      { date, worked },
    ];

    const commitSave = (): void => {
      const newWorked = Math.max(0, Number(workedInput.value) || 0);
      const newRemain = Math.max(0, Number(remainInput.value) || 0);
      const logDate = sprint.today || todayIso();
      const newRemainLog = logRemain(task.remainLog ?? [], logDate, newRemain);
      const newWorkedLog = logWorked(task.workedLog ?? [], logDate, newWorked);
      let newStatus: SprintTask["status"];
      let newDoneDate: string;
      if (newRemain === 0) {
        newStatus = "Done";
        newDoneDate = task.doneDate || logDate;
      } else if (newWorked === 0) {
        newStatus = "Todo";
        newDoneDate = "";
      } else {
        newStatus = "In Progress";
        newDoneDate = "";
      }
      updateTask(task.id, { worked: newWorked, remain: newRemain, remainLog: newRemainLog, workedLog: newWorkedLog, status: newStatus, doneDate: newDoneDate });
    };
    workedInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") { e.preventDefault(); commitSave(); }
    });
    remainInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") { e.preventDefault(); commitSave(); }
    });




    removeBtn.hidden = task.status === "In Progress" || task.status === "Done";

    removeBtn.addEventListener("click", () => {
      const label = task.taskId ? `[${task.taskId}] ${task.name}` : task.name || "this task";
      dom.confirmRemoveTaskName.textContent = label;
      dom.confirmRemoveTaskModal.hidden = false;
      const onConfirm = (): void => {
        removeTaskFromSprint(task.id);
        cleanup();
      };
      const onCancel = (): void => cleanup();
      const cleanup = (): void => {
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
      if (e.dataTransfer!.types.includes("text/plain")) {
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

      const backlogTaskId = e.dataTransfer!.getData("backlogTaskId");
      if (backlogTaskId) {
        highlightBacklogTaskId = backlogTaskId;
        addTaskFromBacklog(backlogTaskId);
        return;
      }

      const draggedId = e.dataTransfer!.getData("text/plain");
      if (!draggedId || draggedId === task.id) return;

      const currentIds = Array.from(dom.taskRows.querySelectorAll("tr[data-task-id]"))
        .map((tr) => (tr as HTMLElement).dataset.taskId!);
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

const renderBacklogPanel = (_sprint: Sprint): void => {
  const backlog = getBacklog();
  if (!backlog || !dom.backlogPanelRows) return;

  const allSprints = getState().sprints;
  const assignedIds = new Set<string>(
    allSprints.flatMap(s => s.tasks.map(t => t.backlogTaskId).filter((id): id is string => Boolean(id)))
  );

  dom.backlogPanelRows.innerHTML = "";

  let unassigned: BacklogTask[] = [];
  const taskStoryMap = new Map<string, BacklogStory>();
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
    const htmlEl = el as HTMLElement;
    if (htmlEl.dataset.sortKey === backlogPanelSort.key) {
      htmlEl.classList.add(backlogPanelSort.asc ? "sort-asc" : "sort-desc");
    }
    htmlEl.addEventListener("click", () => toggleBacklogPanelSort(htmlEl.dataset.sortKey!));
  });
  dom.backlogPanelRows.appendChild(header);

  unassigned.forEach((task, idx) => {
    const row = (dom.backlogPanelRowTemplate.content.firstElementChild!.cloneNode(true)) as HTMLElement;
    const bpTaskId = row.querySelector(".bp-taskid") as HTMLElement;
    bpTaskId.textContent = task.taskId || "";
    const parentStory = taskStoryMap.get(task.id);
    if (parentStory?.description) bpTaskId.title = parentStory.description;
    const bpDesc = row.querySelector(".bp-description") as HTMLElement;
    bpDesc.textContent = task.description;
    if (task.assignedTo) bpDesc.title = task.assignedTo;
    (row.querySelector(".bp-estimate") as HTMLElement).textContent = String(task.estimate ?? "");

    row.addEventListener("dragstart", (e) => {
      (e as DragEvent).dataTransfer!.setData("backlogTaskId", task.id);
    });

    (row.querySelector(".bp-add-btn") as HTMLButtonElement).addEventListener("click", () => {
      highlightBacklogTaskId = task.id;
      const focusIdx = idx;
      addTaskFromBacklog(task.id);
      setTimeout(() => {
        const btns = dom.backlogPanelRows.querySelectorAll(".bp-add-btn");
        const target = btns[focusIdx] || btns[btns.length - 1];
        if (target) (target as HTMLElement).focus();
      }, 0);
    });

    dom.backlogPanelRows.appendChild(row);
  });
};

const STORY_SORT_KEYS = new Set(["storyId", "description", "priority"]);

const renderBacklog = (): void => {
  const backlog = getBacklog();
  if (!backlog) return;

  const sprint = getActiveSprint();
  const assignedIds = new Set<string>(sprint?.tasks.map(t => t.backlogTaskId).filter((id): id is string => Boolean(id)) || []);

  dom.backlogTableBody.innerHTML = "";

  const blTable = dom.backlogTableBody.closest("table");
  if (blTable) applySortClasses(blTable as HTMLElement, backlogSort);

  let stories: BacklogStory[] = backlog.stories;
  if (backlogSort.key) {
    if (STORY_SORT_KEYS.has(backlogSort.key)) {
      stories = sortItems([...stories], backlogSort.key, backlogSort.asc);
    }
  }

  for (const story of stories) {
    const isExpanded = expandedStoryIds.has(story.id);
    const isEditing = editingIds.has(story.id);

    const storyRow = (dom.backlogStoryRowTemplate.content.firstElementChild!.cloneNode(true)) as HTMLTableRowElement;
    storyRow.dataset.id = story.id;
    const expandToggle = storyRow.querySelector(".story-expand-toggle") as HTMLButtonElement;
    const storyIdView = storyRow.querySelector(".story-id-view") as HTMLElement;
    const storyIdEdit = storyRow.querySelector(".story-id-edit") as HTMLInputElement;
    const storyDescView = storyRow.querySelector(".story-desc-view") as HTMLElement;
    const storyDescEdit = storyRow.querySelector(".story-desc-edit") as HTMLInputElement;
    const storyPriorityView = storyRow.querySelector(".story-priority-view") as HTMLElement;
    const storyPriorityEdit = storyRow.querySelector(".story-priority-edit") as HTMLInputElement;
    const editBtn = storyRow.querySelector(".story-edit-btn") as HTMLButtonElement;
    const addTaskBtn = storyRow.querySelector(".story-add-task-btn") as HTMLButtonElement;
    const saveBtn = storyRow.querySelector(".story-save-btn") as HTMLButtonElement;
    const cancelBtn = storyRow.querySelector(".story-cancel-btn") as HTMLButtonElement;
    const deleteBtn = storyRow.querySelector(".story-delete-btn") as HTMLButtonElement;

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
      const newTaskId = addBacklogTask(story.id);
      startEditing(newTaskId);
    });

    dom.backlogTableBody.appendChild(storyRow);

    if (isExpanded) {
      let storyTasks: BacklogTask[] = story.tasks;
      if (backlogSort.key && !STORY_SORT_KEYS.has(backlogSort.key)) {
        const taskKeyMap: Record<string, string> = { taskId: "taskId", taskDesc: "description", estimate: "estimate", assignedTo: "assignedTo" };
        const mappedKey = taskKeyMap[backlogSort.key] || backlogSort.key;
        storyTasks = sortItems([...storyTasks], mappedKey, backlogSort.asc);
      }
      for (const task of storyTasks) {
        const isTaskEditing = editingIds.has(task.id);

        const taskRow = (dom.backlogTaskRowTemplate.content.firstElementChild!.cloneNode(true)) as HTMLTableRowElement;
        const taskIdView = taskRow.querySelector(".task-id-view") as HTMLElement;
        const taskIdEdit = taskRow.querySelector(".task-id-edit") as HTMLInputElement;
        const taskDescView = taskRow.querySelector(".task-desc-view") as HTMLElement;
        const taskDescEdit = taskRow.querySelector(".task-desc-edit") as HTMLInputElement;
        const taskEstView = taskRow.querySelector(".task-estimate-view") as HTMLElement;
        const taskEstEdit = taskRow.querySelector(".task-estimate-edit") as HTMLInputElement;
        const taskAssignedView = taskRow.querySelector(".task-assigned-view") as HTMLElement;
        const taskAssignedEdit = taskRow.querySelector(".task-assigned-edit") as HTMLSelectElement;
        const taskEditBtn = taskRow.querySelector(".task-edit-btn") as HTMLButtonElement;
        const taskSaveBtn = taskRow.querySelector(".task-save-btn") as HTMLButtonElement;
        const taskCancelBtn = taskRow.querySelector(".task-cancel-btn") as HTMLButtonElement;
        const taskDeleteBtn = taskRow.querySelector(".task-delete-btn") as HTMLButtonElement;

        taskIdView.textContent = task.taskId || "";
        taskDescView.textContent = task.description || "";
        taskEstView.textContent = String(task.estimate ?? "");
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

const renderStats = (sprint: Sprint, burndown: BurndownData): void => {
  const effectiveToday = burndown.todayIndex >= 0 ? burndown.dates[burndown.todayIndex] : "";
  const doneTasks = sprint.tasks.filter((t) => t.status === "Done" && t.doneDate && t.doneDate <= effectiveToday).length;
  const availableDays = burndown.effectiveManDays - burndown.totalPoints;

  dom.summaryDuration.textContent = formatSprintRange(sprint);
  dom.workingDays.textContent = String(burndown.dates.length);
  dom.totalPoints.textContent = burndown.totalPoints.toFixed(1).replace(/\.0$/, "");
  const lastActual = [...burndown.actual].reverse().find((v): v is number => v !== null) ?? 0;
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
  const scopeToday = ti >= 0 ? (burndown.scope[ti] ?? 0) : 0;
  const remainToday = ti >= 0 ? (burndown.actual[ti] ?? 0) : 0;
  const workedToday = scopeToday - remainToday;
  const progressPct = scopeToday > 0
    ? ((workedToday / scopeToday) * 100).toFixed(2)
    : "0.00";
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
  const fmt = (v: number): string => v.toFixed(2).replace(/0$/, "");
  dom.efficiencyDisplay.textContent = `${fmt(actualEff)} : ${fmt(idealEff)}`;
};

export const render = (hints?: number): void => {
  if (hints === undefined) hints = H_ALL;
  const has = (h: number): boolean => (hints! & h) !== 0;

  dom.tabSprint.classList.toggle("active", activeTab === "sprint");
  dom.tabBacklog.classList.toggle("active", activeTab === "backlog");
  dom.sprintView.hidden = activeTab !== "sprint";
  dom.backlogView.hidden = activeTab !== "backlog";

  dom.sprintSubHeader.hidden = activeTab === "backlog";

  if (has(H_SIDEBAR)) renderSprintList();

  if (activeTab === "backlog") {
    if (has(H_BACKLOG)) renderBacklog();
    return;
  }

  const sprint = getActiveSprint();
  if (!sprint) return;

  patchActiveSprint({ developers: 0, efficiency: 1 });

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
    sprint.today! < sprint.startDate ? sprint.startDate :
    sprint.today! > maxToday ? maxToday :
    sprint.today!;

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
        (date: Date) => {
          const iso = localIso(date);
          if (holidaySet.has(iso)) return true;
          const isWeekend = date.getDay() === 0 || date.getDay() === 6;
          if (isWeekend && workWeekendSet.has(iso)) return false;
          return isWeekend;
        },
      ],
      onChange: ([date]: Date[]) => {
        if (date) updateToday(localIso(date));
      },
    });
  }

  if (has(H_TASKS)) renderTasks(sprint, holidaySet, workWeekendSet);
  if (has(H_PANEL)) renderBacklogPanel(sprint);

  if (has(H_STATS) || has(H_CHART)) {
    const burndown = calculateBurndown(sprint, effectiveToday, holidaySet, workWeekendSet);
    if (has(H_STATS)) renderStats(sprint, burndown);
    if (has(H_CHART)) {
      drawChart(burndown, (date) => updateToday(date));
    }
  }
};
