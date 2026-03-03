import { dom } from "./dom.ts";
import {
  setOnStateChange,
  createSprint,
  deleteActiveSprint,
  resetActiveSprint,
  updateSprintById,
  addTaskFromBacklog,
  addStory,
  getActiveSprint,
  getState,
  getProjectToday,
  setProjectToday,
  finalizeSprintPlan,
  replaceBacklog,
  getPreferences,
  addHoliday,
  removeHoliday,
  addWorkWeekend,
  removeWorkWeekend,
  getMembers,
  addMember,
  removeMember,
} from "./state.ts";
import { render, setActiveTab, startEditing, expandAll, collapseAll, toggleTaskSort, toggleBacklogSort, setHighlightBacklogTaskId, togglePlanTaskSort, togglePlanBacklogSort } from "./render.ts";
import { H_CHART } from "./state.ts";
import { exportData, exportSprintExcel, importData, exportBacklogExcel, importBacklogExcel } from "./io.ts";
import { getNextWorkingDay, addWorkingDays, findGaps, todayIso, getWorkingDates, localIso } from "./utils.ts";
import type { Sprint } from "./types.ts";

setOnStateChange(render);

// --- Flatpickr instances ---
let fpStart: FlatpickrInstance | null = null;
let fpEnd: FlatpickrInstance | null = null;

const getDisabledRanges = (excludeId: string | null): FlatpickrOptions["disable"] => {
  const others = getState().sprints.filter((s) => s.id !== excludeId);
  const prefs = getPreferences();
  const holidaySet = new Set(prefs.holidays.map((h) => h.date));
  const workWeekendSet = new Set(prefs.workWeekends);
  return [
    (date: Date) => {
      const iso = localIso(date);
      if (holidaySet.has(iso)) return true;
      const isWeekend = date.getDay() === 0 || date.getDay() === 6;
      if (isWeekend && workWeekendSet.has(iso)) return false;
      return isWeekend;
    },
    ...others.map((s) => ({ from: s.startDate, to: s.endDate })),
  ];
};

const fixCalendarPosition = (instance: FlatpickrInstance): void => {
  setTimeout(() => {
    const rect = instance.input.getBoundingClientRect();
    const cal = instance.calendarContainer;
    cal.style.position = "fixed";
    cal.style.top = rect.bottom + 4 + "px";
    cal.style.left = rect.left + "px";
    cal.style.zIndex = "1000";
  }, 0);
};

const updateWorkingDaysChip = (): void => {
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

// Returns the calendar day before / after an ISO date string
const isoAddDays = (iso: string, n: number): string => {
  const d = new Date(iso + "T12:00:00");
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
};

// Tighten maxDate on the end picker to the day before the nearest sprint that
// starts after `startIso`, and minDate on the start picker to the day after
// the nearest sprint that ends before `endIso`.
const updateGapBounds = (excludeId: string | null, startIso: string | null, endIso: string | null): void => {
  const others = getState().sprints
    .filter(s => s.id !== excludeId)
    .sort((a, b) => a.startDate.localeCompare(b.startDate));

  if (startIso && fpEnd) {
    const next = others.find(s => s.startDate > startIso);
    fpEnd.set("maxDate", next ? isoAddDays(next.startDate, -1) : null);
  }
  if (endIso && fpStart) {
    const prev = [...others].reverse().find(s => s.endDate < endIso);
    fpStart.set("minDate", prev ? isoAddDays(prev.endDate, 1) : null);
  }
};

const initDatePickers = (excludeId: string | null, defaultStart?: string, defaultEnd?: string): void => {
  if (fpStart) fpStart.destroy();
  if (fpEnd) fpEnd.destroy();
  const disabled = getDisabledRanges(excludeId);
  const base: FlatpickrOptions = {
    dateFormat: "Y-m-d",
    disableMobile: true,
    disable: disabled,
    onOpen: (_: Date[], __: string, instance: FlatpickrInstance) => fixCalendarPosition(instance),
  };
  fpStart = flatpickr(dom.modalStartDate, {
    ...base,
    defaultDate: defaultStart || null,
    onChange: ([date]: Date[]) => {
      const iso = date ? localIso(date) : null;
      if (fpEnd) fpEnd.set("minDate", iso);
      updateGapBounds(excludeId, iso, fpEnd?.selectedDates[0] ? localIso(fpEnd.selectedDates[0]) : null);
      updateWorkingDaysChip();
    },
  });
  fpEnd = flatpickr(dom.modalEndDate, {
    ...base,
    defaultDate: defaultEnd || null,
    minDate: defaultStart || null,
    onChange: ([date]: Date[]) => {
      const iso = date ? localIso(date) : null;
      if (fpStart) fpStart.set("maxDate", iso);
      updateGapBounds(excludeId, fpStart?.selectedDates[0] ? localIso(fpStart.selectedDates[0]) : null, iso);
      updateWorkingDaysChip();
    },
  });
  // Apply initial gap bounds if defaults are provided
  updateGapBounds(excludeId, defaultStart || null, defaultEnd || null);
  updateWorkingDaysChip();
};

dom.modalDevelopers.addEventListener("input", updateWorkingDaysChip);
dom.modalEfficiency.addEventListener("input", updateWorkingDaysChip);

// --- Modal ---
let modalMode: "edit" | "create" | "plan-edit" = "edit";
let modalSprintId: string | null = null;

interface ModalSprint {
  id?: string;
  description?: string;
  startDate?: string;
  endDate?: string;
  developers?: number;
  efficiency?: number;
}

const openModal = (mode: "edit" | "create" | "plan-edit", sprint: ModalSprint): void => {
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

const closeModal = (): void => {
  dom.sprintModal.hidden = true;
  if (fpStart) { fpStart.destroy(); fpStart = null; }
  if (fpEnd) { fpEnd.destroy(); fpEnd = null; }
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
    updateSprintById(modalSprintId!, updates);
    closeModal();
    dom.sprintPlanModal.hidden = false;
    render();
  } else {
    updateSprintById(modalSprintId!, updates);
    closeModal();
  }

  const gaps = findGaps(getState().sprints);
  if (gaps.length > 0) {
    alert("Note: There is a gap of working days between some sprints. You can close the gap by editing the sprint dates.");
  }
});

