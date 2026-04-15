import type { Backlog, BacklogStory, BacklogTask, Sprint } from "./types.ts";
import { createId } from "./utils.ts";

export interface ParsedBacklogRow {
  storyId: string;
  storyDesc: string;
  priority: number;
  taskId: string;
  taskDesc: string;
  estimate: number;
  assignedTo: string[];
}

export interface BacklogMergePlan {
  addStories: BacklogStory[];
  addTasks: { storyId: string; task: BacklogTask }[];
  updateTasks: { storyId: string; taskId: string; patch: Partial<BacklogTask> }[];
  skipInSprint: number;
  skipNoParent: number;
  droppedEmails: string[];
  acceptedEmails: string[];
}

export const planBacklogMerge = (
  rows: ParsedBacklogRow[],
  currentBacklog: Backlog,
  sprints: Sprint[],
  teamEmails: string[],
): BacklogMergePlan => {
  const teamEmailSet = new Set(teamEmails.map((e) => e.toLowerCase()));

  const tasksByDisplayId = new Map<string, { story: BacklogStory; task: BacklogTask }>();
  const storiesByDisplayId = new Map<string, BacklogStory>();
  for (const story of currentBacklog.stories) {
    if (story.storyId) storiesByDisplayId.set(story.storyId, story);
    for (const task of story.tasks) {
      if (task.taskId) tasksByDisplayId.set(task.taskId, { story, task });
    }
  }

  const inSprintBacklogTaskIds = new Set<string>();
  for (const sprint of sprints) {
    for (const t of sprint.tasks) {
      if (t.backlogTaskId) inSprintBacklogTaskIds.add(t.backlogTaskId);
    }
  }

  const addStories: BacklogStory[] = [];
  const addTasks: { storyId: string; task: BacklogTask }[] = [];
  const updateTasks: { storyId: string; taskId: string; patch: Partial<BacklogTask> }[] = [];
  let skipInSprint = 0;
  let skipNoParent = 0;
  const droppedSet = new Set<string>();
  const acceptedSet = new Set<string>();
  const addedStoriesByDisplayId = new Map<string, BacklogStory>();

  const filterEmails = (list: string[]): string[] => {
    const kept: string[] = [];
    for (const raw of list) {
      const e = raw.trim();
      if (!e) continue;
      if (teamEmailSet.has(e.toLowerCase())) {
        kept.push(e);
        acceptedSet.add(e);
      } else {
        droppedSet.add(e);
      }
    }
    return kept;
  };

  let currentStoryDisplayId = "";

  for (const row of rows) {
    // Story part — may coexist with a task on the same row (exported layout).
    if (row.storyId) {
      currentStoryDisplayId = row.storyId;
      if (!storiesByDisplayId.has(row.storyId) && !addedStoriesByDisplayId.has(row.storyId)) {
        const newStory: BacklogStory = {
          id: createId(),
          storyId: row.storyId,
          description: row.storyDesc,
          priority: row.priority,
          tasks: [],
        };
        addStories.push(newStory);
        addedStoriesByDisplayId.set(row.storyId, newStory);
      }
    }
    const effectiveStoryDisplayId = row.storyId || currentStoryDisplayId;

    // Task part
    if (!row.taskId) continue;

    const existing = tasksByDisplayId.get(row.taskId);
    if (existing) {
      if (inSprintBacklogTaskIds.has(existing.task.id)) {
        skipInSprint++;
        continue;
      }
      const patch: Partial<BacklogTask> = {
        description: row.taskDesc,
        estimate: row.estimate,
      };
      // Blank "Assigned To" cell means "don't touch" — most likely the user is
      // editing other fields and didn't intend to unassign. To actually clear
      // an assignment, use the Backlog tab UI.
      if (row.assignedTo.length > 0) {
        patch.assignedTo = filterEmails(row.assignedTo);
      }
      updateTasks.push({
        storyId: existing.story.id,
        taskId: existing.task.id,
        patch,
      });
      continue;
    }

    const existingParent = storiesByDisplayId.get(effectiveStoryDisplayId);
    const addedParent = addedStoriesByDisplayId.get(effectiveStoryDisplayId);
    if (!existingParent && !addedParent) {
      skipNoParent++;
      continue;
    }

    const newTask: BacklogTask = {
      id: createId(),
      taskId: row.taskId,
      description: row.taskDesc,
      estimate: row.estimate,
      assignedTo: filterEmails(row.assignedTo),
    };

    if (addedParent) {
      addedParent.tasks.push(newTask);
    } else if (existingParent) {
      addTasks.push({ storyId: existingParent.id, task: newTask });
    }
  }

  return {
    addStories,
    addTasks,
    updateTasks,
    skipInSprint,
    skipNoParent,
    droppedEmails: [...droppedSet],
    acceptedEmails: [...acceptedSet],
  };
};
