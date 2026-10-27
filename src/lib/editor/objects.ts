import { nanoid } from "nanoid";
import {
  absolutePoints,
  boundsOfPoints,
  center,
  isLinear,
  objectBounds,
  rotatePoint,
  unionBounds,
  withAbsolutePoints,
  type Box,
  type Point,
} from "@/lib/editor/geometry";
import type {
  Arrowhead,
  DrawObject,
  FontFamily,
  ImageObject,
  LinearObject,
  SceneObject,
  ShapeObject,
  StrokeStyle,
  TextObject,
} from "@/lib/editor/scene";

export const newId = () => nanoid(12);

export type Tool =
  | "select"
  | "hand"
  | "text"
  | "pen"
  | "highlighter"
  | "eraser"
  | "rect"
  | "ellipse"
  | "diamond"
  | "arrow"
  | "line";

export const SHAPE_TOOLS = ["rect", "ellipse", "diamond"] as const;
export const LINEAR_TOOLS = ["arrow", "line"] as const;

/** Styles applied to newly created objects; updated when the user restyles. */
export interface StyleDefaults {
  stroke: string;
  fill: string;
  strokeWidth: number;
  dash: StrokeStyle["dash"];
  opacity: number;
  penColor: string;
  penWidth: number;
  highlighterColor: string;
  textColor: string;
  fontSize: number;
  fontFamily: FontFamily;
  startArrow: Arrowhead;
  endArrow: Arrowhead;
}

export const DEFAULT_STYLE: StyleDefaults = {
  stroke: "#1f1d1a",
  fill: "transparent",
  strokeWidth: 2,
  dash: "solid",
  opacity: 1,
  penColor: "#1f1d1a",
  penWidth: 3,
  highlighterColor: "#facc15",
  textColor: "#1f1d1a",
  fontSize: 18,
  fontFamily: "sans",
  startArrow: "none",
  endArrow: "arrow",
};

const base = (x: number, y: number, w: number, h: number) => ({
  id: newId(),
  x,
  y,
  w,
  h,
  rotation: 0,
  opacity: 1,
  groupId: null,
  locked: false,
});

export function createText(x: number, y: number, s: StyleDefaults, html = ""): TextObject {
  return {
    ...base(x, y, 320, Math.round(s.fontSize * 1.5 + 4)),
    type: "text",
    html,
    fontSize: s.fontSize,
    fontFamily: s.fontFamily,
    color: s.textColor,
    align: "left",
    background: "transparent",
    autoHeight: true,
  };
}

export function createShape(type: ShapeObject["type"], box: Box, s: StyleDefaults): ShapeObject {
  return {
    ...base(box.x, box.y, box.w, box.h),
    opacity: s.opacity,
    type,
    style: { stroke: s.stroke, fill: s.fill, strokeWidth: s.strokeWidth, dash: s.dash },
    radius: 8,
    label: "",
    labelColor: s.textColor,
    labelSize: 16,
  };
}

export function createLinear(type: "line" | "arrow", a: Point, b: Point, s: StyleDefaults): LinearObject {
  const o: LinearObject = {
    ...base(0, 0, 0, 0),
    opacity: s.opacity,
    type,
    points: [
      [0, 0],
      [0, 0],
    ],
    style: { stroke: s.stroke, fill: "transparent", strokeWidth: s.strokeWidth, dash: s.dash },
    startArrow: type === "arrow" ? s.startArrow : "none",
    endArrow: type === "arrow" ? (s.endArrow === "none" ? "arrow" : s.endArrow) : "none",
    startBinding: null,
    endBinding: null,
  };
  return withAbsolutePoints(o, [a, b]);
}

/** Build a freehand object from absolute [x, y, pressure] samples. */
export function createDraw(samples: [number, number, number][], s: StyleDefaults, highlighter: boolean): DrawObject {
  const b = boundsOfPoints(samples.map(([x, y]) => ({ x, y })));
  const w = Math.max(b.w, 1);
  const h = Math.max(b.h, 1);
  return {
    ...base(b.x, b.y, w, h),
    type: "draw",
    points: samples.map(([x, y, p]) => [x - b.x, y - b.y, p]),
    baseW: w,
    baseH: h,
    stroke: highlighter ? s.highlighterColor : s.penColor,
    strokeWidth: highlighter ? Math.max(s.penWidth, 4) : s.penWidth,
    highlighter,
  };
}

export function createImage(
  attachmentId: string,
  natural: { w: number; h: number },
  at: Point,
  maxW: number,
): ImageObject {
  const scale = Math.min(1, maxW / natural.w);
  const w = Math.round(natural.w * scale);
  const h = Math.round(natural.h * scale);
  return {
    ...base(Math.round(at.x - w / 2), Math.round(at.y - h / 2), w, h),
    type: "image",
    attachmentId,
    caption: "",
    naturalW: natural.w,
    naturalH: natural.h,
    border: false,
  };
}

// ------------------------------------------------------------ transforms

