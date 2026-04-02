import type { Sprint } from "./types.ts";

export interface MemberSprintStat {
  assigned: number;
  worked: number;
  remain: number;
}

export interface SprintDashboardRow {
  sprintId: string;
  sprintLabel: string;       // "Sprint 1", "Sprint 2" …
  isCurrentSprint: boolean;
  memberStats: Record<string, MemberSprintStat>; // keyed by email
  totals: MemberSprintStat;
}

export interface VelocityBar {
  sprintLabel: string;
  completed: number;   // sum of estimates of Done tasks
  planned: number;     // sprint.plannedPoints ?? sum of all estimates
}

/** Parse CSV assignedTo string → trimmed email array. */
export function getAssignedEmails(assignedTo: string | undefined): string[] {
  if (!assignedTo || !assignedTo.trim()) return [];
  return assignedTo.split(",").map((s) => s.trim()).filter(Boolean);
}

/**
 * Build per-sprint, per-member activity stats.
 * Full credit given to every assigned member (no splitting for shared tasks).
 * Returns rows sorted by sprint startDate and allEmails sorted alphabetically.
 */
export function buildMemberActivityData(
  sprints: Sprint[],
  projectToday: string,
): { rows: SprintDashboardRow[]; allEmails: string[] } {
  if (!sprints.length) return { rows: [], allEmails: [] };

  const sorted = [...sprints].sort((a, b) => a.startDate.localeCompare(b.startDate));
  const emailSet = new Set<string>();

  const rows: SprintDashboardRow[] = sorted.map((sprint, idx) => {
    const isCurrentSprint =
      projectToday >= sprint.startDate && projectToday <= sprint.endDate;
    const sprintLabel = `Sprint ${idx + 1}`;
    const memberStats: Record<string, MemberSprintStat> = {};
    const totals: MemberSprintStat = { assigned: 0, worked: 0, remain: 0 };

    for (const task of sprint.tasks) {
      const emails = getAssignedEmails(task.assignedTo);
      totals.assigned += task.estimate;
      totals.worked += task.worked;
      totals.remain += task.remain;

      for (const email of emails) {
        emailSet.add(email);
        if (!memberStats[email]) memberStats[email] = { assigned: 0, worked: 0, remain: 0 };
        memberStats[email].assigned += task.estimate;
        memberStats[email].worked += task.worked;
        memberStats[email].remain += task.remain;
      }
    }

    return { sprintId: sprint.id, sprintLabel, isCurrentSprint, memberStats, totals };
  });

  const allEmails = [...emailSet].sort();
  return { rows, allEmails };
}

/**
 * Build velocity data (planned vs completed) for each sprint, sorted by startDate.
 */
export function buildVelocityData(sprints: Sprint[]): VelocityBar[] {
  if (!sprints.length) return [];

  return [...sprints]
    .sort((a, b) => a.startDate.localeCompare(b.startDate))
    .map((sprint, idx) => {
      const completed = sprint.tasks
        .filter((t) => t.status === "Done")
        .reduce((sum, t) => sum + t.estimate, 0);
      const planned =
        sprint.plannedPoints ??
        sprint.tasks.reduce((sum, t) => sum + t.estimate, 0);
      return { sprintLabel: `Sprint ${idx + 1}`, completed, planned };
    });
}
