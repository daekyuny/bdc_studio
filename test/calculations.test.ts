import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  localIso,
  todayIso,
  addDays,
  toShortDate,
  getWorkingDates,
  getNextWorkingDay,
  addWorkingDays,
  sprintsOverlap,
  findGaps,
  createId,
  formatSprintRange,
  statusOptions,
} from "../src/utils.ts";

import { calculateBurndown } from "../src/burndown.ts";
import type { Sprint } from "../src/types.ts";

// ---------------------------------------------------------------------------
// utils.ts
// ---------------------------------------------------------------------------

describe("localIso", () => {
  it("formats a date as YYYY-MM-DD using local time", () => {
    const d = new Date(2026, 0, 7); // Jan 7 2026 local
    assert.equal(localIso(d), "2026-01-07");
  });

  it("pads single-digit month and day", () => {
    const d = new Date(2026, 2, 3); // Mar 3
    assert.equal(localIso(d), "2026-03-03");
  });
});

describe("todayIso", () => {
  it("returns a valid YYYY-MM-DD string", () => {
    const result = todayIso();
    assert.match(result, /^\d{4}-\d{2}-\d{2}$/);
  });

  it("matches the current local date", () => {
    const now = new Date();
    const expected = localIso(now);
    assert.equal(todayIso(), expected);
  });
});

describe("addDays", () => {
  it("adds positive days", () => {
    assert.equal(addDays("2026-01-05", 3), "2026-01-08");
  });

  it("adds negative days", () => {
    assert.equal(addDays("2026-01-08", -3), "2026-01-05");
  });

  it("crosses month boundary", () => {
    assert.equal(addDays("2026-01-30", 3), "2026-02-02");
  });

  it("adding zero returns same date", () => {
    assert.equal(addDays("2026-01-15", 0), "2026-01-15");
  });
});

describe("toShortDate", () => {
  it("formats as MM/DD", () => {
    assert.equal(toShortDate("2026-01-07"), "01/07");
  });

  it("returns empty string for falsy input", () => {
    assert.equal(toShortDate(""), "");
    assert.equal(toShortDate(null), "");
    assert.equal(toShortDate(undefined), "");
  });
});

describe("formatSprintRange", () => {
  it("formats sprint date range", () => {
    const sprint = { startDate: "2026-01-05", endDate: "2026-01-16" };
    assert.equal(formatSprintRange(sprint), "01/05 \u2013 01/16");
  });
});

describe("statusOptions", () => {
  it("contains the three task statuses", () => {
    assert.deepEqual(statusOptions, ["Todo", "In Progress", "Done"]);
  });
});

