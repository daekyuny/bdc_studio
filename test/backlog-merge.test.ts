import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { planBacklogMerge } from "../src/backlogMerge.ts";
import type { ParsedBacklogRow } from "../src/backlogMerge.ts";
import type { Backlog, BacklogStory, Sprint, SprintTask } from "../src/types.ts";

const story = (id: string, storyId: string, tasks: BacklogStory["tasks"] = []): BacklogStory => ({
  id,
  storyId,
  description: `Story ${storyId}`,
  priority: 100,
  tasks,
});

const blTask = (id: string, taskId: string, extra: Partial<BacklogStory["tasks"][number]> = {}) => ({
  id,
  taskId,
  description: `desc ${taskId}`,
  estimate: 1,
  assignedTo: [] as string[],
  ...extra,
});

const sprintTask = (overrides: Partial<SprintTask>): SprintTask => ({
  id: "stid",
  name: "n",
  estimate: 1,
  worked: 0,
  remain: 1,
  status: "Todo",
  doneDate: "",
  ...overrides,
});

const sprintWith = (tasks: SprintTask[]): Sprint => ({
  id: "s1",
  description: "Sprint One",
  startDate: "2026-01-01",
  endDate: "2026-01-14",
  developers: 1,
  efficiency: 1,
  tasks,
  createdAt: "2026-01-01",
});

const row = (overrides: Partial<ParsedBacklogRow>): ParsedBacklogRow => ({
  storyId: "",
  storyDesc: "",
  priority: 100,
  taskId: "",
  taskDesc: "",
  estimate: 0,
  assignedTo: [],
  ...overrides,
});

const TEAM = ["alice@x.com", "bob@x.com"];

