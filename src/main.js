import { dom } from "./dom.js";
import {
  setOnStateChange,
  createSprint,
  deleteActiveSprint,
  updateSprintById,
  addTaskFromBacklog,
  addStory,
  updateToday,
  getActiveSprint,
  getState,
  replaceBacklog,
} from "./state.js";
import { render, setActiveTab, startEditing, expandAll, collapseAll } from "./render.js";
import { exportData, exportSprintExcel, importData, exportBacklogExcel, importBacklogExcel } from "./io.js";
import { getNextWorkingDay, addWorkingDays, findGaps, sprintsOverlap, todayIso, getWorkingDates } from "./utils.js";

setOnStateChange(render);

// --- Flatpickr instances ---
let fpStart = null;
let fpEnd = null;

const getDisabledRanges = (excludeId) => {
  const others = getState().sprints.filter((s) => s.id !== excludeId);
  return [
    (date) => date.getDay() === 0 || date.getDay() === 6, // weekends
    ...others.map((s) => ({ from: s.startDate, to: s.endDate })), // occupied ranges
  ];
};

const fixCalendarPosition = (instance) => {
  setTimeout(() => {
    const rect = instance.input.getBoundingClientRect();
    const cal = instance.calendarContainer;
    cal.style.position = "fixed";
    cal.style.top = rect.bottom + 4 + "px";
    cal.style.left = rect.left + "px";
    cal.style.zIndex = "1000";
  }, 0);
};

const updateWorkingDaysChip = () => {
  const start = fpStart?.selectedDates[0];
  const end = fpEnd?.selectedDates[0];
  if (start && end) {
    const startIso = `${start.getFullYear()}-${String(start.getMonth()+1).padStart(2,"0")}-${String(start.getDate()).padStart(2,"0")}`;
    const endIso = `${end.getFullYear()}-${String(end.getMonth()+1).padStart(2,"0")}-${String(end.getDate()).padStart(2,"0")}`;
    const count = getWorkingDates(startIso, endIso).length;
    dom.modalWorkingDays.textContent = `${count} working days`;
  } else {
    dom.modalWorkingDays.textContent = "";
  }
};

const initDatePickers = (excludeId, defaultStart, defaultEnd) => {
  if (fpStart) fpStart.destroy();
  if (fpEnd) fpEnd.destroy();
  const disabled = getDisabledRanges(excludeId);
  const base = {
    dateFormat: "Y-m-d",
    disableMobile: true,
    disable: disabled,
    onOpen: (_, __, instance) => fixCalendarPosition(instance),
    onChange: () => updateWorkingDaysChip(),
  };
  fpStart = flatpickr(dom.modalStartDate, { ...base, defaultDate: defaultStart || null });
  fpEnd = flatpickr(dom.modalEndDate, { ...base, defaultDate: defaultEnd || null });
  updateWorkingDaysChip();
};

// --- Modal ---
let modalMode = "edit";
let modalSprintId = null;

