import { dom } from "./dom.ts";
import { toShortDate } from "./utils.ts";
import type { BurndownData } from "./types.ts";

export const drawChart = (
  { dates, totalPoints, ideal, actual, scope, scopeDropMarkers, todayIndex }: BurndownData,
  onDateClick?: (date: string) => void,
  browseIndex?: number,
  showTodayLabel?: boolean,
): void => {
  const width = 800;
  const height = 320;
  const padding = 50;
  dom.chart.setAttribute("viewBox", `0 0 ${width} ${height}`);
  dom.chart.innerHTML = "";

  if (!dates.length) {
    const emptyText = document.createElementNS("http://www.w3.org/2000/svg", "text");
    emptyText.setAttribute("x", String(width / 2));
    emptyText.setAttribute("y", String(height / 2));
    emptyText.setAttribute("text-anchor", "middle");
    emptyText.setAttribute("fill", "#6b7080");
    emptyText.textContent = "Set sprint dates to see the chart.";
    dom.chart.appendChild(emptyText);
    return;
  }

  const nonNullActual = actual.filter((v): v is number => v !== null);
  const nonNullScope = scope.filter((v): v is number => v !== null);
  const maxValue = Math.max(totalPoints, ...nonNullActual, ...nonNullScope, 1);
  const minValue = Math.min(0, ...nonNullActual);
  const range = maxValue - minValue;
  const plotWidth = width - padding * 2;
  const plotHeight = height - padding * 2;

  // N bands (working days), N+1 borders. index 0..N maps to left..right edge.
  const N = dates.length;
  const toPoint = (value: number, index: number): string => {
    const x = padding + plotWidth * (N === 0 ? 0 : index / N);
    const y = padding + plotHeight * (1 - (value - minValue) / range);
    return `${x},${y}`;
  };

  // Grid lines — 4 evenly spaced divisions from minValue to maxValue
  const grid = document.createElementNS("http://www.w3.org/2000/svg", "g");
  grid.setAttribute("stroke", "rgba(44, 47, 58, 0.1)");
  for (let i = 0; i <= 4; i++) {
    const y = padding + plotHeight * (i / 4);
    const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
    line.setAttribute("x1", String(padding));
    line.setAttribute("x2", String(width - padding));
    line.setAttribute("y1", String(y));
    line.setAttribute("y2", String(y));
    grid.appendChild(line);

    const label = document.createElementNS("http://www.w3.org/2000/svg", "text");
    label.setAttribute("x", "14");
    label.setAttribute("y", String(y + 4));
    label.setAttribute("fill", "#6b7080");
    label.setAttribute("font-size", "11");
    label.textContent = String(Math.round(maxValue - range * (i / 4)));
    dom.chart.appendChild(label);
  }
  dom.chart.appendChild(grid);

  // Zero line (when chart extends below 0)
  if (minValue < 0) {
    const zeroY = padding + plotHeight * (1 - (0 - minValue) / range);
    const zeroLine = document.createElementNS("http://www.w3.org/2000/svg", "line");
    zeroLine.setAttribute("x1", String(padding));
    zeroLine.setAttribute("x2", String(width - padding));
    zeroLine.setAttribute("y1", String(zeroY));
    zeroLine.setAttribute("y2", String(zeroY));
    zeroLine.setAttribute("stroke", "rgba(44, 47, 58, 0.3)");
    zeroLine.setAttribute("stroke-width", "1.5");
    zeroLine.setAttribute("stroke-dasharray", "4 3");
    dom.chart.appendChild(zeroLine);
  }

  // Today band — shaded rectangle, only shown for the current sprint
  const effectiveBrowseIndex = browseIndex !== undefined ? browseIndex : todayIndex;
  if (showTodayLabel && todayIndex >= 0 && N > 0) {
    const txLeft  = padding + plotWidth * todayIndex / N;
    const txRight = padding + plotWidth * (todayIndex + 1) / N;
    const todayBand = document.createElementNS("http://www.w3.org/2000/svg", "rect");
    todayBand.setAttribute("x", String(txLeft));
    todayBand.setAttribute("y", String(padding));
    todayBand.setAttribute("width", String(txRight - txLeft));
    todayBand.setAttribute("height", String(plotHeight));
    todayBand.setAttribute("fill", "rgba(92, 103, 242, 0.07)");
    dom.chart.appendChild(todayBand);

    if (showTodayLabel) {
      const todayLabel = document.createElementNS("http://www.w3.org/2000/svg", "text");
      todayLabel.setAttribute("x", String((txLeft + txRight) / 2));
      todayLabel.setAttribute("y", String(padding + 12));
      todayLabel.setAttribute("text-anchor", "middle");
      todayLabel.setAttribute("fill", "rgba(92, 103, 242, 0.65)");
      todayLabel.setAttribute("font-size", "10");
      todayLabel.textContent = "Today";
      dom.chart.appendChild(todayLabel);
    }
  }

  // Browse marker — vertical line at the right border of the browsed day's band.
  // For the current sprint, suppress when browse == today (today band already shows it).
  // For other sprints, always show when a date is selected.
  if (effectiveBrowseIndex >= 0 && N > 0 && (!showTodayLabel || effectiveBrowseIndex !== todayIndex)) {
    const bx = padding + plotWidth * (effectiveBrowseIndex + 1) / N;
    const browseLine = document.createElementNS("http://www.w3.org/2000/svg", "line");
    browseLine.setAttribute("x1", String(bx));
    browseLine.setAttribute("x2", String(bx));
    browseLine.setAttribute("y1", String(padding));
    browseLine.setAttribute("y2", String(height - padding));
    browseLine.setAttribute("stroke", "rgba(107, 114, 128, 0.5)");
    browseLine.setAttribute("stroke-width", "1.5");
    browseLine.setAttribute("stroke-dasharray", "4 3");
    dom.chart.appendChild(browseLine);
  }

  const idealLine = document.createElementNS("http://www.w3.org/2000/svg", "polyline");
  idealLine.setAttribute("fill", "none");
  idealLine.setAttribute("stroke", "#3b82f6");
  idealLine.setAttribute("stroke-width", "1.5");
  idealLine.setAttribute("points", ideal.map(toPoint).join(" "));
  dom.chart.appendChild(idealLine);

  // Ideal line dots
  ideal.forEach((val, i) => {
    const [cx, cy] = toPoint(val, i).split(",");
    const dot = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    dot.setAttribute("cx", cx);
    dot.setAttribute("cy", cy);
    dot.setAttribute("r", "3");
    dot.setAttribute("fill", "#3b82f6");
    dom.chart.appendChild(dot);
  });

  // Scope line — sum(worked + remain) per day, plotted up to today
  const scopePoints = scope
    .map((val, i) => (val !== null ? toPoint(val, i) : null))
    .filter((v): v is string => v !== null);
  if (scopePoints.length) {
    const scopeLine = document.createElementNS("http://www.w3.org/2000/svg", "polyline");
    scopeLine.setAttribute("fill", "none");
    scopeLine.setAttribute("stroke", "#10b981");
    scopeLine.setAttribute("stroke-width", "1.5");
    scopeLine.setAttribute("stroke-dasharray", "5 3");
    scopeLine.setAttribute("points", scopePoints.join(" "));
    dom.chart.appendChild(scopeLine);

    const dropDateIndices = new Set(scopeDropMarkers.map(m => m.dateIndex));
    scope.forEach((val, i) => {
      if (val === null) return;
      if (dropDateIndices.has(i)) return; // triangle marker drawn below
      const [cx, cy] = toPoint(val, i).split(",");
      const dot = document.createElementNS("http://www.w3.org/2000/svg", "circle");
      dot.setAttribute("cx", cx);
      dot.setAttribute("cy", cy);
      dot.setAttribute("r", "3");
      dot.setAttribute("fill", "#10b981");
      dom.chart.appendChild(dot);
    });

    // Scope drop markers — downward triangle with tooltip
    for (const marker of scopeDropMarkers) {
      const val = scope[marker.dateIndex];
      if (val === null) continue;
      const [cxStr, cyStr] = toPoint(val, marker.dateIndex).split(",");
      const cx = Number(cxStr);
      const cy = Number(cyStr);
      const tri = document.createElementNS("http://www.w3.org/2000/svg", "polygon");
      tri.setAttribute("points", `${cx - 6},${cy - 4} ${cx + 6},${cy - 4} ${cx},${cy + 5}`);
      tri.setAttribute("fill", "#f59e0b");
      tri.setAttribute("stroke", "white");
      tri.setAttribute("stroke-width", "1");
      const title = document.createElementNS("http://www.w3.org/2000/svg", "title");
      title.textContent = `Scope drop:\n${marker.label}`;
      tri.appendChild(title);
      dom.chart.appendChild(tri);
    }
  }

  const actualPoints = actual
    .map((val, i) => (val !== null ? toPoint(val, i) : null))
    .filter((v): v is string => v !== null);
  const actualLine = document.createElementNS("http://www.w3.org/2000/svg", "polyline");
  actualLine.setAttribute("fill", "none");
  actualLine.setAttribute("stroke", "#ef4444");
  actualLine.setAttribute("stroke-width", "1.5");
  actualLine.setAttribute("points", actualPoints.join(" "));
  actualLine.style.strokeDasharray = "1000";
  actualLine.style.strokeDashoffset = "1000";
  actualLine.style.animation = "dash 1.6s ease forwards";
  dom.chart.appendChild(actualLine);

  // Actual line dots
  actual.forEach((val, i) => {
    if (val === null) return;
    const [cx, cy] = toPoint(val, i).split(",");
    const dot = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    dot.setAttribute("cx", cx);
    dot.setAttribute("cy", cy);
    dot.setAttribute("r", "3");
    dot.setAttribute("fill", "#ef4444");
    dom.chart.appendChild(dot);
  });

  const labels = document.createElementNS("http://www.w3.org/2000/svg", "g");
  labels.setAttribute("font-size", "11");
  labels.setAttribute("fill", "#6b7080");

  const showDays = dom.showDayNumbers.checked;
  dates.forEach((date, index) => {
    // Labels sit at the midpoint of each band
    const x = padding + plotWidth * (N === 0 ? 0 : (index + 0.5) / N);
    const isToday = index === todayIndex;
    const isBrowse = index === effectiveBrowseIndex && effectiveBrowseIndex !== todayIndex;

    const label = document.createElementNS("http://www.w3.org/2000/svg", "text");
    label.setAttribute("x", String(x));
    label.setAttribute("y", String(height - 18));
    label.setAttribute("text-anchor", "middle");
    label.setAttribute("fill", isToday ? "rgba(92, 103, 242, 0.85)" : isBrowse ? "rgba(107, 114, 128, 0.9)" : "#6b7080");
    if (isToday) label.setAttribute("font-weight", "bold");
    if (isBrowse) label.setAttribute("font-weight", "600");
    label.textContent = showDays ? `D${index + 1}` : toShortDate(date);

    if (onDateClick) {
      label.style.cursor = "pointer";
      label.addEventListener("click", () => onDateClick(date));
    }

    labels.appendChild(label);
  });
  dom.chart.appendChild(labels);
};
