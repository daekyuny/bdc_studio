import { dom } from "./dom.ts";
import { statusOptions, todayIso, localIso, formatSprintRange, getNextWorkingDay, getWorkingDates } from "./utils.ts";
import {
  getState,
  getActiveSprint,
  setActiveSprint,
  updateTask,
  removeTaskFromSprint,
  moveTaskToSprint,
  splitTaskToSprint,
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
  getMemberPairs,
  emailToName,
  getProjectToday,
  setProjectToday,
  H_SIDEBAR, H_HEADER, H_TASKS, H_PANEL, H_STATS, H_CHART, H_BACKLOG, H_DASHBOARD, H_ALL,
} from "./state.ts";
import { buildMemberActivityData, buildVelocityData } from "./dashboard.ts";
import type { SprintDashboardRow, VelocityBar } from "./dashboard.ts";
import { calculateBurndown } from "./burndown.ts";
import { drawChart } from "./chart.ts";
import type { Sprint, SprintTask, BacklogTask, BacklogStory, BurndownData, SortState, RemainEntry, WorkedEntry } from "./types.ts";

let fpProjectToday: FlatpickrInstance | null = null;

let activeTab: "sprint" | "backlog" | "dashboard" = "sprint";
export const setActiveTab = (tab: "sprint" | "backlog" | "dashboard"): void => { activeTab = tab; render(); };

// Backlog state — persists across renders
const editingIds = new Set<string>();
const expandedStoryIds = new Set<string>();

// Highlight state — tracks the backlogTaskId of a just-added task
let highlightBacklogTaskId: string | null = null;

// Sort state — UI-only, not persisted
let taskSort: SortState = { key: null, asc: true };
let closeActiveUpdate: (() => void) | null = null;
let backlogPanelSort: SortState = { key: null, asc: true };
let backlogSort: SortState = { key: null, asc: true };
let planTaskSort: SortState = { key: null, asc: true };
let planBacklogSort: SortState = { key: null, asc: true };

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

export const togglePlanTaskSort = (key: string): void => {
  if (planTaskSort.key === key) planTaskSort.asc = !planTaskSort.asc;
  else { planTaskSort.key = key; planTaskSort.asc = true; }
  render(H_TASKS);
};

