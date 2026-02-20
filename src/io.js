import { getState, replaceState } from "./state.js";
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
