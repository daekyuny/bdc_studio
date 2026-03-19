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
  getMemberPairs,
  replaceMembers,
  setMemberPairs,
  setCurrentTeam,
} from "./state.ts";
import { render, setActiveTab, startEditing, expandAll, collapseAll, toggleTaskSort, toggleBacklogSort, setHighlightBacklogTaskId, togglePlanTaskSort, togglePlanBacklogSort } from "./render.ts";
import { H_CHART } from "./state.ts";
import { exportData, exportSprintExcel, importData, exportBacklogExcel, importBacklogExcel } from "./io.ts";
import { getNextWorkingDay, addWorkingDays, findGaps, todayIso, getWorkingDates, localIso } from "./utils.ts";
import type { Sprint } from "./types.ts";
import { isFirebaseConfigured, functions, DECLINE_INVITATION_URL } from "./firebase.ts";
import { httpsCallable } from "firebase/functions";
import { initAuth, ensureUserProfile, createNewUserProfile, createAccountWithEmail, signOut, type User } from "./auth.ts";
import { showLandingPage, showTeamScreen, showAdminScreen, showGroupScreen, showCreateGroupScreen, hideAllScreens, showProfileEditModal, avatarSrc, showPhotoPopup } from "./screens.ts";
import { getUserMemo, saveUserMemo, getTeamById, getUsersByIds, getUserProfile, getUserProfileByEmail, getGroupByOwner, getInvitation, updateUserProfile, getPmRequest, getApprovedPmRequestByEmail, createGroup, linkExistingTeamsToGroup, getPreregistrationByEmail } from "./db.ts";
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
  const memberCount = getMemberPairs().length;
  if (memberCount > 0) {
    dom.modalDevelopers.max = String(memberCount);
  } else {
    dom.modalDevelopers.removeAttribute("max");
  }
  dom.modalDevelopers.value = String(memberCount || 1);
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
  const memberCount = getMemberPairs().length;
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

  const _gapPrefs = getPreferences();
  const gaps = findGaps(
    getState().sprints,
    new Set(_gapPrefs.holidays.map((h) => h.date)),
    new Set(_gapPrefs.workWeekends),
  );
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
  const defaultDevelopers = getMemberPairs().length || 1;
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
        ${p
          ? `<img id="memberPopupAvatar" class="member-profile-popup-avatar-img" style="width:48px;height:48px;border-radius:50%;object-fit:cover;flex-shrink:0" />`
          : `<span class="member-profile-popup-avatar">${Array.from(name)[0]?.toUpperCase() ?? "?"}</span>`
        }
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
  if (p) {
    const img = document.getElementById("memberPopupAvatar") as HTMLImageElement | null;
    if (img) {
      img.src = avatarSrc(p, 48);
      img.style.cursor = "pointer";
      img.addEventListener("click", () => {
        if (p.photoFull) showPhotoPopup(p.photoFull);
        else if (p.photoThumb) showPhotoPopup(p.photoThumb);
        else showPhotoPopup(avatarSrc(p, 200));
      });
    }
  }
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

// ---------------------------------------------------------------------------
// SM inactivity timeout — auto-logout after 10 minutes of no activity
// ---------------------------------------------------------------------------
const SM_TIMEOUT_MS = 10 * 60 * 1000;   // 10 minutes
const SM_WARN_MS   =  9 * 60 * 1000;    //  9 minutes (1-minute warning)

let _smTimeoutId: ReturnType<typeof setTimeout> | null = null;
let _smWarnId:    ReturnType<typeof setTimeout> | null = null;
let _smWarnEl:    HTMLElement | null = null;
let _smActivityHandler: (() => void) | null = null;

const _dismissSmWarn = (): void => {
  _smWarnEl?.remove();
  _smWarnEl = null;
};

const _showSmWarn = (): void => {
  _dismissSmWarn();
  const el = document.createElement("div");
  el.id = "smTimeoutWarn";
  el.style.cssText = [
    "position:fixed", "bottom:24px", "left:50%", "transform:translateX(-50%)",
    "background:#b91c1c", "color:#fff", "padding:12px 24px", "border-radius:8px",
    "font-size:14px", "font-weight:600", "z-index:99999",
    "box-shadow:0 4px 16px rgba(0,0,0,0.4)", "pointer-events:none",
  ].join(";");
  el.textContent = "Session expiring in 1 minute due to inactivity.";
  document.body.appendChild(el);
  _smWarnEl = el;
};

const _clearSmTimers = (): void => {
  if (_smTimeoutId !== null) { clearTimeout(_smTimeoutId); _smTimeoutId = null; }
  if (_smWarnId    !== null) { clearTimeout(_smWarnId);    _smWarnId    = null; }
  _dismissSmWarn();
};

