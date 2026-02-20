import { dom } from "./dom.js";
import { toShortDate } from "./utils.js";

export const drawChart = ({ dates, totalPoints, ideal, actual }) => {
  const width = 800;
  const height = 320;
  const padding = 50;
  dom.chart.setAttribute("viewBox", `0 0 ${width} ${height}`);
  dom.chart.innerHTML = "";

  if (!dates.length) {
    const emptyText = document.createElementNS("http://www.w3.org/2000/svg", "text");
    emptyText.setAttribute("x", width / 2);
    emptyText.setAttribute("y", height / 2);
    emptyText.setAttribute("text-anchor", "middle");
    emptyText.setAttribute("fill", "#6d6458");
    emptyText.textContent = "Set sprint dates to see the chart.";
    dom.chart.appendChild(emptyText);
    return;
  }

  const maxValue = Math.max(totalPoints, ...actual, 1);
  const plotWidth = width - padding * 2;
  const plotHeight = height - padding * 2;

  const toPoint = (value, index) => {
    const x = padding + (plotWidth * (dates.length === 1 ? 0 : index / (dates.length - 1)));
    const y = padding + (plotHeight * (1 - value / maxValue));
    return `${x},${y}`;
  };

  const grid = document.createElementNS("http://www.w3.org/2000/svg", "g");
  grid.setAttribute("stroke", "rgba(43, 42, 42, 0.12)");
  for (let i = 0; i <= 4; i++) {
    const y = padding + (plotHeight * (i / 4));
    const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
    line.setAttribute("x1", padding);
    line.setAttribute("x2", width - padding);
    line.setAttribute("y1", y);
    line.setAttribute("y2", y);
    grid.appendChild(line);

    const label = document.createElementNS("http://www.w3.org/2000/svg", "text");
    label.setAttribute("x", 14);
    label.setAttribute("y", y + 4);
    label.setAttribute("fill", "#6d6458");
    label.setAttribute("font-size", "11");
    label.textContent = Math.round(maxValue * (1 - i / 4));
    dom.chart.appendChild(label);
  }
  dom.chart.appendChild(grid);

  const idealLine = document.createElementNS("http://www.w3.org/2000/svg", "polyline");
  idealLine.setAttribute("fill", "none");
  idealLine.setAttribute("stroke", "#2a9d57");
  idealLine.setAttribute("stroke-width", "3");
  idealLine.setAttribute("points", ideal.map(toPoint).join(" "));
  dom.chart.appendChild(idealLine);

  const actualLine = document.createElementNS("http://www.w3.org/2000/svg", "polyline");
  actualLine.setAttribute("fill", "none");
  actualLine.setAttribute("stroke", "#3d405b");
  actualLine.setAttribute("stroke-width", "3");
  actualLine.setAttribute("points", actual.map(toPoint).join(" "));
  actualLine.style.strokeDasharray = "1000";
  actualLine.style.strokeDashoffset = "1000";
  actualLine.style.animation = "dash 1.6s ease forwards";
  dom.chart.appendChild(actualLine);

  const labels = document.createElementNS("http://www.w3.org/2000/svg", "g");
  labels.setAttribute("font-size", "11");
  labels.setAttribute("fill", "#6d6458");

  const showDays = dom.showDayNumbers.checked;
  dates.forEach((date, index) => {
    const x = padding + (plotWidth * (dates.length === 1 ? 0 : index / (dates.length - 1)));
    const label = document.createElementNS("http://www.w3.org/2000/svg", "text");
    label.setAttribute("x", x);
    label.setAttribute("y", height - 18);
    label.setAttribute("text-anchor", "middle");
    label.textContent = showDays ? `D${index + 1}` : toShortDate(date);
    labels.appendChild(label);
  });
  dom.chart.appendChild(labels);
};