const openModal = (mode, sprint) => {
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

const closeModal = () => {
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

  if (!startDate || !endDate || startDate > endDate) {
    dom.modalError.textContent = "Please select a valid start and end date.";
    dom.modalError.hidden = false;
    return;
  }

  const state = getState();
  const otherSprints = state.sprints.filter((s) => s.id !== modalSprintId);
  const conflicting = otherSprints.find((s) => sprintsOverlap({ startDate, endDate }, s));
  if (conflicting) {
    const conflictNum = state.sprints.indexOf(conflicting) + 1;
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

// --- New Sprint ---
dom.newSprintBtn.addEventListener("click", () => {
  const sprints = getState().sprints; // sorted by startDate
  const latestEnd = sprints.length > 0 ? sprints[sprints.length - 1].endDate : "";
  const start = latestEnd ? getNextWorkingDay(latestEnd) : todayIso();
  const end = addWorkingDays(start, 10);
  openModal("create", { description: "", startDate: start, endDate: end, developers: 0, efficiency: 1 });
});

// --- Edit Sprint ---
dom.editSprintBtn.addEventListener("click", () => {
  const sprint = getActiveSprint();
  if (sprint) openModal("edit", sprint);
});

// --- Other controls ---
dom.deleteSprintBtn.addEventListener("click", deleteActiveSprint);
if (dom.exportCsvBtn) dom.exportCsvBtn.addEventListener("click", exportSprintExcel);
dom.exportBtn.addEventListener("click", exportData);
dom.importBtn.addEventListener("click", () => dom.importFile.click());
dom.importFile.addEventListener("change", (e) => {
  if (e.target.files[0]) importData(e.target.files[0]);
  e.target.value = "";
});

dom.showDayNumbers.addEventListener("change", render);

// --- Tabs ---
dom.tabSprint.addEventListener("click", () => setActiveTab("sprint"));
dom.tabBacklog.addEventListener("click", () => setActiveTab("backlog"));

// --- Add-by-ID ---
const commitAddById = () => {
  const input = dom.addByIdInput.value.trim();
  if (!input) return;
  const backlog = getState().backlog;
  let uuid = null;
  for (const story of backlog?.stories ?? []) {
    const found = story.tasks.find(t => t.taskId === input);
    if (found) { uuid = found.id; break; }
  }
  if (!uuid) { alert(`Task "${input}" not found in backlog.`); return; }
  addTaskFromBacklog(uuid);
  dom.addByIdInput.value = "";
};
dom.addByIdBtn.addEventListener("click", commitAddById);
dom.addByIdInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") { e.preventDefault(); commitAddById(); }
});

// --- Backlog panel toggle (open state persists across re-renders) ---
let backlogPanelOpen = false;
document.getElementById("backlogPanelToggle").addEventListener("click", () => {
  backlogPanelOpen = !backlogPanelOpen;
  document.getElementById("backlogPanelRows").hidden = !backlogPanelOpen;
  document.getElementById("backlogPanelToggle").querySelector(".panel-toggle-chevron").textContent =
    backlogPanelOpen ? "▲" : "▼";
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
  const backlogTaskId = e.dataTransfer.getData("backlogTaskId");
  if (backlogTaskId) addTaskFromBacklog(backlogTaskId);
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
  if (e.target.files[0]) importBacklogExcel(e.target.files[0]);
  e.target.value = "";
});

// --- Backlog column resizing ---
(function initBacklogResize() {
  const table = document.querySelector(".backlog-table");
  const ths   = Array.from(table.querySelectorAll("thead th"));
  const cols  = Array.from(table.querySelectorAll("col"));
  let frozen = false;

  // Lock every column AND the table itself to exact pixel widths.
  // - We set BOTH col.style.width AND th.style.width so there is no
  //   ambiguity about which the browser uses for fixed-layout column sizing.
  // - We set table.style.width to an exact px value (NOT 'auto') because
  //   table-layout:fixed with width:auto silently reverts to content-based
  //   layout in Chrome/Firefox, making col widths irrelevant.
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

  // All columns except the last (actions) get a resizer
  ths.slice(0, -1).forEach((th, i) => {
    const resizer = th.querySelector(".col-resizer");
    if (!resizer) return;
    const col = cols[i];

    resizer.addEventListener("mousedown", (e) => {
      freezeWidths();
      const startX  = e.clientX;
      const startW  = th.offsetWidth;        // column width at drag start
      const tableW  = table.offsetWidth;     // total table width at drag start

      resizer.classList.add("resizing");
      document.body.style.cursor    = "col-resize";
      document.body.style.userSelect = "none";

      const onMove = (ev) => {
        const delta   = ev.clientX - startX;
        const newColW = Math.max(40, startW + delta);
        const diff    = newColW - startW;
        // Update column via both col and th — belt-and-suspenders across browsers
        th.style.width = newColW + "px";
        if (col) col.style.width = newColW + "px";
        // Grow/shrink the table by the same amount so no other column shifts
        table.style.width = (tableW + diff) + "px";
      };

      const onUp = () => {
        resizer.classList.remove("resizing");
        document.body.style.cursor    = "";
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
