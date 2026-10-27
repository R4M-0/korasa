import type { PageSummaryDTO, ProjectDTO } from "@/types";

export type RecentItem =
  | { kind: "project"; key: string; at: string; project: ProjectDTO }
  | { kind: "page"; key: string; at: string; project: ProjectDTO; page: PageSummaryDTO };

/** Recently opened projects and pages, newest first. */
export function recentItems(projects: ProjectDTO[], opts: { pages?: boolean; projects?: boolean } = {}) {
  const { pages = true, projects: includeProjects = true } = opts;
  const out: RecentItem[] = [];
  for (const p of projects) {
    if (includeProjects && p.lastOpenedAt) out.push({ kind: "project", key: `p:${p.id}`, at: p.lastOpenedAt, project: p });
    if (pages)
      for (const pg of p.pages)
        if (pg.lastOpenedAt) out.push({ kind: "page", key: `pg:${pg.id}`, at: pg.lastOpenedAt, project: p, page: pg });
  }
  return out.sort((a, b) => b.at.localeCompare(a.at));
}

export function recentProjects(projects: ProjectDTO[]) {
  return projects
    .filter((p) => p.lastOpenedAt || p.updatedAt)
    .sort((a, b) => (b.lastOpenedAt ?? b.updatedAt).localeCompare(a.lastOpenedAt ?? a.updatedAt));
}