// --- New Sprint ---
dom.newSprintBtn.addEventListener("click", () => {
  const state = getState();
  const sprints = state.sprints;
  const latestSprint = sprints.length > 0 ? sprints[sprints.length - 1] : null;
  const latestEnd = latestSprint ? latestSprint.endDate : "";
  const start = latestEnd ? getNextWorkingDay(latestEnd) : todayIso();
  const end = addWorkingDays(start, 10);
  const defaultDevelopers = latestSprint
    ? latestSprint.developers
    : state.preferences.members.length || 4;
  openModal("create", { description: "", startDate: start, endDate: end, developers: defaultDevelopers, efficiency: 1 });
});

// --- Edit Sprint ---
dom.editSprintBtn.addEventListener("click", () => {
  const sprint = getActiveSprint();
  if (!sprint) return;
  const mode = sprint.startDate > getProjectToday() ? "plan-edit" : "edit";
  openModal(mode, sprint);
});

// --- Sprint Planning Modal ---
const closePlanModal = (): void => {
  dom.sprintPlanModal.hidden = true;
  finalizeSprintPlan();
};
dom.sprintPlanClose.addEventListener("click", closePlanModal);
dom.sprintPlanDone.addEventListener("click", closePlanModal);
dom.sprintPlanModal.addEventListener("click", (e) => { if (e.target === dom.sprintPlanModal) closePlanModal(); });

// --- Other controls ---
dom.resetSprintBtn.addEventListener("click", () => {
  const sprint = getActiveSprint();
  if (!sprint) return;
  const idx = getState().sprints.findIndex(s => s.id === sprint.id) + 1;
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
  const idx = getState().sprints.findIndex(s => s.id === sprint.id) + 1;
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
  const target = e.target as HTMLInputElement;
  if (target.files?.[0]) importData(target.files[0]);
  target.value = "";
});

dom.showDayNumbers.addEventListener("change", () => render(H_CHART));

// --- Tabs ---
dom.tabSprint.addEventListener("click", () => setActiveTab("sprint"));
dom.tabBacklog.addEventListener("click", () => setActiveTab("backlog"));

// --- Add-by-ID ---
const commitAddById = (): void => {
  const input = dom.addByIdInput.value.trim();
  if (!input) return;
  const backlog = getState().backlog;
  let uuid: string | null = null;
  for (const story of backlog?.stories ?? []) {
    const found = story.tasks.find(t => t.taskId === input);
    if (found) { uuid = found.id; break; }
  }
  if (!uuid) { alert(`Task "${input}" not found in backlog.`); return; }
  setHighlightBacklogTaskId(uuid);
  addTaskFromBacklog(uuid);
  dom.addByIdInput.value = "";
};
dom.addByIdBtn.addEventListener("click", commitAddById);
dom.addByIdInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") { e.preventDefault(); commitAddById(); }
});

// --- Backlog panel toggle (open state persists across re-renders) ---
let backlogPanelOpen = false;
document.getElementById("backlogPanelToggle")!.addEventListener("click", () => {
  backlogPanelOpen = !backlogPanelOpen;
  (document.getElementById("backlogPanelRows") as HTMLElement).hidden = !backlogPanelOpen;
  document.getElementById("backlogPanelToggle")!.querySelector(".panel-toggle-chevron")!.textContent =
    backlogPanelOpen ? "\u25B2" : "\u25BC";
});

// --- Backlog panel: tbody drop target ---
dom.taskRows.addEventListener("dragover", (e) => {
  e.preventDefault();
  dom.taskRows.classList.add("drag-over");
});
dom.taskRows.addEventListener("dragleave", () => dom.taskRows.classList.remove("drag-over"));
dom.taskRows.addEventListener("drop", (e) => {
  e.preventDefault();
  dom.taskRows.classList.remove("drag-over");
  const backlogTaskId = (e as DragEvent).dataTransfer!.getData("backlogTaskId");
  if (backlogTaskId) {
    setHighlightBacklogTaskId(backlogTaskId);
    addTaskFromBacklog(backlogTaskId);
  }
});

