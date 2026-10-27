import "server-only";
import type {
  Attachment,
  Collection,
  Page,
  Project,
} from "@/generated/prisma/client";
import { db } from "@/lib/db/client";
import { seedWorkspace } from "@/lib/db/seed-data";
import {
  extractSceneText,
  parseScene,
  type Orientation,
  type PageBackground,
  type Scene,
} from "@/lib/editor/scene";
import type {
  AttachmentDTO,
  CollectionDTO,
  CollectionKind,
  PageDTO,
  PageSummaryDTO,
  ProjectDTO,
  ProjectDocumentDTO,
  ProjectViewMode,
  SearchResultDTO,
  TrashDTO,
  WorkspaceTreeDTO,
} from "@/types";

export class NotFoundError extends Error {}

const iso = (d: Date | null) => (d ? d.toISOString() : null);

export function toCollectionDTO(c: Collection): CollectionDTO {
  return {
    id: c.id,
    kind: c.kind as CollectionKind,
    parentId: c.parentId,
    name: c.name,
    description: c.description,
    icon: c.icon,
    color: c.color,
    term: c.term,
    position: c.position,
    favoritedAt: iso(c.favoritedAt),
    deletedAt: iso(c.deletedAt),
    createdAt: c.createdAt.toISOString(),
    updatedAt: c.updatedAt.toISOString(),
  };
}

export function toPageSummaryDTO(p: Omit<Page, "scene" | "textContent">): PageSummaryDTO {
  return {
    id: p.id,
    projectId: p.projectId,
    title: p.title,
    position: p.position,
    background: p.background as PageBackground,
    orientation: p.orientation as Orientation,
    favoritedAt: iso(p.favoritedAt),
    lastOpenedAt: iso(p.lastOpenedAt),
    deletedAt: iso(p.deletedAt),
    createdAt: p.createdAt.toISOString(),
    updatedAt: p.updatedAt.toISOString(),
  };
}

export function toPageDTO(p: Page): PageDTO {
  return {
    ...toPageSummaryDTO(p),
    posX: p.posX,
    posY: p.posY,
    scene: parseScene(p.scene),
    revision: p.revision,
  };
}

export function toProjectDTO(
  p: Project,
  pages: Omit<Page, "scene" | "textContent">[] = [],
): ProjectDTO {
  return {
    id: p.id,
    collectionId: p.collectionId,
    name: p.name,
    description: p.description,
    icon: p.icon,
    color: p.color,
    position: p.position,
    viewMode: p.viewMode as ProjectViewMode,
    favoritedAt: iso(p.favoritedAt),
    lastOpenedAt: iso(p.lastOpenedAt),
    deletedAt: iso(p.deletedAt),
    createdAt: p.createdAt.toISOString(),
    updatedAt: p.updatedAt.toISOString(),
    pages: pages
      .filter((pg) => !pg.deletedAt)
      .sort((a, b) => a.position - b.position)
      .map(toPageSummaryDTO),
  };
}

export function toAttachmentDTO(a: Attachment): AttachmentDTO {
  return {
    id: a.id,
    url: `/api/attachments/${a.id}`,
    filename: a.filename,
    mimeType: a.mimeType,
    width: a.width,
    height: a.height,
    size: a.size,
  };
}

/** Columns for page listings — never pull scene JSON for trees. */
const pageSummarySelect = {
  id: true,
  projectId: true,
  title: true,
  position: true,
  background: true,
  orientation: true,
  posX: true,
  posY: true,
  revision: true,
  favoritedAt: true,
  lastOpenedAt: true,
  deletedAt: true,
  createdAt: true,
  updatedAt: true,
} as const;

let workspacePromise: Promise<{ id: string; name: string }> | null = null;

/**
 * The local single-user workspace. Created (with sample content) on first
 * run. Memoised per server process so concurrent first requests don't race.
 */
