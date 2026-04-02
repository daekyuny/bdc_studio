import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  getAssignedEmails,
  buildMemberActivityData,
  buildVelocityData,
} from "../src/dashboard.ts";
import type { Sprint } from "../src/types.ts";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const makeSprint = (overrides: Partial<Sprint> & { id?: string } = {}): Sprint => ({
  id: overrides.id ?? "s1",
  description: "",
  startDate: "2026-01-05",
  endDate: "2026-01-09",
  developers: 2,
  efficiency: 1,
  tasks: [],
  createdAt: "2026-01-01T00:00:00.000Z",
  ...overrides,
});

const makeTask = (
  id: string,
  estimate: number,
  worked: number,
  remain: number,
  status: "Todo" | "In Progress" | "Done" = "Todo",
  assignedTo?: string,
) => ({
  id,
  name: `Task ${id}`,
  estimate,
  worked,
  remain,
  status,
  doneDate: status === "Done" ? "2026-01-07" : "",
  assignedTo,
});

// ---------------------------------------------------------------------------
// getAssignedEmails
// ---------------------------------------------------------------------------

describe("getAssignedEmails", () => {
  it("returns [] for undefined", () => {
    assert.deepEqual(getAssignedEmails(undefined), []);
  });

  it("returns [] for empty string", () => {
    assert.deepEqual(getAssignedEmails(""), []);
  });

  it("returns [] for whitespace-only string", () => {
    assert.deepEqual(getAssignedEmails("   "), []);
  });

  it("returns single email", () => {
    assert.deepEqual(getAssignedEmails("a@b.com"), ["a@b.com"]);
  });

  it("returns two emails", () => {
    assert.deepEqual(getAssignedEmails("a@b.com, c@d.com"), ["a@b.com", "c@d.com"]);
  });

  it("trims surrounding whitespace from each email", () => {
    assert.deepEqual(getAssignedEmails(" a@b.com , c@d.com "), ["a@b.com", "c@d.com"]);
  });

  it("filters out blank segments from double commas", () => {
    assert.deepEqual(getAssignedEmails("a@b.com,,c@d.com"), ["a@b.com", "c@d.com"]);
  });
});

// ---------------------------------------------------------------------------
// buildMemberActivityData
// ---------------------------------------------------------------------------

describe("buildMemberActivityData", () => {
  it("returns empty rows for empty sprints", () => {
    const result = buildMemberActivityData([], "2026-01-07");
    assert.deepEqual(result, { rows: [], allEmails: [] });
  });

  it("returns a row for a sprint with no tasks", () => {
    const sprint = makeSprint();
    const { rows, allEmails } = buildMemberActivityData([sprint], "2026-01-07");
    assert.equal(rows.length, 1);
    assert.equal(rows[0].sprintLabel, "Sprint 1");
    assert.deepEqual(rows[0].totals, { assigned: 0, worked: 0, remain: 0 });
    assert.deepEqual(allEmails, []);
  });

  it("computes stats for a single task assigned to one member", () => {
    const sprint = makeSprint({
      tasks: [makeTask("t1", 5, 3, 2, "In Progress", "alice@co.com")],
    });
    const { rows, allEmails } = buildMemberActivityData([sprint], "2026-01-07");
    assert.deepEqual(allEmails, ["alice@co.com"]);
    assert.deepEqual(rows[0].memberStats["alice@co.com"], { assigned: 5, worked: 3, remain: 2 });
    assert.deepEqual(rows[0].totals, { assigned: 5, worked: 3, remain: 2 });
  });

  it("gives full credit to both members when task is shared", () => {
    const sprint = makeSprint({
      tasks: [makeTask("t1", 6, 4, 2, "In Progress", "alice@co.com, bob@co.com")],
    });
    const { rows, allEmails } = buildMemberActivityData([sprint], "2026-01-07");
    assert.deepEqual(allEmails, ["alice@co.com", "bob@co.com"]);
    assert.deepEqual(rows[0].memberStats["alice@co.com"], { assigned: 6, worked: 4, remain: 2 });
    assert.deepEqual(rows[0].memberStats["bob@co.com"],   { assigned: 6, worked: 4, remain: 2 });
    // totals = actual task values (not doubled)
    assert.deepEqual(rows[0].totals, { assigned: 6, worked: 4, remain: 2 });
  });

  it("task with no assignedTo does not add any member entry", () => {
    const sprint = makeSprint({
      tasks: [makeTask("t1", 3, 1, 2, "In Progress", undefined)],
    });
    const { rows, allEmails } = buildMemberActivityData([sprint], "2026-01-07");
    assert.deepEqual(allEmails, []);
    assert.deepEqual(Object.keys(rows[0].memberStats), []);
    assert.deepEqual(rows[0].totals, { assigned: 3, worked: 1, remain: 2 });
  });

  it("accumulates stats across multiple tasks for the same member", () => {
    const sprint = makeSprint({
      tasks: [
        makeTask("t1", 3, 2, 1, "In Progress", "alice@co.com"),
        makeTask("t2", 5, 4, 1, "In Progress", "alice@co.com"),
      ],
    });
    const { rows } = buildMemberActivityData([sprint], "2026-01-07");
    assert.deepEqual(rows[0].memberStats["alice@co.com"], { assigned: 8, worked: 6, remain: 2 });
  });

  it("produces one row per sprint sorted by startDate", () => {
    const s1 = makeSprint({ id: "s1", startDate: "2026-02-02", endDate: "2026-02-06" });
    const s2 = makeSprint({ id: "s2", startDate: "2026-01-05", endDate: "2026-01-09" });
    const { rows } = buildMemberActivityData([s1, s2], "2026-01-07");
    assert.equal(rows[0].sprintId, "s2");
    assert.equal(rows[0].sprintLabel, "Sprint 1");
    assert.equal(rows[1].sprintId, "s1");
    assert.equal(rows[1].sprintLabel, "Sprint 2");
  });

  it("member appears once in allEmails even across multiple sprints", () => {
    const s1 = makeSprint({ id: "s1", startDate: "2026-01-05", endDate: "2026-01-09",
      tasks: [makeTask("t1", 3, 3, 0, "Done", "alice@co.com")] });
    const s2 = makeSprint({ id: "s2", startDate: "2026-01-12", endDate: "2026-01-16",
      tasks: [makeTask("t2", 5, 2, 3, "In Progress", "alice@co.com")] });
    const { rows, allEmails } = buildMemberActivityData([s1, s2], "2026-01-14");
    assert.deepEqual(allEmails, ["alice@co.com"]);
    assert.deepEqual(rows[0].memberStats["alice@co.com"], { assigned: 3, worked: 3, remain: 0 });
    assert.deepEqual(rows[1].memberStats["alice@co.com"], { assigned: 5, worked: 2, remain: 3 });
  });

  it("allEmails is sorted alphabetically", () => {
    const sprint = makeSprint({
      tasks: [makeTask("t1", 5, 0, 5, "Todo", "zoe@co.com, alice@co.com, bob@co.com")],
    });
    const { allEmails } = buildMemberActivityData([sprint], "2026-01-07");
    assert.deepEqual(allEmails, ["alice@co.com", "bob@co.com", "zoe@co.com"]);
  });

  it("marks current sprint correctly", () => {
    const past   = makeSprint({ id: "s1", startDate: "2026-01-05", endDate: "2026-01-09" });
    const current = makeSprint({ id: "s2", startDate: "2026-01-12", endDate: "2026-01-16" });
    const future  = makeSprint({ id: "s3", startDate: "2026-01-19", endDate: "2026-01-23" });
    const { rows } = buildMemberActivityData([past, current, future], "2026-01-14");
    assert.equal(rows[0].isCurrentSprint, false);
    assert.equal(rows[1].isCurrentSprint, true);
    assert.equal(rows[2].isCurrentSprint, false);
  });
});

