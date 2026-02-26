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
} from "../src/utils.js";

import { calculateBurndown } from "../src/burndown.js";

// ---------------------------------------------------------------------------
// utils.js
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
    // 2026-01-05 Mon .. 2026-01-09 Fri
    const dates = getWorkingDates("2026-01-05", "2026-01-09");
    assert.deepEqual(dates, [
      "2026-01-05", "2026-01-06", "2026-01-07", "2026-01-08", "2026-01-09",
    ]);
  });

  it("skips weekends when spanning two weeks", () => {
    // Mon 5 .. Fri 16 (two full weeks)
    const dates = getWorkingDates("2026-01-05", "2026-01-16");
    assert.equal(dates.length, 10); // 5 + 5
    assert.ok(!dates.includes("2026-01-10")); // Sat
    assert.ok(!dates.includes("2026-01-11")); // Sun
  });

  it("returns a single day when start equals end on a weekday", () => {
    const dates = getWorkingDates("2026-01-07", "2026-01-07"); // Wed
    assert.deepEqual(dates, ["2026-01-07"]);
  });

  it("returns empty array when start equals end on a weekend", () => {
    const dates = getWorkingDates("2026-01-10", "2026-01-10"); // Sat
    assert.deepEqual(dates, []);
  });

  it("returns empty array for empty inputs", () => {
    assert.deepEqual(getWorkingDates("", "2026-01-09"), []);
    assert.deepEqual(getWorkingDates("2026-01-05", ""), []);
    assert.deepEqual(getWorkingDates(null, null), []);
  });

  it("excludes holidays", () => {
    const holidays = new Set(["2026-01-07"]); // Wed
    const dates = getWorkingDates("2026-01-05", "2026-01-09", holidays);
    assert.equal(dates.length, 4);
    assert.ok(!dates.includes("2026-01-07"));
  });

  it("includes work-weekends", () => {
    const workWeekends = new Set(["2026-01-10"]); // Sat
    const dates = getWorkingDates("2026-01-05", "2026-01-12", undefined, workWeekends);
    assert.ok(dates.includes("2026-01-10"));
    assert.ok(!dates.includes("2026-01-11")); // Sun not in workWeekends
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
    // Wed -> Thu
    assert.equal(getNextWorkingDay("2026-01-07"), "2026-01-08");
  });

  it("skips weekend when given a Friday", () => {
    // Fri -> Mon
    assert.equal(getNextWorkingDay("2026-01-09"), "2026-01-12");
  });

  it("skips to Monday when given Saturday", () => {
    assert.equal(getNextWorkingDay("2026-01-10"), "2026-01-12");
  });

  it("skips to Monday when given Sunday", () => {
    assert.equal(getNextWorkingDay("2026-01-11"), "2026-01-12");
  });

  it("skips holidays", () => {
    const holidays = new Set(["2026-01-08"]); // Thu is holiday
    // Wed -> skip Thu -> Fri
    assert.equal(getNextWorkingDay("2026-01-07", holidays), "2026-01-09");
  });

  it("skips consecutive holidays and weekends", () => {
    // Thu is holiday, Fri is holiday -> skip Sat/Sun -> Mon
    const holidays = new Set(["2026-01-08", "2026-01-09"]);
    assert.equal(getNextWorkingDay("2026-01-07", holidays), "2026-01-12");
  });

  it("returns work-weekend day if it falls next", () => {
    // Fri -> Sat (which is a work weekend)
    const workWeekends = new Set(["2026-01-10"]);
    assert.equal(getNextWorkingDay("2026-01-09", undefined, workWeekends), "2026-01-10");
  });
});

// ---------------------------------------------------------------------------
// addWorkingDays
// ---------------------------------------------------------------------------