const _resetSmTimer = (): void => {
  _clearSmTimers();
  _smWarnId    = setTimeout(_showSmWarn,                   SM_WARN_MS);
  _smTimeoutId = setTimeout(() => { void signOut(); }, SM_TIMEOUT_MS);
};

const SM_ACTIVITY_EVENTS = ["mousemove", "mousedown", "keydown", "touchstart", "scroll"] as const;

const startSmInactivityTimer = (): void => {
  // Avoid double-registering listeners if called more than once
  stopSmInactivityTimer();
  _smActivityHandler = (): void => _resetSmTimer();
  for (const ev of SM_ACTIVITY_EVENTS) {
    document.addEventListener(ev, _smActivityHandler, { passive: true });
  }
  _resetSmTimer();
};

const stopSmInactivityTimer = (): void => {
  _clearSmTimers();
  if (_smActivityHandler) {
    for (const ev of SM_ACTIVITY_EVENTS) {
      document.removeEventListener(ev, _smActivityHandler);
    }
    _smActivityHandler = null;
  }
};

const goToTeamScreen = (): void => {
  if (!_activeUser || !_activeProfile) return;
  hideApp();
  if (_activeProfile.role === "super_manager") {
    showAdminScreen(_activeProfile);
    startSmInactivityTimer();
    return;
  }
  if (_activeProfile.role === "product_manager") {
    const user = _activeUser;
    const profile = _activeProfile;
    void getGroupByOwner(profile.uid).then((group) => {
      if (!group) {
        showCreateGroupScreen(user, profile, `${profile.displayName}'s Group`, (newGroup) => {
          showGroupScreen(user, profile, newGroup, (teamId, teamName) => {
            startApp(teamId, profile, teamName);
          });
        });
      } else {
        showGroupScreen(user, profile, group, (teamId, teamName) => {
          startApp(teamId, profile, teamName);
        });
      }
    });
    return;
  }
  showTeamScreen(_activeUser, _activeProfile, (teamId, teamName) => {
    startApp(teamId, _activeProfile!, teamName);
  }, (updated) => { _activeProfile = updated; });
};

const updateHeaderUser = (profile: UserProfile): void => {
  const avatarEl = document.getElementById("headerUserAvatar") as HTMLImageElement | null;
  const nameEl = document.getElementById("headerUserNameText");
  if (avatarEl) avatarEl.src = avatarSrc(profile, 24);
  if (nameEl) nameEl.textContent = profile.displayName;
};

const startApp = async (teamId: string, profile: UserProfile, teamName: string): Promise<void> => {
  // Fetch member profiles and sync preferences.members BEFORE setCurrentTeam so that
  // (a) the Firestore load preserves the correct display names, and
  // (b) the echo-suppression window is already open when the first snapshot arrives.
  // Always clear stale member pairs first so old cached data (including PM) never leaks through
  setMemberPairs([]);
  try {
    const team = await getTeamById(teamId);
    if (team) {
      // Use allSettled so a single failed profile fetch doesn't abort the whole list
      const results = await Promise.allSettled(team.memberIds.map((uid) => getUserProfile(uid)));
      const memberProfiles = results
        .filter((r): r is PromiseFulfilledResult<UserProfile> => r.status === "fulfilled" && r.value !== null)
        .map((r) => r.value as UserProfile);
      _teamMemberProfiles = memberProfiles;
      const assignableProfiles = memberProfiles.filter((p) => p.role === "member");
      setMemberPairs(assignableProfiles.map((p) => ({ email: p.email, name: p.displayName })));
      replaceMembers(assignableProfiles.map((p) => p.displayName));
    }
  } catch { /* non-critical — member list stays empty */ }

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

  render();
};

document.getElementById("switchTeamBtn")?.addEventListener("click", goToTeamScreen);

// Profile edit via header name button
document.getElementById("headerUserName")?.addEventListener("click", () => {
  if (!_activeProfile) return;
  showProfileEditModal(_activeProfile, false, (updated) => {
    _activeProfile = updated;
    updateHeaderUser(updated);
  }, _activeUser ?? undefined);
});

// ---------------------------------------------------------------------------
// URL parameter handling (invite accept/decline, PM approval)
// ---------------------------------------------------------------------------

// Helper used in decline flow
const getContainer = (): HTMLElement => {
  let el = document.getElementById("screen-overlays");
  if (!el) {
    el = document.createElement("div");
    el.id = "screen-overlays";
    document.body.appendChild(el);
  }
  return el;
};

