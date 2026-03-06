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
  replaceMembers,
  setCurrentTeam,
} from "./state.ts";
import { render, setActiveTab, startEditing, expandAll, collapseAll, toggleTaskSort, toggleBacklogSort, setHighlightBacklogTaskId, togglePlanTaskSort, togglePlanBacklogSort } from "./render.ts";
import { H_CHART } from "./state.ts";
import { exportData, exportSprintExcel, importData, exportBacklogExcel, importBacklogExcel } from "./io.ts";
import { getNextWorkingDay, addWorkingDays, findGaps, todayIso, getWorkingDates, localIso } from "./utils.ts";
import type { Sprint } from "./types.ts";
import { isFirebaseConfigured } from "./firebase.ts";
import { initAuth, ensureUserProfile, createNewUserProfile, signOut, type User } from "./auth.ts";
import { showLoginScreen, showTeamScreen, hideAllScreens, showProfileEditModal, showRegisterPrompt } from "./screens.ts";
import { getUserMemo, saveUserMemo, getTeamById, getUsersByIds } from "./db.ts";
import type { UserProfile } from "./types.ts";

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
  const memberCount = getMembers().length;
  if (memberCount > 0) {
    dom.modalDevelopers.max = String(memberCount);
  } else {
    dom.modalDevelopers.removeAttribute("max");
  }
  dom.modalDevelopers.value = String(Math.min(sprint.developers ?? 4, memberCount || Infinity));
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
  const memberCount = getMembers().length;
  const developers = memberCount > 0
    ? Math.min(Number(dom.modalDevelopers.value), memberCount)
    : Number(dom.modalDevelopers.value);
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

// Simple markdown → HTML renderer for memo preview
const renderMarkdown = (text: string): string => {
  const lines = text.split("\n");
  const out: string[] = [];
  let inList = false;
  for (const raw of lines) {
    let line = raw
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
      .replace(/\*(.+?)\*/g, "<em>$1</em>")
      .replace(/`(.+?)`/g, "<code>$1</code>");
    if (/^# (.+)/.test(line)) {
      if (inList) { out.push("</ul>"); inList = false; }
      out.push(`<h3>${line.replace(/^# /, "")}</h3>`);
    } else if (/^[-*] (.+)/.test(line)) {
      if (!inList) { out.push("<ul>"); inList = true; }
      out.push(`<li>${line.replace(/^[-*] /, "")}</li>`);
    } else {
      if (inList) { out.push("</ul>"); inList = false; }
      out.push(line === "" ? "<br>" : `<p>${line}</p>`);
    }
  }
  if (inList) out.push("</ul>");
  return out.join("");
};

// Memo state
let _memoSaveTimer: ReturnType<typeof setTimeout> | null = null;
let _currentTeamIdForMemo: string | null = null;
let _currentUidForMemo: string | null = null;
let _memoPreviewMode = false;

const saveMemoNow = async (): Promise<void> => {
  if (!_currentUidForMemo || !_currentTeamIdForMemo) return;
  const text = dom.prefMemoTextarea.value;
  try {
    await saveUserMemo(_currentUidForMemo, _currentTeamIdForMemo, text);
    dom.prefMemoStatus.textContent = "Saved";
    setTimeout(() => { dom.prefMemoStatus.textContent = ""; }, 2000);
  } catch {
    dom.prefMemoStatus.textContent = "Save failed";
  }
};

dom.prefMemoTextarea.addEventListener("input", () => {
  dom.prefMemoStatus.textContent = "Saving…";
  if (_memoSaveTimer) clearTimeout(_memoSaveTimer);
  _memoSaveTimer = setTimeout(() => { void saveMemoNow(); }, 800);
});

dom.prefMemoTogglePreview.addEventListener("click", () => {
  _memoPreviewMode = !_memoPreviewMode;
  if (_memoPreviewMode) {
    dom.prefMemoPreview.innerHTML = renderMarkdown(dom.prefMemoTextarea.value);
    dom.prefMemoPreview.hidden = false;
    dom.prefMemoTextarea.hidden = true;
    dom.prefMemoTogglePreview.textContent = "Edit";
  } else {
    dom.prefMemoPreview.hidden = true;
    dom.prefMemoTextarea.hidden = false;
    dom.prefMemoTogglePreview.textContent = "Preview";
  }
});

document.querySelectorAll<HTMLButtonElement>(".pref-memo-format-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    const fmt = btn.dataset.format!;
    const ta = dom.prefMemoTextarea;
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const sel = ta.value.slice(start, end);
    let insertion = "";
    let cursorOffset = 0;
    if (fmt === "bold") { insertion = `**${sel || "bold text"}**`; cursorOffset = sel ? insertion.length : 2; }
    else if (fmt === "italic") { insertion = `*${sel || "italic text"}*`; cursorOffset = sel ? insertion.length : 1; }
    else if (fmt === "heading") { insertion = `# ${sel || "Heading"}`; cursorOffset = insertion.length; }
    else if (fmt === "list") { insertion = `- ${sel || "item"}`; cursorOffset = insertion.length; }
    ta.setRangeText(insertion, start, end, "end");
    ta.selectionStart = ta.selectionEnd = start + cursorOffset;
    ta.focus();
    ta.dispatchEvent(new Event("input"));
  });
});