describe("addWorkingDays", () => {
  it("adds working days within the same week", () => {
    // Mon + 3 working days = Thu
    assert.equal(addWorkingDays("2026-01-05", 3), "2026-01-08");
  });

  it("crosses a weekend", () => {
    // Mon + 5 working days = Mon (next week)
    assert.equal(addWorkingDays("2026-01-05", 5), "2026-01-12");
  });

  it("adds 10 working days (two weeks)", () => {
    // Mon Jan 5 + 10 working days = Fri Jan 16
    assert.equal(addWorkingDays("2026-01-05", 10), "2026-01-19");
  });

  it("adding zero returns next calendar day that is a working day — no, returns same date logic", () => {
    // n=0 means the while loop never executes, so d stays at startDate
    // Actually: d starts as the input, loop runs 0 times, returns localIso(d) = same date
    assert.equal(addWorkingDays("2026-01-07", 0), "2026-01-07");
  });

  it("skips holidays", () => {
    const holidays = new Set(["2026-01-07"]); // Wed
    // Mon + 3 = skip Wed -> Fri
    assert.equal(addWorkingDays("2026-01-05", 3, holidays), "2026-01-09");
  });

  it("counts work-weekends", () => {
    const workWeekends = new Set(["2026-01-10"]); // Sat
    // Mon + 5 = Mon..Fri (5 days) but Sat counts too, so 5 working days ends on Sat
    // Actually: Mon(1) Tue(2) Wed(3) Thu(4) Fri(5) — reaches 5 on Fri, returns Fri
    // Wait, workWeekends only adds Sat as a working day, it doesn't change when Fri is reached.
    // 5 working days from Mon: Tue(1), Wed(2), Thu(3), Fri(4), Sat-is-workday(5) = Sat
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
    // Sprint 1: Mon-Fri, Sprint 2 starts next Mon
    const s1 = { startDate: "2026-01-05", endDate: "2026-01-09" };
    const s2 = { startDate: "2026-01-12", endDate: "2026-01-16" };
    assert.deepEqual(findGaps([s1, s2]), []);
  });

  it("detects a gap between sprints", () => {
    // Sprint 1 ends Fri Jan 9, Sprint 2 starts Wed Jan 14 (gap: Mon-Tue)
    const s1 = { startDate: "2026-01-05", endDate: "2026-01-09" };
    const s2 = { startDate: "2026-01-14", endDate: "2026-01-16" };
    const gaps = findGaps([s1, s2]);
    assert.equal(gaps.length, 1);
    assert.equal(gaps[0].after, s1);
    assert.equal(gaps[0].before, s2);
  });

  it("detects multiple gaps", () => {
    const s1 = { startDate: "2026-01-05", endDate: "2026-01-07" }; // Mon-Wed
    const s2 = { startDate: "2026-01-12", endDate: "2026-01-14" }; // Mon-Wed (gap: Thu-Fri)
    const s3 = { startDate: "2026-01-19", endDate: "2026-01-23" }; // Mon-Fri (gap: Thu-Fri)
    const gaps = findGaps([s1, s2, s3]);
    assert.equal(gaps.length, 2);
  });
});

// ---------------------------------------------------------------------------
// burndown.js — calculateBurndown
// ---------------------------------------------------------------------------