if (isFirebaseConfigured) {
  const params = new URLSearchParams(window.location.search);
  const inviteId = params.get("invite");
  const inviteAction = params.get("action");
  const pmApprovedId = params.get("pm_approved");

  if (inviteId && inviteAction === "decline") {
    // Decline path — no auth needed: POST to the public Cloud Function
    window.history.replaceState({}, "", "/");
    hideApp();
    getContainer().innerHTML = `<div class="screen-overlay"><div class="screen-card login-card"><p>Declining invitation…</p></div></div>`;
    fetch(DECLINE_INVITATION_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ inviteId }),
    })
      .then(() => {
        getContainer().innerHTML = `<div class="screen-overlay"><div class="screen-card login-card"><h2>Invitation Declined</h2><p class="screen-subtitle">You have declined the invitation. You can close this page.</p></div></div>`;
      })
      .catch(() => {
        getContainer().innerHTML = `<div class="screen-overlay"><div class="screen-card login-card"><p class="screen-error">Failed to decline invitation. Please try again.</p></div></div>`;
      });
  } else {
    if (inviteId && inviteAction === "accept") {
      sessionStorage.setItem("pendingInvite", inviteId);
      window.history.replaceState({}, "", "/");
    }
    if (pmApprovedId) {
      sessionStorage.setItem("pendingPmApproved", pmApprovedId);
      window.history.replaceState({}, "", "/");
    }
  }
}