describe("planBacklogMerge", () => {
  it("2.0 — task referenced by a sprint is skipped", () => {
    const backlog: Backlog = {
      stories: [story("S1", "1", [blTask("T1", "1.1")])],
    };
    const sprints = [sprintWith([sprintTask({ id: "x", backlogTaskId: "T1" })])];
    const plan = planBacklogMerge(
      [row({ storyId: "1", taskId: "1.1", taskDesc: "updated", estimate: 9 })],
      backlog, sprints, TEAM,
    );
    assert.equal(plan.skipInSprint, 1);
    assert.equal(plan.updateTasks.length, 0);
  });

  it("2.1 — existing task not in any sprint is updated", () => {
    const backlog: Backlog = {
      stories: [story("S1", "1", [blTask("T1", "1.1")])],
    };
    const plan = planBacklogMerge(
      [row({ storyId: "1", taskId: "1.1", taskDesc: "new desc", estimate: 5, assignedTo: ["alice@x.com"] })],
      backlog, [], TEAM,
    );
    assert.equal(plan.updateTasks.length, 1);
    assert.deepEqual(plan.updateTasks[0].patch, {
      description: "new desc",
      estimate: 5,
      assignedTo: ["alice@x.com"],
    });
    assert.equal(plan.updateTasks[0].storyId, "S1");
    assert.equal(plan.updateTasks[0].taskId, "T1");
  });

  it("2.2 — new task under existing story (Story ID column wins)", () => {
    const backlog: Backlog = { stories: [story("S1", "1", [blTask("T1", "1.1")])] };
    const plan = planBacklogMerge(
      [row({ storyId: "1", taskId: "1.2", taskDesc: "fresh", estimate: 3 })],
      backlog, [], TEAM,
    );
    assert.equal(plan.addTasks.length, 1);
    assert.equal(plan.addTasks[0].storyId, "S1");
    assert.equal(plan.addTasks[0].task.taskId, "1.2");
  });

  it("2.3 — new story + task on the same row (exported layout)", () => {
    // exportBacklogExcel writes the story's fields on the same row as the first task.
    const plan = planBacklogMerge(
      [
        row({ storyId: "9", storyDesc: "New", priority: 50, taskId: "9.1", taskDesc: "first", estimate: 2 }),
        row({ taskId: "9.2", taskDesc: "second", estimate: 3 }),
      ],
      { stories: [] }, [], TEAM,
    );
    assert.equal(plan.addStories.length, 1);
    assert.equal(plan.addStories[0].tasks.length, 2);
    assert.deepEqual(plan.addStories[0].tasks.map((t) => t.taskId), ["9.1", "9.2"]);
    assert.equal(plan.addTasks.length, 0);
    assert.equal(plan.skipNoParent, 0);
  });

  it("2.3 — new story row + new tasks (cross-row parent resolution)", () => {
    const plan = planBacklogMerge(
      [
        row({ storyId: "9", storyDesc: "New", priority: 50 }),
        row({ taskId: "9.1", taskDesc: "child", estimate: 2 }),
      ],
      { stories: [] }, [], TEAM,
    );
    assert.equal(plan.addStories.length, 1);
    assert.equal(plan.addStories[0].storyId, "9");
    assert.equal(plan.addStories[0].priority, 50);
    assert.equal(plan.addStories[0].tasks.length, 1);
    assert.equal(plan.addStories[0].tasks[0].taskId, "9.1");
    assert.equal(plan.addTasks.length, 0);
  });

  it("2.4 — new story row with no tasks", () => {
    const plan = planBacklogMerge(
      [row({ storyId: "5", storyDesc: "Lonely" })],
      { stories: [] }, [], TEAM,
    );
    assert.equal(plan.addStories.length, 1);
    assert.equal(plan.addStories[0].tasks.length, 0);
  });

  it("2.5 — task row with no story context (blank Story ID, no prior story) is skipped", () => {
    const plan = planBacklogMerge(
      [row({ taskId: "99.1", taskDesc: "x" })],
      { stories: [] }, [], TEAM,
    );
    assert.equal(plan.skipNoParent, 1);
    assert.equal(plan.addTasks.length, 0);
    assert.equal(plan.addStories.length, 0);
  });

  it("2.1 — blank assignedTo cell leaves existing assignment untouched", () => {
    const backlog: Backlog = {
      stories: [story("S1", "1", [blTask("T1", "1.1", { assignedTo: ["alice@x.com"] })])],
    };
    const plan = planBacklogMerge(
      [row({ storyId: "1", taskId: "1.1", taskDesc: "new desc", estimate: 7, assignedTo: [] })],
      backlog, [], TEAM,
    );
    assert.equal(plan.updateTasks.length, 1);
    assert.equal(plan.updateTasks[0].patch.description, "new desc");
    assert.equal(plan.updateTasks[0].patch.estimate, 7);
    assert.ok(!("assignedTo" in plan.updateTasks[0].patch), "assignedTo should be omitted");
  });

  it("2.1 — non-blank cell with all-unknown emails still replaces (empties) assignment", () => {
    const backlog: Backlog = {
      stories: [story("S1", "1", [blTask("T1", "1.1", { assignedTo: ["alice@x.com"] })])],
    };
    const plan = planBacklogMerge(
      [row({ storyId: "1", taskId: "1.1", assignedTo: ["ghost@x.com"] })],
      backlog, [], TEAM,
    );
    assert.deepEqual(plan.updateTasks[0].patch.assignedTo, []);
    assert.deepEqual(plan.droppedEmails, ["ghost@x.com"]);
  });

  it("filters unknown emails and reports them once", () => {
    const backlog: Backlog = { stories: [story("S1", "1", [blTask("T1", "1.1")])] };
    const plan = planBacklogMerge(
      [
        row({ storyId: "1", taskId: "1.1", assignedTo: ["alice@x.com", "ghost@x.com"] }),
        row({ taskId: "1.2", taskDesc: "n", assignedTo: ["ghost@x.com", "bob@x.com"] }),
      ],
      backlog, [], TEAM,
    );
    assert.deepEqual(plan.updateTasks[0].patch.assignedTo, ["alice@x.com"]);
    assert.deepEqual(plan.addTasks[0].task.assignedTo, ["bob@x.com"]);
    assert.deepEqual(plan.droppedEmails, ["ghost@x.com"]);
  });

  it("screenshot scenario — existing 5.4 + new 5.5 (2 tasks) + new 5.6 (no tasks)", () => {
    // Mirrors test_data/screenshot.jpg — existing backlog has 5.4 with children,
    // user adds 5.5 (with 5.5.1, 5.5.2 same-row-then-blank) and a bare 5.6.
    const backlog: Backlog = {
      stories: [
        story("S54", "5.4", [
          blTask("T541", "5.4.1"),
          blTask("T542", "5.4.2"),
          blTask("T543", "5.4.3"),
          blTask("T544", "5.4.4"),
        ]),
      ],
    };
    const plan = planBacklogMerge(
      [
        row({ storyId: "5.4", storyDesc: "나는 운영자로서...", priority: 90, taskId: "5.4.1", taskDesc: "[FE] 지역...", estimate: 1.5 }),
        row({ taskId: "5.4.2", taskDesc: "[FE] 수요·공급...", estimate: 1.5 }),
        row({ taskId: "5.4.3", taskDesc: "[BE] 지역...", estimate: 2 }),
        row({ taskId: "5.4.4", taskDesc: "[BE] 운영...", estimate: 2 }),
        row({ storyId: "5.5", storyDesc: "(test) User story New with tasks", priority: 100, taskId: "5.5.1", taskDesc: "(test) task 5.5.1", estimate: 3 }),
        row({ taskId: "5.5.2", taskDesc: "(test) task 5.5.2", estimate: 5 }),
        row({ storyId: "5.6", storyDesc: "(test) User story만 있는 것", priority: 80 }),
      ],
      backlog, [], [],
    );
    assert.equal(plan.skipNoParent, 0, "no tasks should be orphaned");
    assert.equal(plan.addStories.length, 2, "5.5 and 5.6 should be added");
    const s55 = plan.addStories.find((s) => s.storyId === "5.5");
    assert.ok(s55, "5.5 added");
    assert.equal(s55!.tasks.length, 2);
    assert.deepEqual(s55!.tasks.map((t) => t.taskId), ["5.5.1", "5.5.2"]);
    const s56 = plan.addStories.find((s) => s.storyId === "5.6");
    assert.ok(s56, "5.6 added");
    assert.equal(s56!.tasks.length, 0);
  });

  it("leaves existing story metadata untouched when storyId already exists", () => {
    const backlog: Backlog = { stories: [story("S1", "1")] };
    backlog.stories[0].description = "Original";
    backlog.stories[0].priority = 7;
    const plan = planBacklogMerge(
      [row({ storyId: "1", storyDesc: "DIFFERENT", priority: 999 })],
      backlog, [], TEAM,
    );
    assert.equal(plan.addStories.length, 0);
    assert.equal(plan.updateTasks.length, 0);
    // current backlog object untouched
    assert.equal(backlog.stories[0].description, "Original");
    assert.equal(backlog.stories[0].priority, 7);
  });
});