const buildWeekendDisableFn = (): [(date: Date) => boolean] => {
  const workWeekendSet = new Set(getPreferences().workWeekends);
  return [
    (date: Date) =>
      (date.getDay() !== 0 && date.getDay() !== 6) || workWeekendSet.has(localIso(date)),
  ];
};

const buildHolidayDisableFn = (): [(date: Date) => boolean] => {
  const holidaySet = new Set(getPreferences().holidays.map((h) => h.date));
  return [
    (date: Date) =>
      date.getDay() === 0 || date.getDay() === 6 || holidaySet.has(localIso(date)),
  ];
};

const showMemberProfilePopup = (name: string): void => {
  document.getElementById("memberProfilePopup")?.remove();
  const p = _teamMemberProfiles.find((m) => m.displayName === name);

  const popup = document.createElement("div");
  popup.id = "memberProfilePopup";
  popup.className = "team-modal-overlay";
  popup.innerHTML = `
    <div class="team-modal member-profile-popup">
      <div class="member-profile-popup-header">
        <span class="member-profile-popup-avatar">${Array.from(name)[0]?.toUpperCase() ?? "?"}</span>
        <div>
          <div class="member-profile-popup-name">${name}</div>
          ${p ? `<div class="member-profile-popup-role">${p.role.replace("_", " ")}</div>` : ""}
        </div>
        <button class="modal-close member-profile-popup-close">&times;</button>
      </div>
      <div class="member-profile-popup-fields">
        <div class="member-profile-popup-row">
          <span class="member-profile-popup-label">Email</span>
          <span class="member-profile-popup-value">${p ? p.email : "—"}</span>
        </div>
        <div class="member-profile-popup-row">
          <span class="member-profile-popup-label">Phone</span>
          <span class="member-profile-popup-value">${p?.phoneNumber || "—"}</span>
        </div>
      </div>
    </div>
  `;
  document.body.appendChild(popup);
  popup.addEventListener("click", (e) => { if (e.target === popup) popup.remove(); });
  popup.querySelector(".member-profile-popup-close")!.addEventListener("click", () => popup.remove());
};

const refreshHolidayDisable = (): void => {
  if (fpPrefHoliday) {
    fpPrefHoliday.set("disable", buildHolidayDisableFn());
  }
};

const renderPrefLists = (): void => {
  const prefs = getPreferences();

  // Sync picker disabled dates
  refreshHolidayDisable();
  if (fpPrefWeekend) fpPrefWeekend.set("disable", buildWeekendDisableFn());

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

  // Members are read-only — click a row to view full profile
  dom.prefMemberList.innerHTML = "";
  const members = getMembers();
  if (members.length === 0) {
    dom.prefMemberList.innerHTML = "<em class='pref-hint'>No members yet. Add members via the Team screen.</em>";
  } else {
    for (const name of members) {
      const row = document.createElement("div");
      row.className = "pref-list-row pref-member-row-clickable";
      row.title = "Click to view profile";
      row.innerHTML = `<span class="pref-list-name">${name}</span><span class="pref-member-row-hint">›</span>`;
      row.addEventListener("click", () => showMemberProfilePopup(name));
      dom.prefMemberList.appendChild(row);
    }
  }
};

const openPreferences = (): void => {
  dom.preferencesModal.hidden = false;
  dom.prefHolidayDate.value = "";
  dom.prefHolidayName.value = "";
  dom.prefWeekendDate.value = "";

  // Reset memo preview mode
  _memoPreviewMode = false;
  dom.prefMemoPreview.hidden = true;
  dom.prefMemoTextarea.hidden = false;
  dom.prefMemoTogglePreview.textContent = "Preview";
  dom.prefMemoStatus.textContent = "";

  // Load memo for current user/team
  if (_currentUidForMemo && _currentTeamIdForMemo) {
    dom.prefMemoTextarea.value = "";
    getUserMemo(_currentUidForMemo, _currentTeamIdForMemo)
      .then((text) => { dom.prefMemoTextarea.value = text; })
      .catch(() => {});
  }

  if (fpPrefHoliday) fpPrefHoliday.destroy();
  fpPrefHoliday = flatpickr(dom.prefHolidayDate, {
    dateFormat: "Y-m-d",
    disableMobile: true,
    disable: buildHolidayDisableFn(),
    onOpen: (_: Date[], __: string, instance: FlatpickrInstance) => fixCalendarPosition(instance),
  });

  if (fpPrefWeekend) fpPrefWeekend.destroy();
  fpPrefWeekend = flatpickr(dom.prefWeekendDate, {
    dateFormat: "Y-m-d",
    disableMobile: true,
    disable: buildWeekendDisableFn(),
    onOpen: (_: Date[], __: string, instance: FlatpickrInstance) => fixCalendarPosition(instance),
  });

  renderPrefLists();
};