// --- Backlog CRUD + CSV ---
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
  const target = e.target as HTMLInputElement;
  if (target.files?.[0]) importBacklogExcel(target.files[0]);
  target.value = "";
});

// --- Sortable column headers ---
document.querySelectorAll(".task-table thead th.sortable").forEach((th) => {
  th.addEventListener("click", () => toggleTaskSort((th as HTMLElement).dataset.sortKey!));
});
document.querySelectorAll(".backlog-table thead th.sortable").forEach((th) => {
  th.addEventListener("click", (e) => {
    if ((e.target as HTMLElement).classList.contains("col-resizer")) return;
    toggleBacklogSort((th as HTMLElement).dataset.sortKey!);
  });
});
document.querySelectorAll(".plan-task-table thead th.sortable").forEach((th) => {
  th.addEventListener("click", () => togglePlanTaskSort((th as HTMLElement).dataset.sortKey!));
});

// --- Backlog column resizing ---
(function initBacklogResize() {
  const table = document.querySelector(".backlog-table") as HTMLTableElement;
  const ths   = Array.from(table.querySelectorAll("thead th")) as HTMLTableCellElement[];
  const cols  = Array.from(table.querySelectorAll("col")) as HTMLTableColElement[];
  let frozen = false;

  function freezeWidths(): void {
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
      const me = e as MouseEvent;
      const startX  = me.clientX;
      const startW  = th.offsetWidth;
      const tableW  = table.offsetWidth;

      resizer.classList.add("resizing");
      document.body.style.cursor    = "col-resize";
      document.body.style.userSelect = "none";

      const onMove = (ev: MouseEvent): void => {
        const delta   = ev.clientX - startX;
        const newColW = Math.max(40, startW + delta);
        const diff    = newColW - startW;
        th.style.width = newColW + "px";
        if (col) col.style.width = newColW + "px";
        table.style.width = (tableW + diff) + "px";
      };

      const onUp = (): void => {
        resizer.classList.remove("resizing");
        document.body.style.cursor    = "";
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

// --- Preferences modal ---
let fpPrefHoliday: FlatpickrInstance | null = null;
let fpPrefWeekend: FlatpickrInstance | null = null;

const renderPrefLists = (): void => {
  const prefs = getPreferences();

  dom.prefHolidayList.innerHTML = "";
  for (const h of prefs.holidays) {
    const row = document.createElement("div");
    row.className = "pref-list-row";
    row.innerHTML = `<span class="pref-list-date">${h.date}</span><span class="pref-list-name">${h.name || ""}</span><button class="btn ghost small pref-list-delete">&times;</button>`;
    row.querySelector(".pref-list-delete")!.addEventListener("click", () => {
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
    row.querySelector(".pref-list-delete")!.addEventListener("click", () => {
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
    row.querySelector(".pref-list-delete")!.addEventListener("click", () => {
      removeMember(name);
      renderPrefLists();
    });
    dom.prefMemberList.appendChild(row);
  }
};

const openPreferences = (): void => {
  dom.preferencesModal.hidden = false;
  dom.prefHolidayDate.value = "";
  dom.prefHolidayName.value = "";
  dom.prefWeekendDate.value = "";

  if (fpPrefHoliday) fpPrefHoliday.destroy();
  fpPrefHoliday = flatpickr(dom.prefHolidayDate, {
    dateFormat: "Y-m-d",
    disableMobile: true,
    onOpen: (_: Date[], __: string, instance: FlatpickrInstance) => fixCalendarPosition(instance),
  });

  if (fpPrefWeekend) fpPrefWeekend.destroy();
  fpPrefWeekend = flatpickr(dom.prefWeekendDate, {
    dateFormat: "Y-m-d",
    disableMobile: true,
    disable: [(date: Date) => date.getDay() !== 0 && date.getDay() !== 6],
    onOpen: (_: Date[], __: string, instance: FlatpickrInstance) => fixCalendarPosition(instance),
  });

  renderPrefLists();
};

const closePreferences = (): void => {
  dom.preferencesModal.hidden = true;
  if (fpPrefHoliday) { fpPrefHoliday.destroy(); fpPrefHoliday = null; }
  if (fpPrefWeekend) { fpPrefWeekend.destroy(); fpPrefWeekend = null; }
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

const commitAddMember = (): void => {
  const name = dom.prefMemberName.value.trim();
  if (!name) return;
  addMember(name);
  dom.prefMemberName.value = "";
  renderPrefLists();
};
dom.prefMemberAddBtn.addEventListener("click", commitAddMember);
dom.prefMemberName.addEventListener("keydown", (e) => {
  if (e.key === "Enter") { e.preventDefault(); commitAddMember(); }
});

// --- Clear task highlight on any click ---
document.addEventListener("click", (e) => {
  const target = e.target as HTMLElement;
  if (target.closest(".bp-add-btn") || target.closest(".add-by-id-row")) return;
  const highlighted = document.querySelector(".task-row-highlight");
  if (highlighted) highlighted.classList.remove("task-row-highlight");
  setHighlightBacklogTaskId(null);
}, true);

render();