describe("createId", () => {
  it("returns a valid UUID string", () => {
    const id = createId();
    assert.match(id, /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
  });

  it("returns unique values on successive calls", () => {
    const a = createId();
    const b = createId();
    assert.notEqual(a, b);
  });
});

// ---------------------------------------------------------------------------
// getWorkingDates
// ---------------------------------------------------------------------------

describe("getWorkingDates", () => {
  it("returns weekdays only for a Mon-Fri week", () => {
    const dates = getWorkingDates("2026-01-05", "2026-01-09");
    assert.deepEqual(dates, [
      "2026-01-05", "2026-01-06", "2026-01-07", "2026-01-08", "2026-01-09",
    ]);
  });

  it("skips weekends when spanning two weeks", () => {
    const dates = getWorkingDates("2026-01-05", "2026-01-16");
    assert.equal(dates.length, 10);
    assert.ok(!dates.includes("2026-01-10"));
    assert.ok(!dates.includes("2026-01-11"));
  });

  it("returns a single day when start equals end on a weekday", () => {
    const dates = getWorkingDates("2026-01-07", "2026-01-07");
    assert.deepEqual(dates, ["2026-01-07"]);
  });

  it("returns empty array when start equals end on a weekend", () => {
    const dates = getWorkingDates("2026-01-10", "2026-01-10");
    assert.deepEqual(dates, []);
  });

  it("returns empty array for empty inputs", () => {
    assert.deepEqual(getWorkingDates("", "2026-01-09"), []);
    assert.deepEqual(getWorkingDates("2026-01-05", ""), []);
    assert.deepEqual(getWorkingDates(null, null), []);
  });

  it("excludes holidays", () => {
    const holidays = new Set(["2026-01-07"]);
    const dates = getWorkingDates("2026-01-05", "2026-01-09", holidays);
    assert.equal(dates.length, 4);
    assert.ok(!dates.includes("2026-01-07"));
  });

  it("includes work-weekends", () => {
    const workWeekends = new Set(["2026-01-10"]);
    const dates = getWorkingDates("2026-01-05", "2026-01-12", undefined, workWeekends);
    assert.ok(dates.includes("2026-01-10"));
    assert.ok(!dates.includes("2026-01-11"));
  });

  it("returns empty when end is before start", () => {
    const dates = getWorkingDates("2026-01-09", "2026-01-05");
    assert.deepEqual(dates, []);
  });
});

// ---------------------------------------------------------------------------
// getNextWorkingDay
// ---------------------------------------------------------------------------

describe("getNextWorkingDay", () => {
  it("returns the next day when given a weekday (Mon-Thu)", () => {
    assert.equal(getNextWorkingDay("2026-01-07"), "2026-01-08");
  });

  it("skips weekend when given a Friday", () => {
    assert.equal(getNextWorkingDay("2026-01-09"), "2026-01-12");
  });

  it("skips to Monday when given Saturday", () => {
    assert.equal(getNextWorkingDay("2026-01-10"), "2026-01-12");
  });

  it("skips to Monday when given Sunday", () => {
    assert.equal(getNextWorkingDay("2026-01-11"), "2026-01-12");
  });

  it("skips holidays", () => {
    const holidays = new Set(["2026-01-08"]);
    assert.equal(getNextWorkingDay("2026-01-07", holidays), "2026-01-09");
  });

  it("skips consecutive holidays and weekends", () => {
    const holidays = new Set(["2026-01-08", "2026-01-09"]);
    assert.equal(getNextWorkingDay("2026-01-07", holidays), "2026-01-12");
  });

  it("returns work-weekend day if it falls next", () => {
    const workWeekends = new Set(["2026-01-10"]);
    assert.equal(getNextWorkingDay("2026-01-09", undefined, workWeekends), "2026-01-10");
  });
});

// ---------------------------------------------------------------------------
// addWorkingDays
// ---------------------------------------------------------------------------

describe("addWorkingDays", () => {
  it("adds working days within the same week", () => {
    assert.equal(addWorkingDays("2026-01-05", 3), "2026-01-08");
  });

  it("crosses a weekend", () => {
    assert.equal(addWorkingDays("2026-01-05", 5), "2026-01-12");
  });

  it("adds 10 working days (two weeks)", () => {
    assert.equal(addWorkingDays("2026-01-05", 10), "2026-01-19");
  });

  it("adding zero returns same date", () => {
    assert.equal(addWorkingDays("2026-01-07", 0), "2026-01-07");
  });

  it("skips holidays", () => {
    const holidays = new Set(["2026-01-07"]);
    assert.equal(addWorkingDays("2026-01-05", 3, holidays), "2026-01-09");
  });

  it("counts work-weekends", () => {
    const workWeekends = new Set(["2026-01-10"]);
    assert.equal(addWorkingDays("2026-01-05", 5, undefined, workWeekends), "2026-01-10");
  });
});

// ---------------------------------------------------------------------------
// sprintsOverlap
// ---------------------------------------------------------------------------

describe("sprintsOverlap", () => {
  it("detects overlapping sprints", () => {
    const a = { startDate: "2026-01-05", endDate: "2026-01-16" };
    const b = { startDate: "2026-01-12", endDate: "2026-01-23" };
    assert.equal(sprintsOverlap(a, b), true);
  });

  it("detects overlap in reverse order", () => {
    const a = { startDate: "2026-01-12", endDate: "2026-01-23" };
    const b = { startDate: "2026-01-05", endDate: "2026-01-16" };
    assert.equal(sprintsOverlap(a, b), true);
  });

  it("returns true when sprints share a single boundary date", () => {
    const a = { startDate: "2026-01-05", endDate: "2026-01-09" };
    const b = { startDate: "2026-01-09", endDate: "2026-01-16" };
    assert.equal(sprintsOverlap(a, b), true);
  });

  it("returns false for non-overlapping sprints", () => {
    const a = { startDate: "2026-01-05", endDate: "2026-01-09" };
    const b = { startDate: "2026-01-12", endDate: "2026-01-16" };
    assert.equal(sprintsOverlap(a, b), false);
  });

  it("returns true for identical date ranges", () => {
    const a = { startDate: "2026-01-05", endDate: "2026-01-09" };
    const b = { startDate: "2026-01-05", endDate: "2026-01-09" };
    assert.equal(sprintsOverlap(a, b), true);
  });

  it("detects when one sprint fully contains another", () => {
    const a = { startDate: "2026-01-05", endDate: "2026-01-23" };
    const b = { startDate: "2026-01-12", endDate: "2026-01-16" };
    assert.equal(sprintsOverlap(a, b), true);
  });
});

// ---------------------------------------------------------------------------
// findGaps
// ---------------------------------------------------------------------------

describe("findGaps", () => {
  it("returns empty array for a single sprint", () => {
    const sprints = [{ startDate: "2026-01-05", endDate: "2026-01-09" }];
    assert.deepEqual(findGaps(sprints), []);
  });

  it("returns empty array for empty list", () => {
    assert.deepEqual(findGaps([]), []);
  });

  it("finds no gaps when sprints are contiguous (next working day)", () => {
    const s1 = { startDate: "2026-01-05", endDate: "2026-01-09" };
    const s2 = { startDate: "2026-01-12", endDate: "2026-01-16" };
    assert.deepEqual(findGaps([s1, s2]), []);
  });

  it("detects a gap between sprints", () => {
    const s1 = { startDate: "2026-01-05", endDate: "2026-01-09" };
    const s2 = { startDate: "2026-01-14", endDate: "2026-01-16" };
    const gaps = findGaps([s1, s2]);
    assert.equal(gaps.length, 1);
    assert.equal(gaps[0].after, s1);
    assert.equal(gaps[0].before, s2);
  });

  it("detects multiple gaps", () => {
    const s1 = { startDate: "2026-01-05", endDate: "2026-01-07" };
    const s2 = { startDate: "2026-01-12", endDate: "2026-01-14" };
    const s3 = { startDate: "2026-01-19", endDate: "2026-01-23" };
    const gaps = findGaps([s1, s2, s3]);
    assert.equal(gaps.length, 2);
  });
});

// ---------------------------------------------------------------------------
// burndown.ts — calculateBurndown
// ---------------------------------------------------------------------------

describe("calculateBurndown", () => {
  const makeSprint = (overrides: Partial<Sprint> = {}): Sprint => ({
    id: "test-sprint",
    description: "",
    startDate: "2026-01-05",
    endDate: "2026-01-09",
    developers: 2,
    efficiency: 1,
    tasks: [],
    createdAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  });

  it("returns correct structure", () => {
    const result = calculateBurndown(makeSprint(), "2026-01-07");
    assert.ok(Array.isArray(result.dates));
    assert.ok(Array.isArray(result.ideal));
    assert.ok(Array.isArray(result.actual));
    assert.equal(typeof result.totalPoints, "number");
    assert.equal(typeof result.manDays, "number");
    assert.equal(typeof result.effectiveManDays, "number");
    assert.equal(typeof result.idealDailyBurn, "number");
    assert.equal(typeof result.todayIndex, "number");
  });

  it("computes correct working dates for sprint range", () => {
    const result = calculateBurndown(makeSprint(), "2026-01-07");
    // 5 working days Mon–Fri Jan 5–9; no extra day in dates array
    assert.equal(result.dates.length, 5);
    assert.equal(result.dates[0], "2026-01-05");
    assert.equal(result.dates[4], "2026-01-09");
    // ideal/actual arrays have N+1 = 6 borders
    assert.equal(result.ideal.length, 6);
    assert.equal(result.actual.length, 6);
  });

  it("handles zero tasks", () => {
    const result = calculateBurndown(makeSprint(), "2026-01-07");
    assert.equal(result.totalPoints, 0);
    result.ideal.forEach((v) => assert.equal(v, 0));
  });

  it("computes capacity metrics correctly", () => {
    const sprint = makeSprint({ developers: 3, efficiency: 0.8 });
    const result = calculateBurndown(sprint, "2026-01-05");
    assert.equal(result.manDays, 15);
    assert.equal(result.effectiveManDays, 12);
    assert.equal(result.idealDailyBurn, 2.4);
  });

  it("ideal line decreases linearly from totalPoints to near zero", () => {
    const tasks = [
      { id: "1", name: "a", estimate: 5, worked: 0, remain: 5, status: "Todo" as const, doneDate: "" },
      { id: "2", name: "b", estimate: 3, worked: 0, remain: 3, status: "Todo" as const, doneDate: "" },
      { id: "3", name: "c", estimate: 2, worked: 0, remain: 2, status: "Todo" as const, doneDate: "" },
    ];
    const sprint = makeSprint({ tasks, developers: 2, efficiency: 1 });
    const result = calculateBurndown(sprint, "2026-01-05");
    assert.equal(result.totalPoints, 10);
    assert.equal(result.ideal[0], 10);
    assert.equal(result.ideal[1], 8);
    assert.equal(result.ideal[2], 6);
    assert.equal(result.ideal[3], 4);
    assert.equal(result.ideal[4], 2);
    assert.equal(result.ideal[5], 0);
    for (let i = 1; i < result.ideal.length; i++) {
      assert.ok(result.ideal[i] <= result.ideal[i - 1]);
    }
  });

  it("actual line sums remain of undone tasks at each date", () => {
    const tasks = [
      { id: "1", name: "a", estimate: 5, worked: 5, remain: 0, status: "Done" as const, doneDate: "2026-01-05" },
      { id: "2", name: "b", estimate: 3, worked: 3, remain: 0, status: "Done" as const, doneDate: "2026-01-07" },
      { id: "3", name: "c", estimate: 2, worked: 0, remain: 2, status: "Todo" as const, doneDate: "" },
    ];
    const sprint = makeSprint({ tasks });
    const result = calculateBurndown(sprint, "2026-01-09");
    assert.equal(result.totalPoints, 10);
    // N+1 model: actual[0] = initialScope (sum of all estimates), actual[i+1] = remain at end of dates[i]
    assert.equal(result.actual[0], 10);  // initialScope = 5+3+2
    // task1 done on Jan5, task2 done on Jan7; task3 remain=2 throughout
    assert.equal(result.actual[1], 2);   // end of Jan5: task1 done→0, task2 remain=0, task3→2
    assert.equal(result.actual[2], 2);   // end of Jan6
    assert.equal(result.actual[3], 2);   // end of Jan7: task2 done→0, task3→2
    assert.equal(result.actual[4], 2);   // end of Jan8
    assert.equal(result.actual[5], 2);   // end of Jan9
  });

  it("actual line uses task.remain for in-progress tasks", () => {
    const tasks = [
      { id: "1", name: "a", estimate: 5, worked: 3, remain: 2, status: "In Progress" as const, doneDate: "" },
    ];
    const sprint = makeSprint({ tasks });
    const result = calculateBurndown(sprint, "2026-01-09");
    assert.equal(result.totalPoints, 5);
    // actual[0] = initialScope = estimate = 5 (before any work logged)
    assert.equal(result.actual[0], 5);
    // actual[1..] = task.remain = 2 (no remainLog, uses top-level remain)
    assert.equal(result.actual[1], 2);
  });

  it("actual line is null for days after today", () => {
    const sprint = makeSprint({
      tasks: [{ id: "1", name: "a", estimate: 5, worked: 0, remain: 5, status: "Todo" as const, doneDate: "" }],
    });
    const result = calculateBurndown(sprint, "2026-01-07");
    assert.equal(result.todayIndex, 2);
    // N+1 model: actual[0..todayIndex+1] are non-null (borders 0 through todayIndex+1)
    assert.notEqual(result.actual[0], null);
    assert.notEqual(result.actual[1], null);
    assert.notEqual(result.actual[2], null);
    assert.notEqual(result.actual[3], null);  // todayIndex+1 = 3 is also filled
    // actual[todayIndex+2..] are null
    assert.equal(result.actual[4], null);
    assert.equal(result.actual[5], null);
  });

  it("todayIndex is -1 when today is before sprint start", () => {
    const sprint = makeSprint({
      tasks: [{ id: "1", name: "a", estimate: 5, worked: 0, remain: 5, status: "Todo" as const, doneDate: "" }],
    });
    const result = calculateBurndown(sprint, "2026-01-02");
    assert.equal(result.todayIndex, -1);
    result.actual.forEach((v) => assert.equal(v, null));
  });

  it("all tasks done results in actual reaching zero", () => {
    const tasks = [
      { id: "1", name: "a", estimate: 3, worked: 3, remain: 0, status: "Done" as const, doneDate: "2026-01-05" },
      { id: "2", name: "b", estimate: 7, worked: 7, remain: 0, status: "Done" as const, doneDate: "2026-01-06" },
    ];
    const sprint = makeSprint({ tasks });
    const result = calculateBurndown(sprint, "2026-01-09");
    assert.equal(result.actual[1], 0);
    assert.equal(result.actual[4], 0);
  });

  it("handles zero developers", () => {
    const sprint = makeSprint({
      developers: 0,
      tasks: [{ id: "1", name: "a", estimate: 5, worked: 0, remain: 5, status: "Todo" as const, doneDate: "" }],
    });
    const result = calculateBurndown(sprint, "2026-01-07");
    assert.equal(result.manDays, 0);
    assert.equal(result.effectiveManDays, 0);
    assert.equal(result.idealDailyBurn, 0);
  });

  it("clamps efficiency to [0, 1]", () => {
    const sprint1 = makeSprint({ efficiency: 1.5 });
    const r1 = calculateBurndown(sprint1, "2026-01-07");
    assert.equal(r1.effectiveManDays, r1.manDays);

    const sprint2 = makeSprint({ efficiency: -0.5 });
    const r2 = calculateBurndown(sprint2, "2026-01-07");
    assert.equal(r2.effectiveManDays, 0);
  });

  it("respects holidays parameter", () => {
    const holidays = new Set(["2026-01-07", "2026-01-08"]);
    const sprint = makeSprint({
      tasks: [{ id: "1", name: "a", estimate: 6, worked: 0, remain: 6, status: "Todo" as const, doneDate: "" }],
    });
    const result = calculateBurndown(sprint, "2026-01-09", holidays);
    // 5 working days minus 2 holidays = 3 dates
    assert.equal(result.dates.length, 3);
    assert.ok(!result.dates.includes("2026-01-07"));
    assert.ok(!result.dates.includes("2026-01-08"));
  });
});