const closePreferences = (): void => {
  // Flush any pending memo save
  if (_memoSaveTimer) { clearTimeout(_memoSaveTimer); _memoSaveTimer = null; void saveMemoNow(); }
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
  if (fpPrefHoliday) { fpPrefHoliday.clear(); fpPrefHoliday.set("disable", buildHolidayDisableFn()); }
  renderPrefLists();
});

dom.prefWeekendAddBtn.addEventListener("click", () => {
  const date = dom.prefWeekendDate.value;
  if (!date) return;
  addWorkWeekend(date);
  dom.prefWeekendDate.value = "";
  if (fpPrefWeekend) { fpPrefWeekend.clear(); fpPrefWeekend.set("disable", buildWeekendDisableFn()); }
  renderPrefLists();
});

// --- Clear task highlight on any click ---
document.addEventListener("click", (e) => {
  const target = e.target as HTMLElement;
  if (target.closest(".bp-add-btn") || target.closest(".add-by-id-row")) return;
  const highlighted = document.querySelector(".task-row-highlight");
  if (highlighted) highlighted.classList.remove("task-row-highlight");
  setHighlightBacklogTaskId(null);
}, true);

// --- Header sign-out button ---
document.getElementById("signOutBtn")?.addEventListener("click", () => signOut());

// ---------------------------------------------------------------------------
// Auth gate
// ---------------------------------------------------------------------------

const showApp = (): void => {
  (document.querySelector(".app") as HTMLElement).style.visibility = "visible";
};

const hideApp = (): void => {
  (document.querySelector(".app") as HTMLElement).style.visibility = "hidden";
};

// Stored so the Switch Team button can re-open the team screen
let _activeUser: User | null = null;
let _activeProfile: UserProfile | null = null;
let _teamMemberProfiles: UserProfile[] = [];

const goToTeamScreen = (): void => {
  if (!_activeUser || !_activeProfile) return;
  hideApp();
  showTeamScreen(_activeUser, _activeProfile, (teamId, teamName) => {
    startApp(teamId, _activeProfile!, teamName);
  });
};

const updateHeaderUser = (profile: UserProfile): void => {
  const btn = document.getElementById("headerUserName") as HTMLButtonElement;
  btn.textContent = profile.displayName;
};

const startApp = async (teamId: string, profile: UserProfile, teamName: string): Promise<void> => {
  await setCurrentTeam(teamId);
  hideAllScreens();
  showApp();

  // Store context for memo and profile edit
  _currentTeamIdForMemo = teamId;
  _currentUidForMemo = profile.uid;

  const headerUserInfo = document.getElementById("headerUserInfo") as HTMLElement;
  headerUserInfo.hidden = false;
  updateHeaderUser(profile);
  (document.getElementById("headerTeamName") as HTMLElement).textContent = teamName;

  // Sync preferences.members with the actual Firebase team member display names.
  // This ensures the list is always up-to-date regardless of how members were added.
  try {
    const team = await getTeamById(teamId);
    if (team) {
      const memberProfiles = await getUsersByIds(team.memberIds);
      _teamMemberProfiles = memberProfiles;
      replaceMembers(memberProfiles.map((p) => p.displayName));
    }
  } catch { /* non-critical — preferences.members stays as-is */ }

  render();
};

document.getElementById("switchTeamBtn")?.addEventListener("click", goToTeamScreen);

// Profile edit via header name button
document.getElementById("headerUserName")?.addEventListener("click", () => {
  if (!_activeProfile) return;
  showProfileEditModal(_activeProfile, false, (updated) => {
    _activeProfile = updated;
    updateHeaderUser(updated);
  });
});

if (!isFirebaseConfigured) {
  // No Firebase config — legacy single-user mode (localStorage only)
  render();
} else {
  hideApp();
  initAuth(
    async (user) => {
      try {
        _activeUser = user;
        const profile = await ensureUserProfile(user);
        if (!profile) {
          // No account found — ask the user to confirm registration
          showRegisterPrompt(user.email ?? "", async () => {
            try {
              const newProfile = await createNewUserProfile(user);
              _activeProfile = newProfile;
              showProfileEditModal(newProfile, true, (updated) => {
                _activeProfile = updated;
                showTeamScreen(user, updated, (teamId, teamName) => {
                  startApp(teamId, updated, teamName);
                });
              });
            } catch (e) {
              console.error("Registration error:", e);
              showLoginScreen();
            }
          }, async () => {
            await signOut();
          });
          return;
        }
        _activeProfile = profile;
        showTeamScreen(user, profile, (teamId, teamName) => {
          startApp(teamId, profile, teamName);
        });
      } catch (e) {
        console.error("Auth error:", e);
        showLoginScreen();
      }
    },
    () => {
      _activeUser = null;
      _activeProfile = null;
      _currentTeamIdForMemo = null;
      _currentUidForMemo = null;
      hideApp();
      const headerUserInfo = document.getElementById("headerUserInfo");
      if (headerUserInfo) headerUserInfo.hidden = true;
      showLoginScreen();
    },
  );
}
