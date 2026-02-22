import { dom } from "./dom.js";
import {
  setOnStateChange,
  createSprint,
  deleteActiveSprint,
  updateSprintById,
  addTask,
  updateToday,
  getActiveSprint,
  getState,
} from "./state.js";
import { render } from "./render.js";
import { exportData, exportCsv, importData } from "./io.js";
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
