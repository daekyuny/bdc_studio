import { dom } from "./dom.js";
import { setOnStateChange, addSprint, deleteActiveSprint, updateSprint, addTask, updateToday } from "./state.js";
import { render } from "./render.js";
import { exportData, importData } from "./io.js";

setOnStateChange(render);

dom.newSprintBtn.addEventListener("click", addSprint);
dom.deleteSprintBtn.addEventListener("click", deleteActiveSprint);
dom.addTaskBtn.addEventListener("click", addTask);
dom.exportBtn.addEventListener("click", exportData);
dom.importBtn.addEventListener("click", () => dom.importFile.click());
dom.importFile.addEventListener("change", (e) => {
  if (e.target.files[0]) importData(e.target.files[0]);
  e.target.value = "";
});

const commitSprintName = () => updateSprint({ name: dom.sprintName.value });
const commitStartDate = () => updateSprint({ startDate: dom.startDate.value });
const commitEndDate = () => updateSprint({ endDate: dom.endDate.value });
const commitDevelopers = () => updateSprint({ developers: Number(dom.developers.value) });
const commitEfficiency = () => updateSprint({ efficiency: Number(dom.efficiency.value) });

dom.sprintName.addEventListener("change", commitSprintName);
dom.sprintName.addEventListener("blur", commitSprintName);
dom.sprintName.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    event.preventDefault();
    commitSprintName();
    dom.sprintName.blur();
  }
});

dom.startDate.addEventListener("change", commitStartDate);
dom.endDate.addEventListener("change", commitEndDate);
dom.developers.addEventListener("change", commitDevelopers);
dom.efficiency.addEventListener("change", commitEfficiency);

dom.developers.addEventListener("blur", commitDevelopers);
dom.efficiency.addEventListener("blur", commitEfficiency);

dom.developers.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    event.preventDefault();
    commitDevelopers();
    dom.developers.blur();
  }
});
dom.efficiency.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    event.preventDefault();
    commitEfficiency();
    dom.efficiency.blur();
  }
});
const commitToday = () => updateToday(dom.sprintToday.value);
dom.sprintToday.addEventListener("change", commitToday);

dom.showDayNumbers.addEventListener("change", render);

render();
