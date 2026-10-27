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
import type { Orientation, PageBackground, Scene } from "@/lib/editor/scene";

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, {
      ...init,
      headers: init?.body instanceof FormData ? init.headers : { "Content-Type": "application/json", ...init?.headers },
    });
  } catch {
    throw new ApiError("Network error — is the Korasa server running?", 0);
  }
  if (!res.ok) {
    let message = `Request failed (${res.status})`;
    try {
      const body = await res.json();
      if (body?.error) message = body.error;
    } catch {}
    throw new ApiError(message, res.status);
  }
  return res.json() as Promise<T>;
}

const json = (method: string, body?: unknown): RequestInit => ({
  method,
  body: body === undefined ? undefined : JSON.stringify(body),
});

export interface CollectionInput {
  kind: CollectionKind;
  name: string;
  description?: string;
  icon?: string | null;
  color?: string | null;
  term?: string | null;
  parentId?: string | null;
}

export interface CollectionPatch extends Partial<Omit<CollectionInput, "kind">> {
  kind?: CollectionKind;
  position?: number;
  favorite?: boolean;
  restore?: true;
}

export interface ProjectInput {
  name: string;
  description?: string;
  icon?: string | null;
  color?: string | null;
  collectionId?: string | null;
  background?: PageBackground;
}

export interface ProjectPatch extends Partial<Omit<ProjectInput, "background">> {
  position?: number;
  viewMode?: ProjectViewMode;
  favorite?: boolean;
  restore?: true;
  opened?: true;
}

export interface PagePatch {
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
}

export const api = {
  tree: () => request<WorkspaceTreeDTO>("/api/workspace"),

  createCollection: (input: CollectionInput) => request<CollectionDTO>("/api/collections", json("POST", input)),
  updateCollection: (id: string, patch: CollectionPatch) =>
    request<CollectionDTO>(`/api/collections/${id}`, json("PATCH", patch)),
  deleteCollection: (id: string, permanent = false) =>
    request<{ ok: true }>(`/api/collections/${id}${permanent ? "?permanent=1" : ""}`, json("DELETE")),

  createProject: (input: ProjectInput) => request<ProjectDTO>("/api/projects", json("POST", input)),
  project: (id: string) => request<ProjectDocumentDTO>(`/api/projects/${id}`),
  updateProject: (id: string, patch: ProjectPatch) => request<ProjectDTO>(`/api/projects/${id}`, json("PATCH", patch)),
  deleteProject: (id: string, permanent = false) =>
    request<{ ok: true }>(`/api/projects/${id}${permanent ? "?permanent=1" : ""}`, json("DELETE")),

  createPage: (
    projectId: string,
    input: {
      title?: string;
      afterPageId?: string | null;
      duplicateOf?: string;
      background?: PageBackground;
      orientation?: Orientation;
    } = {},
  ) => request<PageDTO>(`/api/projects/${projectId}/pages`, json("POST", input)),
  page: (id: string) => request<PageDTO>(`/api/pages/${id}`),
  updatePage: (id: string, patch: PagePatch, init?: { keepalive?: boolean; signal?: AbortSignal }) =>
    request<PageSummaryDTO & { revision: number }>(`/api/pages/${id}`, { ...json("PATCH", patch), ...init }),
  deletePage: (id: string, permanent = false) =>
    request<{ ok: true }>(`/api/pages/${id}${permanent ? "?permanent=1" : ""}`, json("DELETE")),

  reorder: (kind: "collection" | "project" | "page", ids: string[]) =>
    request<{ ok: true }>("/api/reorder", json("POST", { kind, ids })),

  uploadAttachment: (file: Blob, opts: { filename?: string; projectId?: string; width?: number; height?: number }) => {
    const form = new FormData();
    form.append("file", file, opts.filename ?? (file instanceof File ? file.name : "image"));
    if (opts.projectId) form.append("projectId", opts.projectId);
    if (opts.width) form.append("width", String(opts.width));
    if (opts.height) form.append("height", String(opts.height));
    return request<AttachmentDTO>("/api/attachments", { method: "POST", body: form });
  },

  search: (q: string, signal?: AbortSignal) =>
    request<SearchResultDTO[]>(`/api/search?q=${encodeURIComponent(q)}`, { signal }),

  trash: () => request<TrashDTO>("/api/trash"),
  emptyTrash: () => request<{ ok: true }>("/api/trash", json("DELETE")),

  importProject: (data: unknown, collectionId?: string | null) =>
    request<ProjectDTO>(`/api/import${collectionId ? `?collectionId=${collectionId}` : ""}`, json("POST", data)),
  exportProjectUrl: (id: string) => `/api/projects/${id}/export`,
};

export const attachmentUrl = (id: string) => `/api/attachments/${id}`;