describe("calculateBurndown", () => {
  // Helper to build a minimal sprint object
  const makeSprint = (overrides = {}) => ({
    startDate: "2026-01-05",  // Mon
    endDate: "2026-01-09",    // Fri (5 working days)
    developers: 2,
    efficiency: 1,
    tasks: [],
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

  it("computes correct dates including extra day after sprint end", () => {
    const result = calculateBurndown(makeSprint(), "2026-01-07");
    // 5 working days (Mon-Fri) + 1 extra day (next Mon)
    assert.equal(result.dates.length, 6);
    assert.equal(result.dates[0], "2026-01-05");
    assert.equal(result.dates[4], "2026-01-09");
    assert.equal(result.dates[5], "2026-01-12"); // extra day = next Mon
  });

  it("handles zero tasks", () => {
    const result = calculateBurndown(makeSprint(), "2026-01-07");
    assert.equal(result.totalPoints, 0);
    result.ideal.forEach((v) => assert.equal(v, 0));
  });

  it("computes capacity metrics correctly", () => {
    const sprint = makeSprint({ developers: 3, efficiency: 0.8 });
    const result = calculateBurndown(sprint, "2026-01-05");
    // 5 working days * 3 developers = 15 man-days
    assert.equal(result.manDays, 15);
    // 15 * 0.8 = 12 effective man-days
    assert.equal(result.effectiveManDays, 12);
    // 12 / 5 = 2.4 ideal daily burn
    assert.equal(result.idealDailyBurn, 2.4);
  });

  it("ideal line decreases linearly from totalPoints to near zero", () => {
    const tasks = [
      { estimate: 5, status: "Todo" },
      { estimate: 3, status: "Todo" },
      { estimate: 2, status: "Todo" },
    ];
    const sprint = makeSprint({ tasks, developers: 2, efficiency: 1 });
    const result = calculateBurndown(sprint, "2026-01-05");
    // totalPoints = 10, idealDailyBurn = 2*5*1/5 = 2
    assert.equal(result.totalPoints, 10);
    assert.equal(result.ideal[0], 10);     // day 0: 10 - 2*0 = 10
    assert.equal(result.ideal[1], 8);      // day 1: 10 - 2*1 = 8
    assert.equal(result.ideal[2], 6);      // day 2
    assert.equal(result.ideal[3], 4);      // day 3
    assert.equal(result.ideal[4], 2);      // day 4
    assert.equal(result.ideal[5], 0);      // day 5 (extra day)
    // Ensure monotonically decreasing
    for (let i = 1; i < result.ideal.length; i++) {
      assert.ok(result.ideal[i] <= result.ideal[i - 1]);
    }
  });

  it("actual line reflects done tasks by their doneDate", () => {
    const tasks = [
      { estimate: 5, status: "Done", doneDate: "2026-01-05" },  // done day 1
      { estimate: 3, status: "Done", doneDate: "2026-01-07" },  // done day 3
      { estimate: 2, status: "Todo" },
    ];
    const sprint = makeSprint({ tasks });
    const result = calculateBurndown(sprint, "2026-01-09"); // today = Fri
    // totalPoints = 10
    assert.equal(result.totalPoints, 10);
    // Day 0 (Mon 5): task1 done on this date, burned=5, actual=10-5=5
    assert.equal(result.actual[0], 5);
    // Day 1 (Tue 6): still only task1 done, actual=5
    assert.equal(result.actual[1], 5);
    // Day 2 (Wed 7): task1+task2 done, burned=8, actual=2
    assert.equal(result.actual[2], 2);
    // Day 3 (Thu 8): same, actual=2
    assert.equal(result.actual[3], 2);
    // Day 4 (Fri 9): same, actual=2
    assert.equal(result.actual[4], 2);
  });

  it("actual line uses task.actual when available instead of estimate", () => {
    const tasks = [
      { estimate: 5, actual: 3, status: "Done", doneDate: "2026-01-05" },
    ];
    const sprint = makeSprint({ tasks });
    const result = calculateBurndown(sprint, "2026-01-09");
    // totalPoints = 5 (based on estimate)
    assert.equal(result.totalPoints, 5);
    // burned = 3 (actual), so remaining = 5 - 3 = 2
    assert.equal(result.actual[0], 2);
  });

  it("actual line is null for days after today", () => {
    const sprint = makeSprint({
      tasks: [{ estimate: 5, status: "Todo" }],
    });
    const result = calculateBurndown(sprint, "2026-01-07"); // Wed
    // todayIndex should be 2 (Wed is 3rd working day, index 2)
    assert.equal(result.todayIndex, 2);
    // Days 0-2 should have values, days 3+ should be null
    assert.notEqual(result.actual[0], null);
    assert.notEqual(result.actual[1], null);
    assert.notEqual(result.actual[2], null);
    assert.equal(result.actual[3], null);
    assert.equal(result.actual[4], null);
    assert.equal(result.actual[5], null);
  });

  it("todayIndex is -1 when today is before sprint start", () => {
    const sprint = makeSprint({
      tasks: [{ estimate: 5, status: "Todo" }],
    });
    const result = calculateBurndown(sprint, "2026-01-02"); // before sprint
    assert.equal(result.todayIndex, -1);
    result.actual.forEach((v) => assert.equal(v, null));
  });

  it("all tasks done results in actual reaching zero", () => {
    const tasks = [
      { estimate: 3, status: "Done", doneDate: "2026-01-05" },
      { estimate: 7, status: "Done", doneDate: "2026-01-06" },
    ];
    const sprint = makeSprint({ tasks });
    const result = calculateBurndown(sprint, "2026-01-09");
    // By day index 1 (Tue), all burned, actual = 10 - 10 = 0
    assert.equal(result.actual[1], 0);
    // Should stay at 0
    assert.equal(result.actual[4], 0);
  });

  it("handles zero developers", () => {
    const sprint = makeSprint({
      developers: 0,
      tasks: [{ estimate: 5, status: "Todo" }],
    });
    const result = calculateBurndown(sprint, "2026-01-07");
    assert.equal(result.manDays, 0);
    assert.equal(result.effectiveManDays, 0);
    assert.equal(result.idealDailyBurn, 0);
  });

  it("clamps efficiency to [0, 1]", () => {
    const sprint1 = makeSprint({ efficiency: 1.5 });
    const r1 = calculateBurndown(sprint1, "2026-01-07");
    assert.equal(r1.effectiveManDays, r1.manDays); // efficiency clamped to 1

    const sprint2 = makeSprint({ efficiency: -0.5 });
    const r2 = calculateBurndown(sprint2, "2026-01-07");
    assert.equal(r2.effectiveManDays, 0); // efficiency clamped to 0
  });

  it("respects holidays parameter", () => {
    const holidays = new Set(["2026-01-07", "2026-01-08"]); // Wed, Thu
    const sprint = makeSprint({
      tasks: [{ estimate: 6, status: "Todo" }],
    });
    const result = calculateBurndown(sprint, "2026-01-09", holidays);
    // Working days: Mon, Tue, Fri = 3 days + 1 extra (Mon) = 4 dates
    assert.equal(result.dates.length, 4);
    assert.ok(!result.dates.includes("2026-01-07"));
    assert.ok(!result.dates.includes("2026-01-08"));
  });
});
