import { z } from "zod";

/**
 * Korasa scene format (v1).
 *
 * A page's content is a flat, z-ordered list of objects in *page units*:
 * 1 unit = 1 CSS px of an A4 sheet at 96 dpi (794 × 1123 portrait). Objects are
 * positioned by their unrotated bounding box (x, y, w, h) and rotated about
 * their centre. Array order is paint order (last = top).
 *
 * The format is deliberately independent from any rendering engine so the
 * canvas implementation can be replaced without migrating data.
 */

export const SCENE_VERSION = 1;

export const PAGE_SIZE = {
  portrait: { w: 794, h: 1123 },
  landscape: { w: 1123, h: 794 },
} as const;

export type Orientation = keyof typeof PAGE_SIZE;
export const ORIENTATIONS = ["portrait", "landscape"] as const;

export const BACKGROUNDS = ["plain", "ruled", "grid", "dotted", "bordered"] as const;
export type PageBackground = (typeof BACKGROUNDS)[number];

export const FONT_FAMILIES = ["sans", "serif", "hand", "mono"] as const;
export type FontFamily = (typeof FONT_FAMILIES)[number];

export const ARROWHEADS = ["none", "arrow", "triangle", "dot"] as const;
export type Arrowhead = (typeof ARROWHEADS)[number];

const num = z.number().finite();

const baseShape = {
  id: z.string().min(1),
  x: num,
  y: num,
  w: num.nonnegative(),
  h: num.nonnegative(),
  rotation: num.default(0),
  opacity: z.number().min(0).max(1).default(1),
  groupId: z.string().nullable().default(null),
  locked: z.boolean().default(false),
};

const strokeStyle = z.object({
  stroke: z.string().default("#1f1d1a"),
  fill: z.string().default("transparent"),
  strokeWidth: num.min(0).max(64).default(2),
  dash: z.enum(["solid", "dashed", "dotted"]).default("solid"),
});
export type StrokeStyle = z.infer<typeof strokeStyle>;

export const textObjectSchema = z.object({
  ...baseShape,
  type: z.literal("text"),
  /** Sanitised rich-text HTML produced by the text editor. */
  html: z.string().default(""),
  fontSize: num.min(4).max(400).default(18),
  fontFamily: z.enum(FONT_FAMILIES).default("sans"),
  color: z.string().default("#1f1d1a"),
  align: z.enum(["left", "center", "right", "justify"]).default("left"),
  background: z.string().default("transparent"),
  /** When true the box grows vertically with its content. */
  autoHeight: z.boolean().default(true),
});

export const imageObjectSchema = z.object({
  ...baseShape,
  type: z.literal("image"),
  attachmentId: z.string().min(1),
  caption: z.string().default(""),
  naturalW: num.positive().default(1),
  naturalH: num.positive().default(1),
  border: z.boolean().default(false),
});

export const shapeObjectSchema = z.object({
  ...baseShape,
  type: z.enum(["rect", "ellipse", "diamond"]),
  style: strokeStyle.prefault({}),
  radius: num.min(0).default(6),
  /** Plain-text label centred inside the shape. */
  label: z.string().default(""),
  labelColor: z.string().default("#1f1d1a"),
  labelSize: num.min(6).max(120).default(16),
});

const binding = z.object({ objectId: z.string() }).nullable().default(null);

export const linearObjectSchema = z.object({
  ...baseShape,
  type: z.enum(["line", "arrow"]),
  /** Points relative to (x, y). At least two. */
  points: z.array(z.tuple([num, num])).min(2),
  style: strokeStyle.prefault({}),
  startArrow: z.enum(ARROWHEADS).default("none"),
  endArrow: z.enum(ARROWHEADS).default("none"),
  /** Connector bindings: endpoints that follow the bound object. */
  startBinding: binding,
  endBinding: binding,
});

export const drawObjectSchema = z.object({
  ...baseShape,
  type: z.literal("draw"),
  /** [x, y, pressure] relative to the box as it was when drawn (baseW × baseH). */
  points: z.array(z.tuple([num, num, num])).min(1),
  baseW: num.positive(),
  baseH: num.positive(),
  stroke: z.string().default("#1f1d1a"),
  strokeWidth: num.min(0.5).max(80).default(3),
  highlighter: z.boolean().default(false),
});

export const sceneObjectSchema = z.discriminatedUnion("type", [
  textObjectSchema,
  imageObjectSchema,
  shapeObjectSchema,
  linearObjectSchema,
  drawObjectSchema,
]);

export const sceneSchema = z.object({
  version: z.literal(SCENE_VERSION),
  objects: z.array(sceneObjectSchema).max(5000),
});

export type TextObject = z.infer<typeof textObjectSchema>;
export type ImageObject = z.infer<typeof imageObjectSchema>;
export type ShapeObject = z.infer<typeof shapeObjectSchema>;
export type LinearObject = z.infer<typeof linearObjectSchema>;
export type DrawObject = z.infer<typeof drawObjectSchema>;
export type SceneObject = z.infer<typeof sceneObjectSchema>;
export type SceneObjectType = SceneObject["type"];
export type Scene = z.infer<typeof sceneSchema>;

export const emptyScene = (): Scene => ({ version: SCENE_VERSION, objects: [] });

/**
 * Parse a stored scene, migrating older versions when they exist. Invalid
 * objects are dropped individually rather than discarding the whole page.
 */
export function parseScene(input: unknown): Scene {
  let raw: unknown = input;
  if (typeof raw === "string") {
    try {
      raw = JSON.parse(raw);
    } catch {
      return emptyScene();
    }
  }
  const strict = sceneSchema.safeParse(raw);
  if (strict.success) return strict.data;

  const objects: SceneObject[] = [];
  const list = (raw as { objects?: unknown })?.objects;
  if (Array.isArray(list)) {
    for (const item of list) {
      const parsed = sceneObjectSchema.safeParse(item);
      if (parsed.success) objects.push(parsed.data);
    }
  }
  return { version: SCENE_VERSION, objects };
}

export function pageSize(orientation: string) {
  return orientation === "landscape" ? PAGE_SIZE.landscape : PAGE_SIZE.portrait;
}

function stripHtml(html: string) {
  return html
    .replace(/<(br|\/p|\/h[1-6]|\/li|\/pre|\/blockquote)[^>]*>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&");
}

/** Plain text of every textual element in the scene, used for search. */
export function extractSceneText(scene: Scene): string {
  const parts: string[] = [];
  for (const o of scene.objects) {
    if (o.type === "text") parts.push(stripHtml(o.html));
    else if (o.type === "image" && o.caption) parts.push(o.caption);
    else if ((o.type === "rect" || o.type === "ellipse" || o.type === "diamond") && o.label)
      parts.push(o.label);
  }
  return parts
    .join("\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{2,}/g, "\n")
    .trim()
    .slice(0, 100_000);
}

export function attachmentIdsInScene(scene: Scene): string[] {
  return scene.objects.flatMap((o) => (o.type === "image" ? [o.attachmentId] : []));
}
