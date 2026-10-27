import type { Orientation, PageBackground, Scene } from "@/lib/editor/scene";

export type CollectionKind = "course" | "folder";
export type ProjectViewMode = "stack" | "free" | "single";

export interface CollectionDTO {
  id: string;
  kind: CollectionKind;
  parentId: string | null;
  name: string;
  description: string;
  icon: string | null;
  color: string | null;
  term: string | null;
  position: number;
  favoritedAt: string | null;
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PageSummaryDTO {
  id: string;
  projectId: string;
  title: string;
  position: number;
  background: PageBackground;
  orientation: Orientation;
  favoritedAt: string | null;
  lastOpenedAt: string | null;
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PageDTO extends PageSummaryDTO {
  posX: number | null;
  posY: number | null;
  scene: Scene;
  revision: number;
}

export interface ProjectDTO {
  id: string;
  collectionId: string | null;
  name: string;
  description: string;
  icon: string | null;
  color: string | null;
  position: number;
  viewMode: ProjectViewMode;
  favoritedAt: string | null;
  lastOpenedAt: string | null;
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
  pages: PageSummaryDTO[];
}

export interface WorkspaceDTO {
  id: string;
  name: string;
}

export interface WorkspaceTreeDTO {
  workspace: WorkspaceDTO;
  collections: CollectionDTO[];
  projects: ProjectDTO[];
}

export interface ProjectDocumentDTO {
  project: ProjectDTO;
  pages: PageDTO[];
  breadcrumbs: CollectionDTO[];
}

export interface AttachmentDTO {
  id: string;
  url: string;
  filename: string;
  mimeType: string;
  width: number | null;
  height: number | null;
  size: number;
}

export type SearchResultKind = "collection" | "project" | "page";

export interface SearchResultDTO {
  kind: SearchResultKind;
  id: string;
  title: string;
  /** Collection kind for collections. */
  subtype?: CollectionKind;
  /** Breadcrumb-ish context, e.g. "Data Structures / Trees". */
  context: string;
  snippet?: string;
  href: string;
  updatedAt: string;
}

export interface TrashDTO {
  collections: CollectionDTO[];
  projects: ProjectDTO[];
  pages: (PageSummaryDTO & { projectName: string })[];
}