export function getWorkspace() {
  if (!workspacePromise) {
    workspacePromise = (async () => {
      const existing = await db.workspace.findFirst({ orderBy: { createdAt: "asc" } });
      if (existing) return { id: existing.id, name: existing.name };
      const ws = await db.workspace.create({ data: { name: "My Workspace" } });
      if (process.env.KORASA_SKIP_SAMPLE !== "1") await seedWorkspace(db, ws.id);
      return { id: ws.id, name: ws.name };
    })().catch((err) => {
      workspacePromise = null;
      throw err;
    });
  }
  return workspacePromise;
}

export async function getTree(): Promise<WorkspaceTreeDTO> {
  const ws = await getWorkspace();
  const [collections, projects] = await Promise.all([
    db.collection.findMany({
      where: { workspaceId: ws.id, deletedAt: null },
      orderBy: [{ position: "asc" }, { createdAt: "asc" }],
    }),
    db.project.findMany({
      where: { workspaceId: ws.id, deletedAt: null },
      orderBy: [{ position: "asc" }, { createdAt: "asc" }],
      include: { pages: { select: pageSummarySelect, where: { deletedAt: null } } },
    }),
  ]);
  // Hide projects whose collection chain is in the trash.
  const alive = new Set(collections.map((c) => c.id));
  const visibleCollections = collections.filter((c) => !c.parentId || alive.has(c.parentId));
  const visible = new Set(visibleCollections.map((c) => c.id));
  // Repeat until stable for deeper nesting.
  let changed = true;
  let list = visibleCollections;
  while (changed) {
    const next = list.filter((c) => !c.parentId || visible.has(c.parentId));
    changed = next.length !== list.length;
    visible.clear();
    next.forEach((c) => visible.add(c.id));
    list = next;
  }
  return {
    workspace: ws,
    collections: list.map(toCollectionDTO),
    projects: projects
      .filter((p) => !p.collectionId || visible.has(p.collectionId))
      .map((p) => toProjectDTO(p, p.pages)),
  };
}

async function nextPosition(
  model: "collection" | "project",
  where: Record<string, unknown>,
): Promise<number> {
  const agg =
    model === "collection"
      ? await db.collection.aggregate({ _max: { position: true }, where })
      : await db.project.aggregate({ _max: { position: true }, where });
  return (agg._max.position ?? 0) + 1;
}

// ---------------------------------------------------------------- collections

export async function createCollection(input: {
  kind: CollectionKind;
  name: string;
  description: string;
  icon: string | null;
  color: string | null;
  term: string | null;
  parentId: string | null;
}) {
  const ws = await getWorkspace();
  if (input.parentId) await assertCollection(input.parentId);
  const position = await nextPosition("collection", {
    workspaceId: ws.id,
    parentId: input.parentId,
  });
  const c = await db.collection.create({
    data: { ...input, workspaceId: ws.id, position },
  });
  return toCollectionDTO(c);
}

async function assertCollection(id: string) {
  const c = await db.collection.findUnique({ where: { id } });
  if (!c) throw new NotFoundError("Collection not found");
  return c;
}

export async function updateCollection(
  id: string,
  patch: {
    kind?: CollectionKind;
    name?: string;
    description?: string;
    icon?: string | null;
    color?: string | null;
    term?: string | null;
    parentId?: string | null;
    position?: number;
    favorite?: boolean;
    restore?: true;
  },
) {
  await assertCollection(id);
  if (patch.parentId) {
    // Prevent cycles: walk up from the new parent.
    let cursor: string | null = patch.parentId;
    while (cursor) {
      if (cursor === id) throw new Error("A folder cannot be moved inside itself");
      const parent: { parentId: string | null } | null = await db.collection.findUnique({
        where: { id: cursor },
        select: { parentId: true },
      });
      cursor = parent?.parentId ?? null;
    }
  }
  const { favorite, restore, ...rest } = patch;
  const c = await db.collection.update({
    where: { id },
    data: {
      ...rest,
      ...(favorite !== undefined && { favoritedAt: favorite ? new Date() : null }),
      ...(restore && { deletedAt: null }),
    },
  });
  return toCollectionDTO(c);
}

export async function deleteCollection(id: string, permanent: boolean) {
  await assertCollection(id);
  if (permanent) {
    const ids = await descendantCollectionIds(id);
    // Projects inside are deleted with their folder when purging.
    await db.project.deleteMany({ where: { collectionId: { in: ids } } });
    await db.collection.delete({ where: { id } });
  } else {
    await db.collection.update({ where: { id }, data: { deletedAt: new Date() } });
  }
}