// ---------------------------------------------------------------------------
// buildVelocityData
// ---------------------------------------------------------------------------

describe("buildVelocityData", () => {
  it("returns [] for empty sprints", () => {
    assert.deepEqual(buildVelocityData([]), []);
  });

  it("completed = 0 when no Done tasks", () => {
    const sprint = makeSprint({
      tasks: [makeTask("t1", 5, 0, 5, "Todo")],
    });
    const [bar] = buildVelocityData([sprint]);
    assert.equal(bar.completed, 0);
  });

  it("completed = sum of estimates of Done tasks only", () => {
    const sprint = makeSprint({
      tasks: [
        makeTask("t1", 5, 5, 0, "Done"),
        makeTask("t2", 3, 1, 2, "In Progress"),
        makeTask("t3", 2, 2, 0, "Done"),
      ],
    });
    const [bar] = buildVelocityData([sprint]);
    assert.equal(bar.completed, 7);
  });

  it("uses plannedPoints when available", () => {
    const sprint = makeSprint({
      plannedPoints: 20,
      tasks: [makeTask("t1", 5, 5, 0, "Done")],
    });
    const [bar] = buildVelocityData([sprint]);
    assert.equal(bar.planned, 20);
  });

  it("uses sum of estimates when plannedPoints is absent", () => {
    const sprint = makeSprint({
      tasks: [makeTask("t1", 5, 0, 5), makeTask("t2", 3, 0, 3)],
    });
    const [bar] = buildVelocityData([sprint]);
    assert.equal(bar.planned, 8);
  });

  it("sorts sprints by startDate and labels them Sprint 1, 2 ...", () => {
    const s1 = makeSprint({ id: "s1", startDate: "2026-02-02", endDate: "2026-02-06" });
    const s2 = makeSprint({ id: "s2", startDate: "2026-01-05", endDate: "2026-01-09" });
    const bars = buildVelocityData([s1, s2]);
    assert.equal(bars[0].sprintLabel, "Sprint 1"); // s2 (earlier)
    assert.equal(bars[1].sprintLabel, "Sprint 2"); // s1 (later)
  });

  it("sprint with no tasks: completed=0, planned=0", () => {
    const sprint = makeSprint();
    const [bar] = buildVelocityData([sprint]);
    assert.equal(bar.completed, 0);
    assert.equal(bar.planned, 0);
  });
});