if (!isFirebaseConfigured) {
  // No Firebase config — legacy single-user mode (localStorage only)
  render();
} else {
  hideApp();
  initAuth(
    async (user) => {
      try {
        _activeUser = user;

        // --- Handle pending invite acceptance ---
        const pendingInvite = sessionStorage.getItem("pendingInvite");
        if (pendingInvite) {
          const invitation = await getInvitation(pendingInvite);
          if (invitation && invitation.status === "pending") {
            // Email mismatch — wrong user is signed in; sign out so the
            // landing page shows the invitation registration form
            if (user.email !== invitation.email) {
              await signOut();
              return;
            }
            sessionStorage.removeItem("pendingInvite");
            let profile = await ensureUserProfile(user);
            if (!profile) {
              // Guard: check if a profile already exists for this email under a different uid
              // (happens when Firebase "multiple accounts per email" is on and user registered twice)
              const existingByEmail = await getUserProfileByEmail(user.email ?? "");
              if (existingByEmail) {
                sessionStorage.setItem("loginError", "This email is already registered under a different sign-in method. Please sign in with your original account (e.g. Google).");
                await signOut();
                return;
              }
              const newProfile = await createNewUserProfile(user);
              _activeProfile = newProfile;
              // Show profile edit, then accept invite
              await new Promise<void>((resolve) => {
                showProfileEditModal(newProfile, true, async (updated) => {
                  _activeProfile = updated;
                  resolve();
                }, user);
              });
              profile = _activeProfile;
            } else {
              _activeProfile = profile;
            }
            if (profile) {
              // Single Cloud Function call — Admin SDK handles all writes atomically:
              // marks invitation accepted, sets groupId, adds to team(s).
              // This avoids the Firestore rule that blocks client-side team updates.
              const acceptInv = httpsCallable<{ inviteId: string }, { teamId: string | null; teamName: string | null }>(functions, "acceptInvitation");
              await acceptInv({ inviteId: pendingInvite });
              _activeProfile = { ...profile, groupId: invitation.groupId };
              showTeamScreen(user, _activeProfile, (teamId, teamName) => {
                startApp(teamId, _activeProfile!, teamName);
              }, (updated) => { _activeProfile = updated; });
            }
            return;
          }
          // Invite not found, already used, or expired — clear and fall through
          sessionStorage.removeItem("pendingInvite");
        }

        // --- Handle PM approval registration ---
        const pendingPmApproved = sessionStorage.getItem("pendingPmApproved");
        if (pendingPmApproved) {
          sessionStorage.removeItem("pendingPmApproved");
          try {
            const pmReq = await getPmRequest(pendingPmApproved);
            if (pmReq && pmReq.status === "approved" && pmReq.email === user.email) {
              let profile = await ensureUserProfile(user);
              if (!profile) {
                // Guard: check if a profile already exists for this email under a different uid
                const existingByEmail = await getUserProfileByEmail(user.email ?? "");
                if (existingByEmail) {
                  sessionStorage.setItem("loginError", "This email is already registered under a different sign-in method. Please sign in with your original account (e.g. Google).");
                  await signOut();
                  return;
                }
                const newProfile = await createNewUserProfile(user);
                _activeProfile = { ...newProfile, role: "product_manager" };
                await updateUserProfile(newProfile.uid, { role: "product_manager" } as Parameters<typeof updateUserProfile>[1]);
                profile = _activeProfile;
              } else if (profile.role === "member") {
                await updateUserProfile(profile.uid, { role: "product_manager" } as Parameters<typeof updateUserProfile>[1]);
                profile = { ...profile, role: "product_manager" };
                _activeProfile = profile;
              } else {
                _activeProfile = profile;
              }
              if (profile) {
                const groupId = await createGroup(pmReq.groupName, profile.uid);
                await linkExistingTeamsToGroup(profile.uid, groupId);
                const group = { id: groupId, name: pmReq.groupName, ownerId: profile.uid, createdAt: new Date().toISOString() };
                showGroupScreen(user, _activeProfile!, group, (teamId, teamName) => {
                  startApp(teamId, _activeProfile!, teamName);
                });
              }
              return;
            }
            // email mismatch or not approved — fall through to normal login
          } catch (e) {
            console.warn("PM approval flow failed, falling through to normal login:", e);
            // fall through to normal login
          }
        }

        // --- Normal login flow ---
        let profile = await ensureUserProfile(user);
        if (!profile) {
          // Check for an approved PM request (new user whose request was approved)
          const pmReqNew = await getApprovedPmRequestByEmail(user.email ?? "").catch(() => null);
          if (pmReqNew) {
            const existingByEmail = await getUserProfileByEmail(user.email ?? "");
            if (existingByEmail) {
              sessionStorage.setItem("loginError", "This email is already registered under a different sign-in method. Please sign in with your original account.");
              await signOut();
              return;
            }
            const newProfile = await createNewUserProfile(user);
            await updateUserProfile(newProfile.uid, { role: "product_manager" } as Parameters<typeof updateUserProfile>[1]);
            profile = { ...newProfile, role: "product_manager" };
          } else {
            // Check for a pending pre-registration before rejecting
            const prereg = await getPreregistrationByEmail(user.email ?? "");
            if (prereg) {
              const existingByEmail = await getUserProfileByEmail(user.email ?? "");
              if (existingByEmail) {
                sessionStorage.setItem("loginError", "This email is already registered under a different sign-in method. Please sign in with your original account.");
                await signOut();
                return;
              }
              const newProfile = await createNewUserProfile(user);
              _activeProfile = newProfile;
              // Let the student set their display name before joining
              await new Promise<void>((resolve) => {
                showProfileEditModal(newProfile, true, async (updated) => {
                  _activeProfile = updated;
                  resolve();
                }, user);
              });
              const claimFn = httpsCallable<{ preregId: string }, { teamId: string | null; teamName: string | null }>(functions, "claimPreregistration");
              await claimFn({ preregId: prereg.id });
              _activeProfile = { ..._activeProfile!, groupId: prereg.groupId };
              showTeamScreen(user, _activeProfile!, (teamId, teamName) => {
                startApp(teamId, _activeProfile!, teamName);
              }, (updated) => { _activeProfile = updated; });
              return;
            }
            // No pre-registration found — truly unregistered
            sessionStorage.setItem("loginError", "No account found. Please use your invitation link to register.");
            await signOut();
            return;
          }
        }
        // Auto-promote existing member with an approved PM request
        if (profile.role === "member") {
          const pmReq = await getApprovedPmRequestByEmail(profile.email).catch(() => null);
          if (pmReq) {
            await updateUserProfile(profile.uid, { role: "product_manager" } as Parameters<typeof updateUserProfile>[1]);
            profile = { ...profile, role: "product_manager" };
          }
        }
        _activeProfile = profile;
        if (profile.role === "super_manager") {
          showAdminScreen(profile);
          startSmInactivityTimer();
          return;
        }
        if (profile.role === "product_manager") {
          const group = await getGroupByOwner(profile.uid);
          if (!group) {
            const pmReq = await getApprovedPmRequestByEmail(profile.email).catch(() => null);
            const defaultGroupName = pmReq?.groupName ?? `${profile.displayName}'s Group`;
            showCreateGroupScreen(user, profile, defaultGroupName, (newGroup) => {
              showGroupScreen(user, profile, newGroup, (teamId, teamName) => {
                startApp(teamId, profile, teamName);
              });
            });
          } else {
            showGroupScreen(user, profile, group, (teamId, teamName) => {
              startApp(teamId, profile, teamName);
            });
          }
          return;
        }
        showTeamScreen(user, profile, (teamId, teamName) => {
          startApp(teamId, profile, teamName);
        }, (updated) => { _activeProfile = updated; });
      } catch (e) {
        console.error("Auth error:", e);
        showLandingPage();
      }
    },
    () => {
      _activeUser = null;
      _activeProfile = null;
      _currentTeamIdForMemo = null;
      _currentUidForMemo = null;
      stopSmInactivityTimer();
      hideApp();
      const headerUserInfo = document.getElementById("headerUserInfo");
      if (headerUserInfo) headerUserInfo.hidden = true;
      showLandingPage();
    },
  );
}