async function descendantCollectionIds(rootId: string): Promise<string[]> {
  const all = await db.collection.findMany({ select: { id: true, parentId: true } });
  const out = [rootId];
  for (let i = 0; i < out.length; i++) {
    for (const c of all) if (c.parentId === out[i]) out.push(c.id);
  }
  return out;
}

// ------------------------------------------------------------------- projects

export async function createProject(input: {
  name: string;
  description: string;
  icon: string | null;
  color: string | null;
  collectionId: string | null;
  background: PageBackground;
}) {
  const ws = await getWorkspace();
  if (input.collectionId) await assertCollection(input.collectionId);
  const position = await nextPosition("project", {
    workspaceId: ws.id,
    collectionId: input.collectionId,
  });
  const { background, ...data } = input;
  const p = await db.project.create({
    data: {
      ...data,
      workspaceId: ws.id,
      position,
      lastOpenedAt: new Date(),
      pages: { create: { title: "Page 1", position: 1, background } },
    },
    include: { pages: { select: pageSummarySelect } },
  });
  return toProjectDTO(p, p.pages);
}

export async function getProjectDocument(id: string): Promise<ProjectDocumentDTO> {
  const project = await db.project.findUnique({
    where: { id },
    include: { pages: { where: { deletedAt: null }, orderBy: { position: "asc" } } },
  });
  if (!project) throw new NotFoundError("Project not found");
  const breadcrumbs: CollectionDTO[] = [];
  let cursor = project.collectionId;
  while (cursor) {
    const c = await db.collection.findUnique({ where: { id: cursor } });
    if (!c) break;
    breadcrumbs.unshift(toCollectionDTO(c));
    cursor = c.parentId;
  }
  return {
    project: toProjectDTO(project, project.pages),
    pages: project.pages.map(toPageDTO),
    breadcrumbs,
  };
}

export async function updateProject(
  id: string,
  patch: {
    name?: string;
    description?: string;
    icon?: string | null;
    color?: string | null;
    collectionId?: string | null;
    position?: number;
    viewMode?: ProjectViewMode;
    favorite?: boolean;
    restore?: true;
    opened?: true;
  },
) {
  const existing = await db.project.findUnique({ where: { id } });
  if (!existing) throw new NotFoundError("Project not found");
  if (patch.collectionId) await assertCollection(patch.collectionId);
  const { favorite, restore, opened, ...rest } = patch;
  const p = await db.project.update({
    where: { id },
    data: {
      ...rest,
      ...(favorite !== undefined && { favoritedAt: favorite ? new Date() : null }),
      ...(restore && { deletedAt: null }),
      ...(opened && { lastOpenedAt: new Date() }),
    },
    include: { pages: { select: pageSummarySelect } },
  });
  return toProjectDTO(p, p.pages);
}

export async function deleteProject(id: string, permanent: boolean) {
  const existing = await db.project.findUnique({ where: { id } });
  if (!existing) throw new NotFoundError("Project not found");
  if (permanent) await db.project.delete({ where: { id } });
  else await db.project.update({ where: { id }, data: { deletedAt: new Date() } });
}

// ---------------------------------------------------------------------- pages