export function translateObject<T extends SceneObject>(o: T, dx: number, dy: number): T {
  return { ...o, x: o.x + dx, y: o.y + dy };
}

/** Scale an object's box from an anchor point (used for multi-selection resize). */
export function scaleObject(o: SceneObject, anchor: Point, sx: number, sy: number): SceneObject {
  if (isLinear(o)) {
    const pts = absolutePoints(o).map((p) => ({ x: anchor.x + (p.x - anchor.x) * sx, y: anchor.y + (p.y - anchor.y) * sy }));
    return withAbsolutePoints(o, pts);
  }
  const c = center(o);
  const nc = { x: anchor.x + (c.x - anchor.x) * sx, y: anchor.y + (c.y - anchor.y) * sy };
  const w = Math.max(2, o.w * Math.abs(sx));
  const h = Math.max(2, o.h * Math.abs(sy));
  const next = { ...o, x: nc.x - w / 2, y: nc.y - h / 2, w, h };
  if (o.type === "text") {
    const f = Math.sqrt(Math.abs(sx * sy));
    return { ...next, fontSize: Math.max(4, Math.round(o.fontSize * f * 10) / 10) } as TextObject;
  }
  return next;
}

/** Rotate an object about an external pivot by `deg` degrees. */
export function rotateObjectAround(o: SceneObject, pivot: Point, deg: number): SceneObject {
  if (isLinear(o)) {
    return withAbsolutePoints(o, absolutePoints(o).map((p) => rotatePoint(p, pivot, deg)));
  }
  const c = center(o);
  const nc = rotatePoint(c, pivot, deg);
  return { ...o, x: nc.x - o.w / 2, y: nc.y - o.h / 2, rotation: normalizeAngle(o.rotation + deg) };
}

export function normalizeAngle(deg: number) {
  let a = deg % 360;
  if (a > 180) a -= 360;
  if (a <= -180) a += 360;
  return Math.round(a * 100) / 100;
}

export function selectionBounds(objects: SceneObject[]): Box | null {
  return unionBounds(objects.map(objectBounds));
}

/** Expand a selection to include whole groups. */
export function expandGroups(all: SceneObject[], ids: string[]): string[] {
  const groups = new Set(all.filter((o) => ids.includes(o.id) && o.groupId).map((o) => o.groupId));
  if (!groups.size) return ids;
  const out = new Set(ids);
  for (const o of all) if (o.groupId && groups.has(o.groupId)) out.add(o.id);
  return [...out];
}

/** Clone objects with fresh ids, remapping groups and internal bindings. */
export function cloneObjects(objects: SceneObject[], dx: number, dy: number): SceneObject[] {
  const idMap = new Map(objects.map((o) => [o.id, newId()]));
  const groupMap = new Map<string, string>();
  return objects.map((o) => {
    const groupId = o.groupId ? (groupMap.get(o.groupId) ?? groupMap.set(o.groupId, newId()).get(o.groupId)!) : null;
    const copy = { ...translateObject(o, dx, dy), id: idMap.get(o.id)!, groupId } as SceneObject;
    if (isLinear(copy)) {
      copy.startBinding = copy.startBinding && idMap.has(copy.startBinding.objectId)
        ? { objectId: idMap.get(copy.startBinding.objectId)! }
        : null;
      copy.endBinding = copy.endBinding && idMap.has(copy.endBinding.objectId)
        ? { objectId: idMap.get(copy.endBinding.objectId)! }
        : null;
    }
    return copy;
  });
}

export type ZOrderAction = "front" | "forward" | "backward" | "back";

export function reorderObjects(objects: SceneObject[], ids: Set<string>, action: ZOrderAction): SceneObject[] {
  const selected = objects.filter((o) => ids.has(o.id));
  const rest = objects.filter((o) => !ids.has(o.id));
  if (!selected.length) return objects;
  if (action === "front") return [...rest, ...selected];
  if (action === "back") return [...selected, ...rest];
  const arr = [...objects];
  if (action === "forward") {
    for (let i = arr.length - 2; i >= 0; i--) {
      if (ids.has(arr[i].id) && !ids.has(arr[i + 1].id)) [arr[i], arr[i + 1]] = [arr[i + 1], arr[i]];
    }
  } else {
    for (let i = 1; i < arr.length; i++) {
      if (ids.has(arr[i].id) && !ids.has(arr[i - 1].id)) [arr[i], arr[i - 1]] = [arr[i - 1], arr[i]];
    }
  }
  return arr;
}

export function objectLabel(o: SceneObject): string {
  switch (o.type) {
    case "text":
      return "Text";
    case "image":
      return "Image";
    case "rect":
      return "Rectangle";
    case "ellipse":
      return "Ellipse";
    case "diamond":
      return "Diamond";
    case "arrow":
      return o.startBinding || o.endBinding ? "Connector" : "Arrow";
    case "line":
      return "Line";
    case "draw":
      return o.highlighter ? "Highlight" : "Drawing";
  }
}