export const togglePlanBacklogSort = (key: string): void => {
  if (planBacklogSort.key === key) planBacklogSort.asc = !planBacklogSort.asc;
  else { planBacklogSort.key = key; planBacklogSort.asc = true; }
  render(H_PANEL);
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

const getLogValueAt = <T extends { date: string }>(log: T[], date: string, key: keyof T, defaultVal: number): number => {
  const entries = log.filter(e => e.date <= date);
  if (!entries.length) return defaultVal;
  const latest = entries.reduce((a, b) => a.date >= b.date ? a : b);
  return latest[key] as number;
};

const renderTasks = (sprint: Sprint, holidaySet: Set<string>, workWeekendSet: Set<string>, isSprintActive: boolean): void => {
  dom.taskRows.innerHTML = "";
  closeActiveUpdate = null;

  const taskTable = dom.taskRows.closest("table");
  if (taskTable) applySortClasses(taskTable as HTMLElement, taskSort);

  const viewDate = sprint.today || todayIso();
  const projectTodayNow = getProjectToday();
  const isLastDay = isSprintActive && projectTodayNow === sprint.endDate;

  const isSorted = taskSort.key !== null;
  const tasks = sortItems(
    sprint.tasks
      .map(t => {
        const isBeforeAdded = t.addedDate ? t.addedDate > viewDate : false;
        const histWorked = isBeforeAdded ? 0 : getLogValueAt(t.workedLog ?? [], viewDate, "worked", 0);
        const histRemain = isBeforeAdded ? t.estimate : getLogValueAt(t.remainLog ?? [], viewDate, "remain", t.estimate);
        // Whether the task exists as of project TODAY (controls button visibility, not display)
        const existsNow = !t.addedDate || t.addedDate <= projectTodayNow;
        return { ...t, actualEst: histWorked + histRemain, histWorked, histRemain, isBeforeAdded, existsNow };
      }),
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

    if (task.isBeforeAdded) {
      row.classList.add("task-row-before-added");
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
    const moveBtn = row.querySelector(".task-move") as HTMLButtonElement;
    const splitBtn = row.querySelector(".task-split") as HTMLButtonElement;

    taskIdSpan.textContent = task.taskId || "";
    nameSpan.textContent = task.name;

    let currentAssigned = task.assignedTo
      ? task.assignedTo.split(",").map((s) => emailToName(s.trim())).join(", ")
      : "";
    let parentStoryDesc = "";
    if (task.backlogTaskId) {
      const backlog = getBacklog();
      for (const story of backlog.stories) {
        const bt = story.tasks.find((t) => t.id === task.backlogTaskId);
        if (bt) {
          currentAssigned = bt.assignedTo.length > 0 ? bt.assignedTo.map(emailToName).join(", ") : "";
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

    const closeThisUpdate = (): void => {
      workedView.hidden = false;
      workedInput.hidden = true;
      remainView.hidden = false;
      remainInput.hidden = true;
      remainChangeBtn.textContent = "Update";
    };

    if (!task.isBeforeAdded && isSprintActive) {
      remainChangeBtn.addEventListener("click", () => {
        if (remainChangeBtn.textContent === "Update") {
          // Close any other open update row first
          if (closeActiveUpdate && closeActiveUpdate !== closeThisUpdate) closeActiveUpdate();
          closeActiveUpdate = closeThisUpdate;

          const currentAssigned = task.assignedTo
            ? task.assignedTo.split(",").map(e => e.trim()).filter(Boolean)
            : [];
          if (currentAssigned.length === 0) {
            openAssignedPicker([], getMemberPairs(), (selected) => {
              if (selected.length > 0) {
                updateTask(task.id, { assignedTo: selected.join(", ") });
                workedView.hidden = true;
                workedInput.hidden = false;
                remainView.hidden = true;
                remainInput.hidden = false;
                remainChangeBtn.textContent = "Save";
                workedInput.focus();
              }
            }, "No one is assigned to this task. Please assign a member before logging work.",
            task.estimate,
            computeBaseTotals(task.backlogTaskId ?? null));
          } else {
            workedView.hidden = true;
            workedInput.hidden = false;
            remainView.hidden = true;
            remainInput.hidden = false;
            remainChangeBtn.textContent = "Save";
            workedInput.focus();
          }
        } else {
          closeActiveUpdate = null;
          commitSave();
        }
      });
    }

    const histStatus = task.histRemain === 0 ? "Done" : task.histWorked === 0 ? "Todo" : "In Progress";
    statusToggle.textContent = histStatus;
    statusToggle.classList.remove("clickable");

    const histDoneDate = task.doneDate && task.doneDate <= viewDate ? task.doneDate : "";
    doneSpan.textContent = histDoneDate;

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
      const logDate = getProjectToday();
      const newRemainLog = logRemain(task.remainLog ?? [], logDate, newRemain);
      const newWorkedLog = logWorked(task.workedLog ?? [], logDate, newWorked);
      // Top-level worked/remain reflect the LATEST log entries across all dates
      const latestWorked = newWorkedLog.reduce((a, b) => a.date >= b.date ? a : b).worked;
      const latestRemain = newRemainLog.reduce((a, b) => a.date >= b.date ? a : b).remain;
      let newStatus: SprintTask["status"];
      let newDoneDate: string;
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
    const cancelUpdate = (): void => {
      workedInput.value = String(task.histWorked);
      remainInput.value = String(task.histRemain);
      closeActiveUpdate = null;
      closeThisUpdate();
    };
    workedInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") { e.preventDefault(); commitSave(); }
      else if (e.key === "Escape") { e.preventDefault(); cancelUpdate(); }
    });
    remainInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") { e.preventDefault(); commitSave(); }
      else if (e.key === "Escape") { e.preventDefault(); cancelUpdate(); }
    });




    // On the last day: Todo tasks get Move, In Progress tasks get Split; Remove is hidden.
    // Otherwise: Remove shows normally (only for Todo tasks in an active sprint).
    const isTodo = task.worked === 0 && task.status !== "Done";
    const isInProgress = task.worked > 0 && task.remain > 0 && task.status !== "Done";

    if (isLastDay && task.existsNow) {
      removeBtn.hidden = true;
      moveBtn.hidden = !isTodo;
      splitBtn.hidden = !isInProgress;
    } else {
      removeBtn.hidden = !isSprintActive || !task.existsNow || task.worked > 0;
      moveBtn.hidden = true;
      splitBtn.hidden = true;
    }

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

    const buildSprintOptions = (select: HTMLSelectElement): void => {
      select.innerHTML = "";
      const allSprints = getState().sprints;
      allSprints.forEach((s, i) => {
        if (s.id === sprint.id) return;
        if (s.endDate < projectTodayNow) return;
        const workingDays = getWorkingDates(s.startDate, s.endDate, holidaySet, workWeekendSet).length;
        const totalPts = s.tasks.reduce((sum, t) => sum + Number(t.estimate || 0), 0);
        const avail = Math.max(0, Number(s.developers || 0)) * workingDays * Math.min(1, Math.max(0, Number(s.efficiency || 0))) - totalPts;
        const label = s.description ? `Sprint ${i + 1} — ${s.description}` : `Sprint ${i + 1}`;
        const pts = totalPts.toFixed(1).replace(/\.0$/, "");
        const availStr = avail.toFixed(1).replace(/\.0$/, "");
        const opt = document.createElement("option");
        opt.value = s.id;
        opt.textContent = `${label}  [${pts} pts, ${availStr} avail days]`;
        select.appendChild(opt);
      });
    };

    moveBtn.addEventListener("click", () => {
      const label = task.taskId ? `[${task.taskId}] ${task.name}` : task.name || "this task";
      dom.moveTaskName.textContent = label;
      buildSprintOptions(dom.moveTaskSprintSelect);
      dom.moveTaskModal.hidden = false;
      const onConfirm = (): void => {
        const targetId = dom.moveTaskSprintSelect.value;
        if (targetId) moveTaskToSprint(task.id, targetId);
        cleanup();
      };
      const onCancel = (): void => cleanup();
      const cleanup = (): void => {
        dom.moveTaskModal.hidden = true;
        dom.moveTaskConfirm.removeEventListener("click", onConfirm);
        dom.moveTaskCancel.removeEventListener("click", onCancel);
      };
      dom.moveTaskConfirm.addEventListener("click", onConfirm);
      dom.moveTaskCancel.addEventListener("click", onCancel);
    });

    splitBtn.addEventListener("click", () => {
      const label = task.taskId ? `[${task.taskId}] ${task.name}` : task.name || "this task";
      const aId = task.taskId ? `${task.taskId}a` : "(original)";
      const bId = task.taskId ? `${task.taskId}b` : "(new)";
      dom.splitTaskInfo.innerHTML =
        `<strong>${label}</strong><br>` +
        `<span style="color:var(--text-muted,#888)">${aId}: worked ${task.histWorked} days — remain set to 0 (closed in this sprint)</span><br>` +
        `<span style="color:var(--text-muted,#888)">${bId}: ${task.histRemain} days remaining — moved to target sprint</span>`;
      buildSprintOptions(dom.splitTaskSprintSelect);
      dom.splitTaskModal.hidden = false;
      const onConfirm = (): void => {
        const targetId = dom.splitTaskSprintSelect.value;
        if (targetId) splitTaskToSprint(task.id, targetId);
        cleanup();
      };
      const onCancel = (): void => cleanup();
      const cleanup = (): void => {
        dom.splitTaskModal.hidden = true;
        dom.splitTaskConfirm.removeEventListener("click", onConfirm);
        dom.splitTaskCancel.removeEventListener("click", onCancel);
      };
      dom.splitTaskConfirm.addEventListener("click", onConfirm);
      dom.splitTaskCancel.addEventListener("click", onCancel);
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
        if (!isSprintActive) return;
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

const renderBacklogPanel = (sprint: Sprint, isSprintActive: boolean): void => {
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
    if (task.assignedTo.length > 0) bpDesc.title = task.assignedTo.map(emailToName).join(", ");
    (row.querySelector(".bp-estimate") as HTMLElement).textContent = String(task.estimate ?? "");

    if (!isSprintActive) {
      row.draggable = false;
      (row.querySelector(".bp-add-btn") as HTMLButtonElement).disabled = true;
    } else {
      row.addEventListener("dragstart", (e) => {
        (e as DragEvent).dataTransfer!.setData("backlogTaskId", task.id);
      });
    }

    (row.querySelector(".bp-add-btn") as HTMLButtonElement).addEventListener("click", () => {
      if (!isSprintActive) return;
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

// Compute base totals (pts per member) from all backlog tasks, excluding the task being edited.
const computeBaseTotals = (excludeTaskId: string | null): Record<string, number> => {
  const totals: Record<string, number> = {};
  const backlog = getBacklog();
  for (const story of backlog.stories) {
    for (const task of story.tasks) {
      if (task.id === excludeTaskId) continue;
      if (task.assignedTo.length === 0) continue;
      const share = task.estimate / task.assignedTo.length;
      for (const email of task.assignedTo) {
        totals[email] = (totals[email] ?? 0) + share;
      }
    }
  }
  return totals;
};

const openAssignedPicker = (
  current: string[],
  members: { email: string; name: string }[],
  onDone: (selected: string[]) => void,
  warningMsg?: string,
  currentTaskEstimate: number = 0,
  baseTotals: Record<string, number> = {},
): void => {
  const overlay = document.createElement("div");
  overlay.className = "team-modal-overlay";
  overlay.style.zIndex = "1100";

  const modal = document.createElement("div");
  modal.className = "team-modal";
  modal.style.cssText = "max-width:360px;padding:20px;max-height:80vh;overflow-y:auto;";

  const title = document.createElement("h3");
  title.textContent = "Assign Members";
  title.style.cssText = "margin:0 0 14px;font-size:1rem;";
  modal.appendChild(title);

  if (warningMsg) {
    const warn = document.createElement("p");
    warn.textContent = warningMsg;
    warn.style.cssText = "margin:0 0 12px;font-size:0.85rem;color:#c0392b;background:#fdf0ef;border:1px solid #f5c6c2;border-radius:6px;padding:8px 10px;";
    modal.appendChild(warn);
  }

  const currentSet = new Set(current);

  // Table layout: checkbox | name | Total Assigned
  const table = document.createElement("table");
  table.style.cssText = "width:100%;border-collapse:collapse;";
  const thead = document.createElement("thead");
  const headerRow = document.createElement("tr");
  const thCb = document.createElement("th");
  thCb.style.cssText = "width:28px;";
  const thName = document.createElement("th");
  thName.style.cssText = "text-align:left;padding:4px 8px 6px 0;font-size:0.8rem;color:#666;font-weight:500;";
  thName.textContent = "Member";
  const thTotal = document.createElement("th");
  thTotal.style.cssText = "text-align:right;padding:4px 0 6px;font-size:0.8rem;color:#666;font-weight:500;white-space:nowrap;";
  thTotal.textContent = "Total Assigned";
  headerRow.append(thCb, thName, thTotal);
  thead.appendChild(headerRow);
  table.appendChild(thead);

  const tbody = document.createElement("tbody");
  table.appendChild(tbody);
  modal.appendChild(table);

  const checkboxes: { cb: HTMLInputElement; value: string; totalCell: HTMLTableCellElement }[] = [];

  const updateTotals = (): void => {
    const checkedEmails = checkboxes.filter(({ cb }) => cb.checked).map(({ value }) => value);
    const share = checkedEmails.length > 0 ? currentTaskEstimate / checkedEmails.length : 0;
    for (const { value, totalCell } of checkboxes) {
      const base = baseTotals[value] ?? 0;
      const contribution = checkedEmails.includes(value) ? share : 0;
      totalCell.textContent = (base + contribution).toFixed(1);
    }
  };

  for (const m of members) {
    const tr = document.createElement("tr");
    const tdCb = document.createElement("td");
    tdCb.style.cssText = "width:28px;vertical-align:middle;";
    const cb = document.createElement("input");
    cb.type = "checkbox";
    cb.value = m.email;
    cb.checked = currentSet.has(m.email);
    tdCb.appendChild(cb);

    const tdName = document.createElement("td");
    tdName.style.cssText = "padding:5px 8px 5px 0;font-size:0.9rem;vertical-align:middle;";
    tdName.textContent = m.name;

    const tdTotal = document.createElement("td");
    tdTotal.style.cssText = "text-align:right;font-size:0.9rem;vertical-align:middle;font-variant-numeric:tabular-nums;";

    tr.append(tdCb, tdName, tdTotal);
    tbody.appendChild(tr);
    checkboxes.push({ cb, value: m.email, totalCell: tdTotal });

    cb.addEventListener("change", updateTotals);
  }

  updateTotals();

  const footer = document.createElement("div");
  footer.style.cssText = "display:flex;justify-content:flex-end;margin-top:16px;";
  const doneBtn = document.createElement("button");
  doneBtn.type = "button";
  doneBtn.className = "btn btn-primary";
  doneBtn.textContent = "Done";
  footer.appendChild(doneBtn);
  modal.appendChild(footer);

  overlay.appendChild(modal);
  document.body.appendChild(overlay);

  const close = (): void => { document.body.removeChild(overlay); };

  doneBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    onDone(checkboxes.filter(({ cb }) => cb.checked).map(({ value }) => value));
    close();
  });
  overlay.addEventListener("click", (e) => { if (e.target === overlay) { e.stopPropagation(); close(); } });
};

const renderBacklog = (): void => {
  const backlog = getBacklog();
  if (!backlog) return;

  // Only lock tasks that belong to sprints already started (start ≤ today).
  // Future sprint tasks remain editable in the backlog.
  const today = getProjectToday();
  const assignedIds = new Set<string>(
    getState().sprints
      .filter(s => s.startDate <= today)
      .flatMap(s => s.tasks.map(t => t.backlogTaskId).filter((id): id is string => Boolean(id)))
  );

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
      addTaskBtn.hidden = !isExpanded && story.tasks.length > 0;
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
        const taskAssignedDropdown = taskRow.querySelector(".task-assigned-dropdown") as HTMLElement;
        const taskEditBtn = taskRow.querySelector(".task-edit-btn") as HTMLButtonElement;
        const taskSaveBtn = taskRow.querySelector(".task-save-btn") as HTMLButtonElement;
        const taskCancelBtn = taskRow.querySelector(".task-cancel-btn") as HTMLButtonElement;
        const taskDeleteBtn = taskRow.querySelector(".task-delete-btn") as HTMLButtonElement;

        taskIdView.textContent = task.taskId || "";
        taskDescView.textContent = task.description || "";
        taskEstView.textContent = String(task.estimate ?? "");
        // assignedTo stores emails; display as names
        const assignedNames = task.assignedTo.map(emailToName);
        taskAssignedView.textContent = assignedNames.length > 0 ? assignedNames.join(", ") : "—";

        if (assignedIds.has(task.id)) taskRow.classList.add("assigned");

        let _assignedSelection: string[] = [...task.assignedTo]; // emails

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
          taskAssignedDropdown.hidden = false;
          taskAssignedDropdown.className = "task-assigned-clickable";
          taskAssignedDropdown.textContent = _assignedSelection.length > 0
            ? _assignedSelection.map(emailToName).join(", ") : "—";

          const saveTask = (): void => {
            editingIds.delete(task.id);
            updateBacklogTask(story.id, task.id, {
              taskId: taskIdEdit.value.trim(),
              description: taskDescEdit.value.trim(),
              estimate: Number(taskEstEdit.value) || 0,
              assignedTo: _assignedSelection,
            });
          };

          taskAssignedDropdown.addEventListener("click", () => {
            openAssignedPicker(_assignedSelection, getMemberPairs(), (selected) => {
              _assignedSelection = selected;
              saveTask();
            }, undefined, task.estimate, computeBaseTotals(task.id));
          });

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
            assignedTo: _assignedSelection,
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

// ─── Sprint Planning Modal ────────────────────────────────────────────────────

const renderPlanTasks = (sprint: Sprint): void => {
  dom.planTaskRows.innerHTML = "";
  let dragStartedFromHandle = false;

  const planTable = dom.planTaskRows.closest("table");
  if (planTable) applySortClasses(planTable as HTMLElement, planTaskSort);

  // Build backlogTaskId → story map for tooltips
  const backlog = getBacklog();
  const backlogStoryMap = new Map<string, BacklogStory>();
  if (backlog) {
    for (const story of backlog.stories)
      for (const bt of story.tasks)
        backlogStoryMap.set(bt.id, story);
  }

  const tasks = sortItems(sprint.tasks, planTaskSort.key, planTaskSort.asc);

  tasks.forEach((task) => {
    const row = dom.planTaskRowTemplate.content.firstElementChild!.cloneNode(true) as HTMLTableRowElement;
    row.dataset.taskId = task.id;

    const handle = row.querySelector(".drag-handle") as HTMLElement;
    handle.addEventListener("mousedown", () => { dragStartedFromHandle = true; });
    row.addEventListener("dragstart", (e) => {
      if (!dragStartedFromHandle) { e.preventDefault(); return; }
      dragStartedFromHandle = false;
      e.dataTransfer!.effectAllowed = "move";
      e.dataTransfer!.setData("text/plain", task.id);
      row.classList.add("dragging");
    });
    row.addEventListener("dragend", () => {
      row.classList.remove("dragging");
      dragStartedFromHandle = false;
      dom.planTaskRows.querySelectorAll(".drag-over-above, .drag-over-below")
        .forEach(el => el.classList.remove("drag-over-above", "drag-over-below"));
    });

    const taskIdCell = row.querySelector(".plan-col-taskid") as HTMLElement;
    taskIdCell.textContent = task.taskId || "";
    if (task.backlogTaskId) {
      const story = backlogStoryMap.get(task.backlogTaskId);
      if (story) taskIdCell.title = `[${story.storyId || ""}] ${story.description || ""}`;
    }
    const nameCell = row.querySelector(".plan-col-name") as HTMLElement;
    nameCell.textContent = task.name;
    if (task.assignedTo) {
      const names = task.assignedTo.split(",").map(e => emailToName(e.trim())).filter(Boolean);
      if (names.length > 0) nameCell.title = names.join(", ");
    }
    (row.querySelector(".plan-col-estimate") as HTMLElement).textContent = String(task.estimate);

    const removeBtn = row.querySelector(".plan-remove-btn") as HTMLButtonElement;
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
      const backlogTaskId = e.dataTransfer!.getData("backlogTaskId");
      if (backlogTaskId) { addTaskFromBacklog(backlogTaskId); return; }
      const draggedId = e.dataTransfer!.getData("text/plain");
      if (!draggedId || draggedId === task.id) return;
      const ids = Array.from(dom.planTaskRows.querySelectorAll("tr[data-task-id]"))
        .map(tr => (tr as HTMLElement).dataset.taskId!);
      const filtered = ids.filter(id => id !== draggedId);
      const targetIdx = filtered.indexOf(task.id);
      const mid = row.getBoundingClientRect().top + row.getBoundingClientRect().height / 2;
      filtered.splice(e.clientY < mid ? targetIdx : targetIdx + 1, 0, draggedId);
      reorderTasks(filtered);
    });

    dom.planTaskRows.appendChild(row);
  });

  // Drop zone: allow dragging from backlog onto the empty table area
  dom.planTaskRows.addEventListener("dragover", (e) => e.preventDefault(), { once: false });
  dom.planTaskRows.addEventListener("drop", (e) => {
    const target = e.target as HTMLElement;
    if (target.closest("tr[data-task-id]")) return; // handled by row
    const backlogTaskId = (e as DragEvent).dataTransfer!.getData("backlogTaskId");
    if (backlogTaskId) { e.preventDefault(); addTaskFromBacklog(backlogTaskId); }
  });
};

const renderPlanBacklog = (sprint: Sprint): void => {
  dom.planBacklogRows.innerHTML = "";
  const backlog = getBacklog();
  if (!backlog) return;

  const assignedIds = new Set<string>(
    getState().sprints.flatMap(s => s.tasks.map(t => t.backlogTaskId).filter((id): id is string => Boolean(id)))
  );

  // Build taskId → story map for tooltips
  const taskStoryMap = new Map<string, BacklogStory>();
  for (const story of backlog.stories)
    for (const bt of story.tasks)
      taskStoryMap.set(bt.id, story);

  const unassigned: BacklogTask[] = [];
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
    const htmlEl = el as HTMLElement;
    if (htmlEl.dataset.sortKey === planBacklogSort.key) {
      htmlEl.classList.add(planBacklogSort.asc ? "sort-asc" : "sort-desc");
    }
    htmlEl.addEventListener("click", () => togglePlanBacklogSort(htmlEl.dataset.sortKey!));
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
    // Tooltips: task ID → story info, description → assigned members
    const story = taskStoryMap.get(task.id);
    if (story) (row.querySelector(".plan-bl-taskid") as HTMLElement).title = `[${story.storyId || ""}] ${story.description || ""}`;
    if (task.assignedTo.length > 0)
      (row.querySelector(".plan-bl-desc") as HTMLElement).title = task.assignedTo.map(emailToName).join(", ");
    row.addEventListener("dragstart", (e) => {
      (e as DragEvent).dataTransfer!.effectAllowed = "copy";
      (e as DragEvent).dataTransfer!.setData("backlogTaskId", task.id);
      row.classList.add("dragging");
    });
    row.addEventListener("dragend", () => row.classList.remove("dragging"));
    (row.querySelector(".plan-bl-add-btn") as HTMLButtonElement).addEventListener("click", () => {
      addTaskFromBacklog(task.id);
    });
    dom.planBacklogRows.appendChild(row);
  });
};

const renderPlanningModal = (sprint: Sprint, holidaySet: Set<string>, workWeekendSet: Set<string>): void => {
  if (dom.sprintPlanModal.hidden) return;

  const sprintNumber = getState().sprints.findIndex(s => s.id === sprint.id) + 1;
  dom.sprintPlanTitle.textContent = sprint.description
    ? `Sprint ${sprintNumber} — ${sprint.description}`
    : `Sprint ${sprintNumber}`;

  const workingDays = getWorkingDates(sprint.startDate, sprint.endDate, holidaySet, workWeekendSet).length;
  const totalPoints = sprint.tasks.reduce((sum, t) => sum + Number(t.estimate || 0), 0);
  const developers = Math.max(0, Number(sprint.developers || 0));
  const efficiency = Math.min(1, Math.max(0, Number(sprint.efficiency || 0)));
  const availableDays = developers * workingDays * efficiency - totalPoints;

  dom.planStatDuration.textContent = formatSprintRange(sprint);
  dom.planStatWorkingDays.textContent = String(workingDays);
  dom.planStatTotalPoints.textContent = totalPoints.toFixed(1).replace(/\.0$/, "");
  dom.planStatAvailableDays.textContent = availableDays.toFixed(1).replace(/\.0$/, "");
  dom.planStatAvailableDays.className = "plan-stat-value" +
    (availableDays < -1.5 ? " available-red" : availableDays <= 1.5 ? " available-green" : "");

  renderPlanTasks(sprint);
  renderPlanBacklog(sprint);
};

// ─────────────────────────────────────────────────────────────────────────────

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
  dom.tabDashboard.classList.toggle("active", activeTab === "dashboard");
  dom.sprintView.hidden = activeTab !== "sprint";
  dom.backlogView.hidden = activeTab !== "backlog";
  dom.dashboardView.hidden = activeTab !== "dashboard";

  dom.sprintSubHeader.hidden = activeTab !== "sprint";

  if (has(H_SIDEBAR)) renderSprintList();

  const prefs = getPreferences();
  const holidaySet = new Set(prefs.holidays.map((h) => h.date));
  const workWeekendSet = new Set(prefs.workWeekends);

  // Project TODAY picker — reinit on every render so holidays/weekends stay current
  if (fpProjectToday) fpProjectToday.destroy();
  fpProjectToday = flatpickr(dom.projectTodayInput, {
    dateFormat: "Y-m-d",
    disableMobile: true,
    maxDate: "today",
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
      if (date) setProjectToday(localIso(date));
    },
  });
  fpProjectToday.setDate(getProjectToday(), false);

  if (activeTab === "backlog") {
    if (has(H_BACKLOG)) renderBacklog();
    return;
  }

  if (activeTab === "dashboard") {
    if (has(H_DASHBOARD) || has(H_ALL)) renderDashboard();
    return;
  }

  const sprint = getActiveSprint();
  if (!sprint) return;

  patchActiveSprint({ developers: 0, efficiency: 1 });

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

  const projectToday = getProjectToday();
  const isSprintActive = projectToday >= sprint.startDate && projectToday <= sprint.endDate;

  if (has(H_HEADER)) {
    const state = getState();
    const sprintNumber = state.sprints.findIndex((s) => s.id === sprint.id) + 1;
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
    // Chart actual line always ends at project TODAY, not the browse date
    const chartToday =
      projectToday < sprint.startDate ? sprint.startDate :
      projectToday > maxToday ? maxToday :
      projectToday;
    const burndown = calculateBurndown(sprint, chartToday, holidaySet, workWeekendSet);
    // Browse index — where effectiveToday (sprint.today) falls in the dates array
    const browseIndex = burndown.dates.reduce((last, date, i) => (date <= effectiveToday ? i : last), -1);
    if (has(H_STATS)) renderStats(sprint, burndown);
    if (has(H_CHART)) {
      drawChart(burndown, (date) => {
        if (isSprintActive) {
          // Current sprint: clicking a date updates project TODAY
          setProjectToday(date);
        } else {
          // Past/future sprint: toggle browse line only
          if (date === effectiveToday && date !== chartToday) updateToday(chartToday);
          else updateToday(date);
        }
      }, browseIndex >= 0 ? browseIndex : undefined, chartToday === projectToday);
    }
  }

  if (has(H_TASKS | H_PANEL | H_STATS)) renderPlanningModal(sprint, holidaySet, workWeekendSet);
};

// ---------------------------------------------------------------------------
// Dashboard rendering
// ---------------------------------------------------------------------------

function svgEl(tag: string): SVGElement {
  return document.createElementNS("http://www.w3.org/2000/svg", tag);
}

const FONT = "'Source Sans 3', sans-serif";
const CLR_MUTED = "#6b7080";
const CLR_ACCENT_LIGHT = "rgba(92,103,242,0.22)";
const CLR_ACCENT = "rgba(92,103,242,0.72)";
const CLR_GRID = "rgba(44,47,58,0.07)";

function drawBarChartGrid(svg: SVGElement, W: number, H: number, PX: number, PY: number, plotH: number, maxVal: number): void {
  for (let i = 0; i <= 4; i++) {
    const y = PY + plotH * (i / 4);
    const line = svgEl("line") as SVGLineElement;
    line.setAttribute("x1", String(PX)); line.setAttribute("x2", String(W - 12));
    line.setAttribute("y1", String(y)); line.setAttribute("y2", String(y));
    line.setAttribute("stroke", CLR_GRID); svg.appendChild(line);
    const label = svgEl("text") as SVGTextElement;
    label.setAttribute("x", String(PX - 6)); label.setAttribute("y", String(y + 3));
    label.setAttribute("text-anchor", "end"); label.setAttribute("fill", CLR_MUTED);
    label.setAttribute("font-size", "9"); label.setAttribute("font-family", FONT);
    label.textContent = String(Math.round(maxVal * (1 - i / 4)));
    svg.appendChild(label);
  }
}

function drawLegend(svg: SVGElement, items: { color: string; label: string }[], W: number): void {
  let x = W - 12;
  for (let i = items.length - 1; i >= 0; i--) {
    const { color, label } = items[i];
    const t = svgEl("text") as SVGTextElement;
    t.setAttribute("x", String(x)); t.setAttribute("y", "10");
    t.setAttribute("text-anchor", "end"); t.setAttribute("fill", CLR_MUTED);
    t.setAttribute("font-size", "9"); t.setAttribute("font-family", FONT);
    t.textContent = label; svg.appendChild(t);
    x -= label.length * 5.5 + 6;
    const rect = svgEl("rect") as SVGRectElement;
    rect.setAttribute("x", String(x)); rect.setAttribute("y", "2");
    rect.setAttribute("width", "8"); rect.setAttribute("height", "8");
    rect.setAttribute("rx", "1.5"); rect.setAttribute("fill", color);
    svg.appendChild(rect);
    x -= 14;
  }
}

function drawVelocityChart(svg: SVGSVGElement, bars: VelocityBar[]): void {
  const W = 600, H = 140, PX = 36, PY = 20, PB = 22;
  svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
  svg.innerHTML = "";

  if (!bars.length) {
    const t = svgEl("text") as SVGTextElement;
    t.setAttribute("x", String(W / 2)); t.setAttribute("y", String(H / 2));
    t.setAttribute("text-anchor", "middle"); t.setAttribute("fill", CLR_MUTED);
    t.setAttribute("font-size", "12"); t.setAttribute("font-family", FONT);
    t.textContent = "No sprint data yet."; svg.appendChild(t); return;
  }

  const maxVal = Math.max(...bars.flatMap((b) => [b.planned, b.completed]), 1);
  const plotW = W - PX - 12;
  const plotH = H - PY - PB;
  const groupW = plotW / bars.length;
  const barW = Math.min(groupW * 0.28, 24);
  const gap = barW * 0.35;

  drawBarChartGrid(svg, W, H, PX, PY, plotH, maxVal);
  drawLegend(svg, [
    { color: CLR_ACCENT_LIGHT, label: "Planned" },
    { color: CLR_ACCENT, label: "Completed" },
  ], W);

  bars.forEach((bar, i) => {
    const cx = PX + groupW * i + groupW / 2;
    const drawBar = (value: number, color: string, offsetX: number) => {
      const bh = (value / maxVal) * plotH;
      const rect = svgEl("rect") as SVGRectElement;
      rect.setAttribute("x", String(cx + offsetX)); rect.setAttribute("y", String(PY + plotH - bh));
      rect.setAttribute("width", String(barW)); rect.setAttribute("height", String(Math.max(bh, 0)));
      rect.setAttribute("fill", color); rect.setAttribute("rx", "2");
      svg.appendChild(rect);
    };
    drawBar(bar.planned,   CLR_ACCENT_LIGHT, -(barW + gap / 2));
    drawBar(bar.completed, CLR_ACCENT, gap / 2);

    const label = svgEl("text") as SVGTextElement;
    label.setAttribute("x", String(cx)); label.setAttribute("y", String(H - 5));
    label.setAttribute("text-anchor", "middle"); label.setAttribute("fill", CLR_MUTED);
    label.setAttribute("font-size", "9"); label.setAttribute("font-family", FONT);
    label.textContent = bar.sprintLabel; svg.appendChild(label);
  });
}

function drawWorkloadChart(svg: SVGSVGElement, rows: SprintDashboardRow[], allEmails: string[], memberNames: string[]): void {
  const W = 600, H = 160, PX = 36, PY = 20, PB = 42;
  svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
  svg.innerHTML = "";

  if (!rows.length || !allEmails.length) {
    const t = svgEl("text") as SVGTextElement;
    t.setAttribute("x", String(W / 2)); t.setAttribute("y", String(H / 2));
    t.setAttribute("text-anchor", "middle"); t.setAttribute("fill", CLR_MUTED);
    t.setAttribute("font-size", "12"); t.setAttribute("font-family", FONT);
    t.textContent = "No member assignment data yet."; svg.appendChild(t); return;
  }

  const maxVal = Math.max(
    ...rows.flatMap((row) =>
      allEmails.map((e) => Math.max(row.memberStats[e]?.assigned ?? 0, row.memberStats[e]?.worked ?? 0))
    ), 1
  );
  const plotW = W - PX - 12;
  const plotH = H - PY - PB;
  const nSprints = rows.length;
  const nMembers = allEmails.length;
  const groupW = plotW / nSprints;
  const memberSlot = groupW / (nMembers + 0.5);
  const barW = Math.min(memberSlot * 0.33, 16);
  const barGap = barW * 0.3;
  const barBottom = PY + plotH;

  drawBarChartGrid(svg, W, H, PX, PY, plotH, maxVal);
  drawLegend(svg, [
    { color: CLR_ACCENT_LIGHT, label: "Assigned" },
    { color: CLR_ACCENT, label: "Worked" },
  ], W);

  // Thin separator lines between sprint groups
  for (let si = 1; si < nSprints; si++) {
    const x = PX + groupW * si;
    const sep = svgEl("line") as SVGLineElement;
    sep.setAttribute("x1", String(x)); sep.setAttribute("x2", String(x));
    sep.setAttribute("y1", String(PY)); sep.setAttribute("y2", String(barBottom));
    sep.setAttribute("stroke", CLR_GRID); svg.appendChild(sep);
  }

  rows.forEach((row, si) => {
    const gx = PX + groupW * si;

    allEmails.forEach((email, mi) => {
      const stat = row.memberStats[email] ?? { assigned: 0, worked: 0, remain: 0 };
      const cx = gx + memberSlot * (mi + 0.5);

      const drawBar = (value: number, color: string, offsetX: number) => {
        const bh = (value / maxVal) * plotH;
        const rect = svgEl("rect") as SVGRectElement;
        rect.setAttribute("x", String(cx + offsetX)); rect.setAttribute("y", String(barBottom - bh));
        rect.setAttribute("width", String(barW)); rect.setAttribute("height", String(Math.max(bh, 0)));
        rect.setAttribute("fill", color); rect.setAttribute("rx", "2");
        svg.appendChild(rect);
      };
      drawBar(stat.assigned, CLR_ACCENT_LIGHT, -(barW + barGap / 2));
      drawBar(stat.worked,   CLR_ACCENT, barGap / 2);

      // Member first name below bar pair
      const firstName = (memberNames[mi] ?? email).split(" ")[0].slice(0, 8);
      const nameLabel = svgEl("text") as SVGTextElement;
      nameLabel.setAttribute("x", String(cx));
      nameLabel.setAttribute("y", String(barBottom + 11));
      nameLabel.setAttribute("text-anchor", "middle");
      nameLabel.setAttribute("fill", CLR_MUTED);
      nameLabel.setAttribute("font-size", "8"); nameLabel.setAttribute("font-family", FONT);
      nameLabel.textContent = firstName; svg.appendChild(nameLabel);
    });

    // Sprint label centred below member names
    const sprintLabel = svgEl("text") as SVGTextElement;
    sprintLabel.setAttribute("x", String(gx + groupW / 2));
    sprintLabel.setAttribute("y", String(H - 5));
    sprintLabel.setAttribute("text-anchor", "middle"); sprintLabel.setAttribute("fill", CLR_MUTED);
    sprintLabel.setAttribute("font-size", "9"); sprintLabel.setAttribute("font-family", FONT);
    sprintLabel.textContent = row.sprintLabel; svg.appendChild(sprintLabel);
  });
}

function renderDashboard(): void {
  const { sprints } = getState();
  const projectToday = getProjectToday();
  const pairs = getMemberPairs();
  const resolveEmail = (email: string): string =>
    pairs.find((p) => p.email === email)?.name ?? email;

  const { rows, allEmails } = buildMemberActivityData(sprints, projectToday);
  const memberNames = allEmails.map(resolveEmail);
  const velocityBars = buildVelocityData(sprints);

  // --- Velocity chart ---
  drawVelocityChart(dom.velocityChart, velocityBars);

  // --- Workload chart ---
  drawWorkloadChart(dom.workloadChart, rows, allEmails, memberNames);

  // --- Member activity table ---
  if (!rows.length) {
    dom.memberActivityTable.innerHTML = '<p class="dash-empty">No sprint data yet.</p>';
    return;
  }
  const cols = [...memberNames, "Total"];

  let html = '<table class="dash-table"><thead>';
  // Row 1: Sprint | Member1 (colspan 3) | ... | Total (colspan 3)
  html += '<tr><th rowspan="2">Sprint</th>';
  cols.forEach((name) => {
    html += `<th colspan="3" class="dash-member-header">${name}</th>`;
  });
  html += "</tr>";
  // Row 2: assigned / worked / remain sub-headers
  html += '<tr class="dash-sub-header">';
  cols.forEach(() => {
    html += "<th>Asgn</th><th>Wrkd</th><th>Rem</th>";
  });
  html += "</tr></thead><tbody>";

  rows.forEach((row) => {
    const cls = row.isCurrentSprint ? ' class="dash-current-sprint"' : "";
    html += `<tr${cls}><td class="dash-sprint-label">${row.sprintLabel}</td>`;
    allEmails.forEach((email) => {
      const s = row.memberStats[email] ?? { assigned: 0, worked: 0, remain: 0 };
      html += `<td class="dash-num">${s.assigned}</td><td class="dash-num">${s.worked}</td><td class="dash-num">${s.remain}</td>`;
    });
    html += `<td class="dash-num dash-total">${row.totals.assigned}</td><td class="dash-num dash-total">${row.totals.worked}</td><td class="dash-num dash-total">${row.totals.remain}</td>`;
    html += "</tr>";
  });

  // Grand total row
  const grandAssigned = rows.reduce((sum, r) => sum + r.totals.assigned, 0);
  const grandWorked   = rows.reduce((sum, r) => sum + r.totals.worked, 0);
  const grandRemain   = rows.reduce((sum, r) => sum + r.totals.remain, 0);
  const memberTotals  = allEmails.map((email) => ({
    assigned: rows.reduce((sum, r) => sum + (r.memberStats[email]?.assigned ?? 0), 0),
    worked:   rows.reduce((sum, r) => sum + (r.memberStats[email]?.worked ?? 0), 0),
    remain:   rows.reduce((sum, r) => sum + (r.memberStats[email]?.remain ?? 0), 0),
  }));

  html += '<tr class="dash-grand-total"><td>Total</td>';
  memberTotals.forEach((t) => {
    html += `<td class="dash-num">${t.assigned}</td><td class="dash-num">${t.worked}</td><td class="dash-num">${t.remain}</td>`;
  });
  html += `<td class="dash-num dash-total">${grandAssigned}</td><td class="dash-num dash-total">${grandWorked}</td><td class="dash-num dash-total">${grandRemain}</td>`;
  html += "</tr></tbody></table>";

  dom.memberActivityTable.innerHTML = html;
}