export async function createPage(
  projectId: string,
  input: {
    title?: string;
    afterPageId?: string | null;
    duplicateOf?: string;
    background?: PageBackground;
    orientation?: Orientation;
  },
) {
  const project = await db.project.findUnique({
    where: { id: projectId },
    include: {
      pages: { where: { deletedAt: null }, orderBy: { position: "asc" }, select: pageSummarySelect },
    },
  });
  if (!project) throw new NotFoundError("Project not found");
  const pages = project.pages;

  const source = input.duplicateOf
    ? await db.page.findUnique({ where: { id: input.duplicateOf } })
    : null;
  if (input.duplicateOf && !source) throw new NotFoundError("Page to duplicate not found");

  // Insert after the given page (or the duplicated one), else at the end.
  const anchorId = input.afterPageId ?? source?.id ?? null;
  const anchorIndex = anchorId ? pages.findIndex((p) => p.id === anchorId) : -1;
  let position: number;
  if (anchorIndex === -1) {
    position = (pages.at(-1)?.position ?? 0) + 1;
  } else {
    const a = pages[anchorIndex].position;
    const b = pages[anchorIndex + 1]?.position;
    position = b === undefined ? a + 1 : (a + b) / 2;
  }

  const last = pages.at(-1);
  const scene = source ? source.scene : undefined;
  const page = await db.page.create({
    data: {
      projectId,
      title:
        input.title ||
        (source ? `${source.title} (copy)` : `Page ${pages.length + 1}`),
      position,
      background: input.background ?? source?.background ?? last?.background ?? "ruled",
      orientation: input.orientation ?? source?.orientation ?? "portrait",
      ...(scene && { scene, textContent: source?.textContent ?? "" }),
    },
  });
  await db.project.update({ where: { id: projectId }, data: { updatedAt: new Date() } });
  return toPageDTO(page);
}

export async function getPage(id: string) {
  const page = await db.page.findUnique({ where: { id } });
  if (!page) throw new NotFoundError("Page not found");
  return toPageDTO(page);
}

export async function updatePage(
  id: string,
  patch: {
    title?: string;
    background?: PageBackground;
    orientation?: Orientation;
    scene?: Scene;
    posX?: number | null;
    posY?: number | null;
    position?: number;
    favorite?: boolean;
    restore?: true;
    opened?: true;
  },
) {
  const existing = await db.page.findUnique({ where: { id }, select: { projectId: true } });
  if (!existing) throw new NotFoundError("Page not found");
  const { favorite, restore, opened, scene, ...rest } = patch;
  const now = new Date();
  const contentChanged =
    scene !== undefined ||
    rest.title !== undefined ||
    rest.background !== undefined ||
    rest.orientation !== undefined;
  const page = await db.page.update({
    where: { id },
    data: {
      ...rest,
      ...(scene && {
        scene: JSON.stringify(scene),
        textContent: extractSceneText(scene),
        revision: { increment: 1 },
      }),
      ...(favorite !== undefined && { favoritedAt: favorite ? now : null }),
      ...(restore && { deletedAt: null }),
      ...(opened && { lastOpenedAt: now }),
    },
    select: pageSummarySelect,
  });
  if (contentChanged || restore) {
    await db.project.update({ where: { id: existing.projectId }, data: { updatedAt: now } });
  }
  return { ...toPageSummaryDTO(page), revision: page.revision };
}

export async function deletePage(id: string, permanent: boolean) {
  const existing = await db.page.findUnique({ where: { id }, select: { id: true } });
  if (!existing) throw new NotFoundError("Page not found");
  if (permanent) await db.page.delete({ where: { id } });
  else await db.page.update({ where: { id }, data: { deletedAt: new Date() } });
}

export async function reorder(kind: "collection" | "project" | "page", ids: string[]) {
  await db.$transaction(
    ids.map((id, i) => {
      const data = { position: i + 1 };
      if (kind === "collection") return db.collection.update({ where: { id }, data });
      if (kind === "project") return db.project.update({ where: { id }, data });
      return db.page.update({ where: { id }, data });
    }),
  );
}

// ---------------------------------------------------------------------- trash

export async function getTrash(): Promise<TrashDTO> {
  const ws = await getWorkspace();
  const [collections, projects, pages] = await Promise.all([
    db.collection.findMany({
      where: { workspaceId: ws.id, deletedAt: { not: null } },
      orderBy: { deletedAt: "desc" },
    }),
    db.project.findMany({
      where: { workspaceId: ws.id, deletedAt: { not: null } },
      orderBy: { deletedAt: "desc" },
    }),
    db.page.findMany({
      where: { deletedAt: { not: null }, project: { workspaceId: ws.id } },
      orderBy: { deletedAt: "desc" },
      select: { ...pageSummarySelect, project: { select: { name: true } } },
    }),
  ]);
  return {
    collections: collections.map(toCollectionDTO),
    projects: projects.map((p) => toProjectDTO(p)),
    pages: pages.map(({ project, ...p }) => ({ ...toPageSummaryDTO(p), projectName: project.name })),
  };
}

