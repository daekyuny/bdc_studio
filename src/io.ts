import { getState, getActiveSprint, replaceState, getBacklog, addMembersFromImport, applyBacklogMerge, getMemberPairs, emailToName } from "./state.ts";
import { todayIso } from "./utils.ts";
import { showImportConfirm } from "./modals.ts";
import { planBacklogMerge } from "./backlogMerge.ts";
import type { ParsedBacklogRow } from "./backlogMerge.ts";
import type { AppState } from "./types.ts";

export const exportData = (): void => {
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
export const exportSprintExcel = (): void => {
  const sprint = getActiveSprint();
  if (!sprint) return;
  const state = getState();
  const sprintNumber = state.sprints.findIndex((s) => s.id === sprint.id) + 1;

  const aoa: unknown[][] = [
    ["Task ID", "Task", "Estimate", "Worked", "Remain", "Actual/Est", "Status", "Done Date"],
    ...sprint.tasks.map((t) => [
      t.taskId || "", t.name, t.estimate ?? "",
      t.worked ?? 0, t.remain ?? t.estimate ?? 0,
      (t.worked ?? 0) + (t.remain ?? t.estimate ?? 0),
      t.status, t.doneDate || "",
    ]),
  ];
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, `Sprint ${sprintNumber}`);
  XLSX.writeFile(wb, `sprint-${sprintNumber}-tasks-${todayIso()}.xlsx`);
};

const migrateImported = (imported: any): AppState => {
  if (!imported.backlog) imported.backlog = { stories: [] };
  for (const sprint of imported.sprints) {
    for (const task of sprint.tasks) {
      if (task.points !== undefined && task.estimate === undefined) {
        task.estimate = task.points;
        delete task.points;
      }
      if (task.worked === undefined) {
        const old = task.actual ?? null;
        if (task.status === 'Done') {
          task.worked = old != null ? old : (task.estimate ?? 0);
          task.remain = 0;
        } else {
          task.worked = 0;
          task.remain = task.estimate ?? 0;
        }
        delete task.actual;
      }
      if (!task.remainLog) task.remainLog = [];
      if (!task.workedLog) task.workedLog = [];
    }
  }
  return imported as AppState;
};

export const importData = (file: File): void => {
  const reader = new FileReader();
  reader.onload = async (e) => {
    try {
      const imported = JSON.parse((e.target as FileReader).result as string);
      if (!imported || !Array.isArray(imported.sprints)) {
        alert("Invalid file: expected a Burndown Studio JSON export.");
        return;
      }
      const ok = await showImportConfirm({
        title: "\u26A0 Import Sprint Data",
        message: `Import <strong>${imported.sprints.length}</strong> sprint(s)? This will replace all current data.`,
        subtext: "This action cannot be undone.",
        okLabel: "Import",
      });
      if (!ok) return;
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

export const exportBacklogExcel = (): void => {
  const backlog = getBacklog();
  const aoa: unknown[][] = [
    ["Story ID", "User Stories", "Priority", "Task ID", "Task Description", "Estimate(days)", "Assigned To"],
  ];
  for (const story of backlog.stories) {
    if (story.tasks.length === 0) {
      aoa.push([story.storyId, story.description, story.priority ?? 100, "", "", "", ""]);
    } else {
      story.tasks.forEach((task, i) => {
        if (i === 0) {
          aoa.push([story.storyId, story.description, story.priority ?? 100, task.taskId, task.description, task.estimate, task.assignedTo.join(", ")]);
        } else {
          aoa.push(["", "", "", task.taskId, task.description, task.estimate, task.assignedTo.join(", ")]);
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
export const importBacklogExcel = (file: File): void => {
  const reader = new FileReader();
  reader.onload = async (e) => {
    const data = new Uint8Array((e.target as FileReader).result as ArrayBuffer);
    let workbook: ReturnType<typeof XLSX.read>;
    try {
      workbook = XLSX.read(data, { type: "array" });
    } catch {
      alert("Failed to read file. Please select a valid Excel (.xlsx/.xls) file.");
      return;
    }
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false, defval: "" });

    if (rows.length < 2) { alert("File is empty or has no data rows."); return; }

    const parsedRows: ParsedBacklogRow[] = [];
    for (let i = 1; i < rows.length; i++) {
      const cols = rows[i] as string[];
      if (cols.every((c) => String(c ?? "").trim() === "")) continue;

      const storyId = String(cols[0] ?? "").trim();
      const storyDesc = String(cols[1] ?? "").trim();
      const priorityRaw = parseInt(String(cols[2] ?? "").trim(), 10);
      const priority = isNaN(priorityRaw) ? 100 : Math.max(0, priorityRaw);
      const taskId = String(cols[3] ?? "").trim();
      const taskDesc = String(cols[4] ?? "").trim();
      const estimateRaw = parseFloat(String(cols[5] ?? ""));
      const estimate = isNaN(estimateRaw) ? 0 : estimateRaw;
      const assignedToRaw = String(cols[6] ?? "").trim();
      const assignedTo = assignedToRaw ? assignedToRaw.split(",").map((s) => s.trim()).filter(Boolean) : [];

      parsedRows.push({ storyId, storyDesc, priority, taskId, taskDesc, estimate, assignedTo });
    }

    if (parsedRows.length === 0) {
      alert("No data rows found. Check that the file format matches:\nStory ID | User Stories | Priority | Task ID | Task Description | Time Estimate (days) | Assigned To");
      return;
    }

    const teamEmails = getMemberPairs().map((p) => p.email);
    const plan = planBacklogMerge(parsedRows, getBacklog(), getState().sprints, teamEmails);

    const totalNewTasks =
      plan.addStories.reduce((n, s) => n + s.tasks.length, 0) + plan.addTasks.length;

    const lines: string[] = [];
    if (plan.addStories.length > 0 || totalNewTasks > 0) {
      lines.push(
        `Will add <strong>${plan.addStories.length}</strong> story/stories and <strong>${totalNewTasks}</strong> task(s).`,
      );
    }
    if (plan.updateTasks.length > 0) {
      lines.push(`Will update <strong>${plan.updateTasks.length}</strong> existing task(s).`);
    }
    if (plan.skipInSprint > 0) {
      lines.push(`Skipping <strong>${plan.skipInSprint}</strong> task(s) already used in a sprint.`);
    }
    if (plan.skipNoParent > 0) {
      lines.push(`Skipping <strong>${plan.skipNoParent}</strong> task(s) with no matching parent story.`);
    }
    if (plan.droppedEmails.length > 0) {
      lines.push(
        `Ignoring <strong>${plan.droppedEmails.length}</strong> unknown email(s): ${plan.droppedEmails.join(", ")}`,
      );
    }
    if (lines.length === 0) {
      alert("Nothing to import — all rows match the existing backlog with no changes.");
      return;
    }

    const ok = await showImportConfirm({
      title: "\u26A0 Import Backlog (Merge)",
      message: lines.join("<br>"),
      okLabel: "Import",
    });
    if (!ok) return;

    applyBacklogMerge(plan);

    const uniqueNames = [...new Set(plan.acceptedEmails)].map(emailToName);
    if (uniqueNames.length > 0) addMembersFromImport(uniqueNames);
  };
  reader.readAsArrayBuffer(file);
};
