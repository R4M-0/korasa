"use client";

import { create } from "zustand";
import { toast } from "sonner";
import {
  api,
  type CollectionInput,
  type CollectionPatch,
  type ProjectInput,
  type ProjectPatch,
} from "@/lib/api/client";
import type {
  CollectionDTO,
  PageSummaryDTO,
  ProjectDTO,
  WorkspaceDTO,
} from "@/types";

/**
 * Client cache of the workspace tree (collections, projects, page summaries).
 * All mutations go through the API first; the cache only changes after the
 * server confirms, so the UI never shows unsaved organisational changes.
 */
interface WorkspaceState {
  status: "idle" | "loading" | "ready" | "error";
  error: string | null;
  workspace: WorkspaceDTO | null;
  collections: CollectionDTO[];
  projects: ProjectDTO[];

  load: (force?: boolean) => Promise<void>;
  refresh: () => Promise<void>;

  createCollection: (input: CollectionInput) => Promise<CollectionDTO | null>;
  updateCollection: (id: string, patch: CollectionPatch) => Promise<CollectionDTO | null>;
  trashCollection: (id: string) => Promise<void>;

  createProject: (input: ProjectInput) => Promise<ProjectDTO | null>;
  updateProject: (id: string, patch: ProjectPatch) => Promise<ProjectDTO | null>;
  trashProject: (id: string) => Promise<void>;

  reorderCollections: (ids: string[]) => Promise<void>;
  reorderProjects: (ids: string[]) => Promise<void>;

  /** Local cache updates pushed by the editor after it saved something. */
  upsertProject: (project: ProjectDTO) => void;
  setProjectPages: (projectId: string, pages: PageSummaryDTO[]) => void;
  patchPageSummary: (projectId: string, pageId: string, patch: Partial<PageSummaryDTO>) => void;
}

function reportError(action: string, err: unknown) {
  toast.error(`Couldn't ${action}`, { description: err instanceof Error ? err.message : String(err) });
}

let inflight: Promise<void> | null = null;

export const useWorkspaceStore = create<WorkspaceState>()((set, get) => ({
  status: "idle",
  error: null,
  workspace: null,
  collections: [],
  projects: [],

  load: async (force = false) => {
    if (!force && (get().status === "ready" || inflight)) return inflight ?? undefined;
    if (get().status !== "ready") set({ status: "loading" });
    inflight = api
      .tree()
      .then((tree) =>
        set({
          status: "ready",
          error: null,
          workspace: tree.workspace,
          collections: tree.collections,
          projects: tree.projects,
        }),
      )
      .catch((err: unknown) => {
        if (get().status !== "ready") set({ status: "error", error: err instanceof Error ? err.message : String(err) });
      })
      .finally(() => {
        inflight = null;
      });
    return inflight;
  },

  refresh: () => get().load(true),

  createCollection: async (input) => {
    try {
      const c = await api.createCollection(input);
      set((s) => ({ collections: [...s.collections, c] }));
      return c;
    } catch (err) {
      reportError(`create the ${input.kind}`, err);
      return null;
    }
  },

  updateCollection: async (id, patch) => {
    try {
      const c = await api.updateCollection(id, patch);
      set((s) => ({ collections: s.collections.map((x) => (x.id === id ? c : x)) }));
      return c;
    } catch (err) {
      reportError("update", err);
      return null;
    }
  },

  trashCollection: async (id) => {
    const c = get().collections.find((x) => x.id === id);
    try {
      await api.deleteCollection(id);
      // Children and contained projects are hidden server-side; refetch.
      await get().refresh();
      toast(`Moved “${c?.name ?? "item"}” to trash`, {
        action: {
          label: "Undo",
          onClick: async () => {
            await get().updateCollection(id, { restore: true });
            await get().refresh();
          },
        },
      });
    } catch (err) {
      reportError("delete", err);
    }
  },

  createProject: async (input) => {
    try {
      const p = await api.createProject(input);
      set((s) => ({ projects: [...s.projects, p] }));
      return p;
    } catch (err) {
      reportError("create the project", err);
      return null;
    }
  },

  updateProject: async (id, patch) => {
    try {
      const p = await api.updateProject(id, patch);
      set((s) => ({ projects: s.projects.map((x) => (x.id === id ? p : x)) }));
      return p;
    } catch (err) {
      reportError("update the project", err);
      return null;
    }
  },

  trashProject: async (id) => {
    const p = get().projects.find((x) => x.id === id);
    try {
      await api.deleteProject(id);
      set((s) => ({ projects: s.projects.filter((x) => x.id !== id) }));
      toast(`Moved “${p?.name ?? "project"}” to trash`, {
        action: {
          label: "Undo",
          onClick: async () => {
            const restored = await get().updateProject(id, { restore: true });
            if (restored) get().upsertProject(restored);
          },
        },
      });
    } catch (err) {
      reportError("delete the project", err);
    }
  },

  reorderCollections: async (ids) => {
    const prev = get().collections;
    const pos = new Map(ids.map((id, i) => [id, i + 1]));
    set({ collections: prev.map((c) => (pos.has(c.id) ? { ...c, position: pos.get(c.id)! } : c)) });
    try {
      await api.reorder("collection", ids);
    } catch (err) {
      set({ collections: prev });
      reportError("reorder", err);
    }
  },

  reorderProjects: async (ids) => {
    const prev = get().projects;
    const pos = new Map(ids.map((id, i) => [id, i + 1]));
    set({ projects: prev.map((p) => (pos.has(p.id) ? { ...p, position: pos.get(p.id)! } : p)) });
    try {
      await api.reorder("project", ids);
    } catch (err) {
      set({ projects: prev });
      reportError("reorder", err);
    }
  },

  upsertProject: (project) =>
    set((s) => ({
      projects: s.projects.some((p) => p.id === project.id)
        ? s.projects.map((p) => (p.id === project.id ? project : p))
        : [...s.projects, project],
    })),

  setProjectPages: (projectId, pages) =>
    set((s) => ({ projects: s.projects.map((p) => (p.id === projectId ? { ...p, pages } : p)) })),

  patchPageSummary: (projectId, pageId, patch) =>
    set((s) => ({
      projects: s.projects.map((p) =>
        p.id === projectId
          ? { ...p, pages: p.pages.map((pg) => (pg.id === pageId ? { ...pg, ...patch } : pg)) }
          : p,
      ),
    })),
}));

// ------------------------------------------------------------------ selectors

export const byPosition = <T extends { position: number; createdAt?: string }>(a: T, b: T) =>
  a.position - b.position || (a.createdAt ?? "").localeCompare(b.createdAt ?? "");

export function childCollections(collections: CollectionDTO[], parentId: string | null) {
  return collections.filter((c) => c.parentId === parentId).sort(byPosition);
}

export function projectsIn(projects: ProjectDTO[], collectionId: string | null) {
  return projects.filter((p) => p.collectionId === collectionId).sort(byPosition);
}

/** All ancestor collections of a collection, root first. */
export function collectionPath(collections: CollectionDTO[], id: string | null): CollectionDTO[] {
  const out: CollectionDTO[] = [];
  const byId = new Map(collections.map((c) => [c.id, c]));
  let cursor = id ? byId.get(id) : undefined;
  while (cursor) {
    out.unshift(cursor);
    cursor = cursor.parentId ? byId.get(cursor.parentId) : undefined;
  }
  return out;
}

/** The top-level course a collection or project lives in, if any. */
export function owningCourse(collections: CollectionDTO[], collectionId: string | null) {
  return collectionPath(collections, collectionId).find((c) => c.kind === "course") ?? null;
}