export async function emptyTrash() {
  const ws = await getWorkspace();
  await db.page.deleteMany({ where: { deletedAt: { not: null }, project: { workspaceId: ws.id } } });
  await db.project.deleteMany({ where: { workspaceId: ws.id, deletedAt: { not: null } } });
  const trashed = await db.collection.findMany({
    where: { workspaceId: ws.id, deletedAt: { not: null } },
    select: { id: true },
  });
  for (const c of trashed) {
    const stillThere = await db.collection.findUnique({ where: { id: c.id }, select: { id: true } });
    if (stillThere) await deleteCollection(c.id, true);
  }
}

// --------------------------------------------------------------------- search

function snippetAround(text: string, query: string) {
  const i = text.toLowerCase().indexOf(query.toLowerCase());
  if (i === -1) return undefined;
  const start = Math.max(0, i - 40);
  const end = Math.min(text.length, i + query.length + 60);
  return (start > 0 ? "…" : "") + text.slice(start, end).replace(/\s+/g, " ") + (end < text.length ? "…" : "");
}

export async function search(query: string, limit = 30): Promise<SearchResultDTO[]> {
  const q = query.trim();
  if (!q) return [];
  const ws = await getWorkspace();
  const [collections, projects, pages, allCollections] = await Promise.all([
    db.collection.findMany({
      where: {
        workspaceId: ws.id,
        deletedAt: null,
        OR: [{ name: { contains: q } }, { description: { contains: q } }, { term: { contains: q } }],
      },
      take: limit,
    }),
    db.project.findMany({
      where: {
        workspaceId: ws.id,
        deletedAt: null,
        OR: [{ name: { contains: q } }, { description: { contains: q } }],
      },
      take: limit,
    }),
    db.page.findMany({
      where: {
        deletedAt: null,
        project: { workspaceId: ws.id, deletedAt: null },
        OR: [{ title: { contains: q } }, { textContent: { contains: q } }],
      },
      select: {
        id: true,
        title: true,
        textContent: true,
        updatedAt: true,
        projectId: true,
        project: { select: { name: true } },
      },
      orderBy: { updatedAt: "desc" },
      take: limit,
    }),
    db.collection.findMany({ where: { workspaceId: ws.id }, select: { id: true, name: true } }),
  ]);
  const collectionName = new Map(allCollections.map((c) => [c.id, c.name]));

  const results: SearchResultDTO[] = [
    ...collections.map<SearchResultDTO>((c) => ({
      kind: "collection",
      subtype: c.kind as CollectionKind,
      id: c.id,
      title: c.name,
      context: c.kind === "course" ? (c.term ? `Course · ${c.term}` : "Course") : "Folder",
      snippet: snippetAround(c.description, q),
      href: `/c/${c.id}`,
      updatedAt: c.updatedAt.toISOString(),
    })),
    ...projects.map<SearchResultDTO>((p) => ({
      kind: "project",
      id: p.id,
      title: p.name,
      context: p.collectionId ? (collectionName.get(p.collectionId) ?? "Project") : "Project",
      snippet: snippetAround(p.description, q),
      href: `/p/${p.id}`,
      updatedAt: p.updatedAt.toISOString(),
    })),
    ...pages.map<SearchResultDTO>((pg) => ({
      kind: "page",
      id: pg.id,
      title: pg.title,
      context: pg.project.name,
      snippet: snippetAround(pg.textContent, q),
      href: `/p/${pg.projectId}?page=${pg.id}`,
      updatedAt: pg.updatedAt.toISOString(),
    })),
  ];
  const ql = q.toLowerCase();
  const score = (r: SearchResultDTO) =>
    r.title.toLowerCase() === ql ? 0 : r.title.toLowerCase().startsWith(ql) ? 1 : r.title.toLowerCase().includes(ql) ? 2 : 3;
  return results.sort((a, b) => score(a) - score(b)).slice(0, limit);
}
