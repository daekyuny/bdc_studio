import { dom } from "./dom.js";
import { toShortDate } from "./utils.js";

export const drawChart = ({ dates, totalPoints, ideal, actual, todayIndex }) => {
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
    emptyText.setAttribute("fill", "#6b7080");
    emptyText.textContent = "Set sprint dates to see the chart.";
    dom.chart.appendChild(emptyText);
    return;
  }

  const nonNullActual = actual.filter((v) => v !== null);
  const maxValue = Math.max(totalPoints, ...nonNullActual, 1);
  const minValue = Math.min(0, ...nonNullActual);
  const range = maxValue - minValue;
  const plotWidth = width - padding * 2;
  const plotHeight = height - padding * 2;

  const toPoint = (value, index) => {
    const x = padding + plotWidth * (dates.length === 1 ? 0 : index / (dates.length - 1));
    const y = padding + plotHeight * (1 - (value - minValue) / range);
    return `${x},${y}`;
  };

  // Grid lines — 4 evenly spaced divisions from minValue to maxValue
  const grid = document.createElementNS("http://www.w3.org/2000/svg", "g");
  grid.setAttribute("stroke", "rgba(44, 47, 58, 0.1)");
  for (let i = 0; i <= 4; i++) {
    const y = padding + plotHeight * (i / 4);
    const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
    line.setAttribute("x1", padding);
    line.setAttribute("x2", width - padding);
    line.setAttribute("y1", y);
    line.setAttribute("y2", y);
    grid.appendChild(line);

    const label = document.createElementNS("http://www.w3.org/2000/svg", "text");
    label.setAttribute("x", 14);
    label.setAttribute("y", y + 4);
    label.setAttribute("fill", "#6b7080");
    label.setAttribute("font-size", "11");
    label.textContent = Math.round(maxValue - range * (i / 4));
    dom.chart.appendChild(label);
  }
  dom.chart.appendChild(grid);

  // Zero line (when chart extends below 0)
  if (minValue < 0) {
    const zeroY = padding + plotHeight * (1 - (0 - minValue) / range);
    const zeroLine = document.createElementNS("http://www.w3.org/2000/svg", "line");
    zeroLine.setAttribute("x1", padding);
    zeroLine.setAttribute("x2", width - padding);
    zeroLine.setAttribute("y1", zeroY);
    zeroLine.setAttribute("y2", zeroY);
    zeroLine.setAttribute("stroke", "rgba(44, 47, 58, 0.3)");
    zeroLine.setAttribute("stroke-width", "1.5");
    zeroLine.setAttribute("stroke-dasharray", "4 3");
    dom.chart.appendChild(zeroLine);
  }

  // Today marker
  if (todayIndex >= 0) {
    const tx = padding + plotWidth * (dates.length === 1 ? 0 : todayIndex / (dates.length - 1));
    const todayLine = document.createElementNS("http://www.w3.org/2000/svg", "line");
    todayLine.setAttribute("x1", tx);
    todayLine.setAttribute("x2", tx);
    todayLine.setAttribute("y1", padding);
    todayLine.setAttribute("y2", height - padding);
    todayLine.setAttribute("stroke", "rgba(92, 103, 242, 0.45)");
    todayLine.setAttribute("stroke-width", "1.5");
    todayLine.setAttribute("stroke-dasharray", "4 3");
    dom.chart.appendChild(todayLine);

    const todayLabel = document.createElementNS("http://www.w3.org/2000/svg", "text");
    todayLabel.setAttribute("x", tx + 4);
    todayLabel.setAttribute("y", padding + 12);
    todayLabel.setAttribute("fill", "rgba(92, 103, 242, 0.65)");
    todayLabel.setAttribute("font-size", "10");
    todayLabel.textContent = "Today";
    dom.chart.appendChild(todayLabel);
  }

  const idealLine = document.createElementNS("http://www.w3.org/2000/svg", "polyline");
  idealLine.setAttribute("fill", "none");
  idealLine.setAttribute("stroke", "#3b82f6");
  idealLine.setAttribute("stroke-width", "3");
  idealLine.setAttribute("points", ideal.map(toPoint).join(" "));
  dom.chart.appendChild(idealLine);

  const actualPoints = actual
    .map((val, i) => (val !== null ? toPoint(val, i) : null))
    .filter(Boolean);
  const actualLine = document.createElementNS("http://www.w3.org/2000/svg", "polyline");
  actualLine.setAttribute("fill", "none");
  actualLine.setAttribute("stroke", "#ef4444");
  actualLine.setAttribute("stroke-width", "3");
  actualLine.setAttribute("points", actualPoints.join(" "));
  actualLine.style.strokeDasharray = "1000";
  actualLine.style.strokeDashoffset = "1000";
  actualLine.style.animation = "dash 1.6s ease forwards";
  dom.chart.appendChild(actualLine);

  const labels = document.createElementNS("http://www.w3.org/2000/svg", "g");
  labels.setAttribute("font-size", "11");
  labels.setAttribute("fill", "#6b7080");

  const showDays = dom.showDayNumbers.checked;
  dates.forEach((date, index) => {
    const x = padding + plotWidth * (dates.length === 1 ? 0 : index / (dates.length - 1));
    const label = document.createElementNS("http://www.w3.org/2000/svg", "text");
    label.setAttribute("x", x);
    label.setAttribute("y", height - 18);
    label.setAttribute("text-anchor", "middle");
    label.textContent = showDays ? `D${index + 1}` : toShortDate(date);
    labels.appendChild(label);
  });
  dom.chart.appendChild(labels);
};
