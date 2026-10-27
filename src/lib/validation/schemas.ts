import { z } from "zod";
import { BACKGROUNDS, ORIENTATIONS, sceneSchema } from "@/lib/editor/scene";

const name = z.string().trim().min(1, "Name is required").max(120, "Name is too long");
const optionalText = (max: number) => z.string().trim().max(max);
const color = z
  .string()
  .regex(/^#[0-9a-fA-F]{6}$/, "Invalid color")
  .nullable();
const icon = z.string().max(40).nullable();

export const collectionCreateSchema = z.object({
  kind: z.enum(["course", "folder"]),
  name,
  description: optionalText(2000).default(""),
  icon: icon.default(null),
  color: color.default(null),
  term: optionalText(60).nullable().default(null),
  parentId: z.string().nullable().default(null),
});

export const collectionUpdateSchema = z
  .object({
    kind: z.enum(["course", "folder"]),
    name,
    description: optionalText(2000),
    icon,
    color,
    term: optionalText(60).nullable(),
    parentId: z.string().nullable(),
    position: z.number().finite(),
    favorite: z.boolean(),
    restore: z.literal(true),
  })
  .partial();

export const projectCreateSchema = z.object({
  name,
  description: optionalText(2000).default(""),
  icon: icon.default(null),
  color: color.default(null),
  collectionId: z.string().nullable().default(null),
  background: z.enum(BACKGROUNDS).default("ruled"),
});

export const projectUpdateSchema = z
  .object({
    name,
    description: optionalText(2000),
    icon,
    color,
    collectionId: z.string().nullable(),
    position: z.number().finite(),
    viewMode: z.enum(["stack", "free", "single"]),
    favorite: z.boolean(),
    restore: z.literal(true),
    opened: z.literal(true),
  })
  .partial();

export const pageCreateSchema = z.object({
  title: z.string().trim().max(120).optional(),
  afterPageId: z.string().nullable().optional(),
  duplicateOf: z.string().optional(),
  background: z.enum(BACKGROUNDS).optional(),
  orientation: z.enum(ORIENTATIONS).optional(),
});

export const pageUpdateSchema = z
  .object({
    title: z.string().trim().max(120),
    background: z.enum(BACKGROUNDS),
    orientation: z.enum(ORIENTATIONS),
    scene: sceneSchema,
    posX: z.number().finite().nullable(),
    posY: z.number().finite().nullable(),
    position: z.number().finite(),
    favorite: z.boolean(),
    restore: z.literal(true),
    opened: z.literal(true),
  })
  .partial();

export const reorderSchema = z.object({
  kind: z.enum(["collection", "project", "page"]),
  ids: z.array(z.string()).min(1).max(2000),
});
