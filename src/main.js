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
  getPreferences,
  addHoliday,
  removeHoliday,
  addWorkWeekend,
  removeWorkWeekend,
  getMembers,
  addMember,
  removeMember,
} from "./state.js";
import { render, setActiveTab, startEditing, expandAll, collapseAll, toggleTaskSort, toggleBacklogSort, setHighlightBacklogTaskId } from "./render.js";
import { H_CHART } from "./state.js";
import { exportData, exportSprintExcel, importData, exportBacklogExcel, importBacklogExcel } from "./io.js";
import { getNextWorkingDay, addWorkingDays, findGaps, sprintsOverlap, todayIso, getWorkingDates, localIso } from "./utils.js";

setOnStateChange(render);

// --- Flatpickr instances ---
let fpStart = null;
let fpEnd = null;

const getDisabledRanges = (excludeId) => {
  const others = getState().sprints.filter((s) => s.id !== excludeId);
  const prefs = getPreferences();
  const holidaySet = new Set(prefs.holidays.map((h) => h.date));
  const workWeekendSet = new Set(prefs.workWeekends);
  return [
    (date) => {
      const iso = localIso(date);
      if (holidaySet.has(iso)) return true;
      const isWeekend = date.getDay() === 0 || date.getDay() === 6;
      if (isWeekend && workWeekendSet.has(iso)) return false;
      return isWeekend;
    },
    ...others.map((s) => ({ from: s.startDate, to: s.endDate })),
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
    const startIso = localIso(start);
    const endIso = localIso(end);
    const prefs = getPreferences();
    const holidaySet = new Set(prefs.holidays.map((h) => h.date));
    const workWeekendSet = new Set(prefs.workWeekends);
    const count = getWorkingDates(startIso, endIso, holidaySet, workWeekendSet).length;
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

dom.showDayNumbers.addEventListener("change", () => render(H_CHART));

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
  if (e.target.files[0]) importBacklogExcel(e.target.files[0]);
  e.target.value = "";
});

// --- Sortable column headers ---
document.querySelectorAll(".task-table thead th.sortable").forEach((th) => {
  th.addEventListener("click", () => toggleTaskSort(th.dataset.sortKey));
});
document.querySelectorAll(".backlog-table thead th.sortable").forEach((th) => {
  th.addEventListener("click", (e) => {
    // Don't sort when clicking the column resizer
    if (e.target.classList.contains("col-resizer")) return;
    toggleBacklogSort(th.dataset.sortKey);
  });
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

// --- Preferences modal ---
let fpPrefHoliday = null;
let fpPrefWeekend = null;

const renderPrefLists = () => {
  const prefs = getPreferences();

  // Holiday list
  dom.prefHolidayList.innerHTML = "";
  for (const h of prefs.holidays) {
    const row = document.createElement("div");
    row.className = "pref-list-row";
    row.innerHTML = `<span class="pref-list-date">${h.date}</span><span class="pref-list-name">${h.name || ""}</span><button class="btn ghost small pref-list-delete">&times;</button>`;
    row.querySelector(".pref-list-delete").addEventListener("click", () => {
      removeHoliday(h.date);
      renderPrefLists();
    });
    dom.prefHolidayList.appendChild(row);
  }

  // Work weekend list
  dom.prefWeekendList.innerHTML = "";
  for (const d of prefs.workWeekends) {
    const row = document.createElement("div");
    row.className = "pref-list-row";
    row.innerHTML = `<span class="pref-list-date">${d}</span><button class="btn ghost small pref-list-delete">&times;</button>`;
    row.querySelector(".pref-list-delete").addEventListener("click", () => {
      removeWorkWeekend(d);
      renderPrefLists();
    });
    dom.prefWeekendList.appendChild(row);
  }

  // Member list
  dom.prefMemberList.innerHTML = "";
  const members = getMembers();
  for (const name of members) {
    const row = document.createElement("div");
    row.className = "pref-list-row";
    row.innerHTML = `<span class="pref-list-name">${name}</span><button class="btn ghost small pref-list-delete">&times;</button>`;
    row.querySelector(".pref-list-delete").addEventListener("click", () => {
      removeMember(name);
      renderPrefLists();
    });
    dom.prefMemberList.appendChild(row);
  }
};

const openPreferences = () => {
  dom.preferencesModal.hidden = false;
  dom.prefHolidayDate.value = "";
  dom.prefHolidayName.value = "";
  dom.prefWeekendDate.value = "";

  if (fpPrefHoliday) fpPrefHoliday.destroy();
  fpPrefHoliday = flatpickr(dom.prefHolidayDate, {
    dateFormat: "Y-m-d",
    disableMobile: true,
    onOpen: (_, __, instance) => fixCalendarPosition(instance),
  });

  if (fpPrefWeekend) fpPrefWeekend.destroy();
  fpPrefWeekend = flatpickr(dom.prefWeekendDate, {
    dateFormat: "Y-m-d",
    disableMobile: true,
    disable: [(date) => date.getDay() !== 0 && date.getDay() !== 6],
    onOpen: (_, __, instance) => fixCalendarPosition(instance),
  });

  renderPrefLists();
};

const closePreferences = () => {
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

const commitAddMember = () => {
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
  // Don't clear if clicking an Add button in the backlog panel (those set their own highlight)
  if (e.target.closest(".bp-add-btn") || e.target.closest(".add-by-id-row")) return;
  const highlighted = document.querySelector(".task-row-highlight");
  if (highlighted) highlighted.classList.remove("task-row-highlight");
  setHighlightBacklogTaskId(null);
}, true);

render();
