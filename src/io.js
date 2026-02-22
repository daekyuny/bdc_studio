import { getState, getActiveSprint, replaceState } from "./state.js";
import { todayIso } from "./utils.js";

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

export const exportCsv = () => {
  const sprint = getActiveSprint();
  if (!sprint) return;
  const state = getState();
  const sprintNumber = state.sprints.findIndex((s) => s.id === sprint.id) + 1;

  const escape = (val) => `"${String(val ?? "").replace(/"/g, '""')}"`;
  const rows = [
    ["Task", "Days", "Status", "Done Date"].join(","),
    ...sprint.tasks.map((t) =>
      [escape(t.name), t.points, escape(t.status), escape(t.doneDate || "")].join(",")
    ),
  ];

  const blob = new Blob([rows.join("\r\n")], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `sprint-${sprintNumber}-tasks-${todayIso()}.csv`;
  a.click();
  URL.revokeObjectURL(url);
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
      replaceState(imported);
    } catch {
      alert("Failed to parse file. Please select a valid JSON export.");
    }
  };
  reader.readAsText(file);
};
