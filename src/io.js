import { getState, getActiveSprint, replaceState, getBacklog, replaceBacklog } from "./state.js";
import { todayIso, createId } from "./utils.js";

export const exportData = () => {
  const state = getState();
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `burndown-studio-${todayIso()}.json`;
  a.click();
  URL.revokeObjectURL(url);
};

// XLSX is loaded globally from CDN (xlsx.full.min.js)
export const exportSprintExcel = () => {
  const sprint = getActiveSprint();
  if (!sprint) return;
  const state = getState();
  const sprintNumber = state.sprints.findIndex((s) => s.id === sprint.id) + 1;

  const aoa = [
    ["Task ID", "Task", "Estimate", "Actual", "Status", "Done Date"],
    ...sprint.tasks.map((t) => [t.taskId || "", t.name, t.estimate ?? "", t.actual ?? "", t.status, t.doneDate || ""]),
  ];
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, `Sprint ${sprintNumber}`);
  XLSX.writeFile(wb, `sprint-${sprintNumber}-tasks-${todayIso()}.xlsx`);
};

const migrateImported = (imported) => {
  if (!imported.backlog) imported.backlog = { stories: [] };
  for (const sprint of imported.sprints) {
    for (const task of sprint.tasks) {
      if (task.points !== undefined && task.estimate === undefined) {
        task.estimate = task.points;
        task.actual = null;
        delete task.points;
      }
    }
  }
  return imported;
};

export const importData = (file) => {
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const imported = JSON.parse(e.target.result);
      if (!imported || !Array.isArray(imported.sprints)) {
        alert("Invalid file: expected a Burndown Studio JSON export.");
        return;
      }
      const confirmImport = window.confirm(
        `Import ${imported.sprints.length} sprint(s)? This will replace all current data.`
      );
      if (!confirmImport) return;
      if (!imported.activeSprintId && imported.sprints.length > 0) {
        imported.activeSprintId = imported.sprints[0].id;
      }
      replaceState(migrateImported(imported));
    } catch {
      alert("Failed to parse file. Please select a valid JSON export.");
    }
  };
  reader.readAsText(file);
};

export const exportBacklogExcel = () => {
  const backlog = getBacklog();
  const aoa = [
    ["Story ID", "User Stories", "Priority", "Task ID", "Task Description", "Estimate(days)", "Assigned To"],
  ];
  for (const story of backlog.stories) {
    if (story.tasks.length === 0) {
      aoa.push([story.storyId, story.description, story.priority ?? 100, "", "", "", ""]);
    } else {
      story.tasks.forEach((task, i) => {
        if (i === 0) {
          aoa.push([story.storyId, story.description, story.priority ?? 100, task.taskId, task.description, task.estimate, task.assignedTo]);
        } else {
          aoa.push(["", "", "", task.taskId, task.description, task.estimate, task.assignedTo]);
        }
      });
    }
  }
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Backlog");
  XLSX.writeFile(wb, `backlog-${todayIso()}.xlsx`);
};

// XLSX is loaded globally from CDN (xlsx.full.min.js)
export const importBacklogExcel = (file) => {
  const reader = new FileReader();
  reader.onload = (e) => {
    const data = new Uint8Array(e.target.result);
    let workbook;
    try {
      workbook = XLSX.read(data, { type: "array" });
    } catch {
      alert("Failed to read file. Please select a valid Excel (.xlsx/.xls) file.");
      return;
    }
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    // raw: false → all values as strings; defval: "" → empty cells as ""
    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false, defval: "" });

    if (rows.length < 2) { alert("File is empty or has no data rows."); return; }

    const stories = [];
    let currentStory = null;

    for (let i = 1; i < rows.length; i++) {
      const cols = rows[i];
      // Skip completely empty rows
      if (cols.every(c => String(c ?? "").trim() === "")) continue;

      const storyId    = String(cols[0] ?? "").trim();
      const storyDesc  = String(cols[1] ?? "").trim();
      const priorityRaw = parseInt(String(cols[2] ?? "").trim(), 10);
      const priority   = isNaN(priorityRaw) ? 100 : Math.max(0, priorityRaw);
      const taskId     = String(cols[3] ?? "").trim();
      const taskDesc   = String(cols[4] ?? "").trim();
      const estimateRaw = parseFloat(String(cols[5] ?? ""));
      const estimate   = isNaN(estimateRaw) ? 0 : estimateRaw;
      const assignedTo = String(cols[6] ?? "").trim();

      if (storyId) {
        currentStory = { id: createId(), storyId, description: storyDesc, priority, tasks: [] };
        stories.push(currentStory);
      }
      if (taskId && currentStory) {
        currentStory.tasks.push({ id: createId(), taskId, description: taskDesc, estimate, assignedTo });
      }
    }

    if (stories.length === 0) {
      alert("No stories found. Check that the file format matches:\nStory ID | User Stories | Priority | Task ID | Task Description | Time Estimate (days) | Assigned To");
      return;
    }

    const existing = getBacklog();
    const hasExisting = existing?.stories?.length > 0;
    const warning = hasExisting
      ? `Warning: This will permanently replace all ${existing.stories.length} existing story/stories with ${stories.length} imported story/stories.\n\nThis cannot be undone. Proceed?`
      : `Import ${stories.length} story/stories into the backlog?`;
    if (!window.confirm(warning)) return;
    replaceBacklog({ stories });
  };
  reader.readAsArrayBuffer(file);
};
