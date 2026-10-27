import { getStroke } from "perfect-freehand";
import type { Arrowhead, DrawObject, LinearObject, SceneObject } from "@/lib/editor/scene";

export interface Point {
  x: number;
  y: number;
}

export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

export const isLinear = (o: SceneObject): o is LinearObject => o.type === "line" || o.type === "arrow";
export const isShape = (o: SceneObject) => o.type === "rect" || o.type === "ellipse" || o.type === "diamond";
/** Objects that connectors may attach to. */
export const isBindable = (o: SceneObject) => !isLinear(o) && o.type !== "draw";

export function center(b: Box): Point {
  return { x: b.x + b.w / 2, y: b.y + b.h / 2 };
}

export function rotatePoint(p: Point, c: Point, deg: number): Point {
  if (!deg) return p;
  const r = (deg * Math.PI) / 180;
  const cos = Math.cos(r);
  const sin = Math.sin(r);
  const dx = p.x - c.x;
  const dy = p.y - c.y;
  return { x: c.x + dx * cos - dy * sin, y: c.y + dx * sin + dy * cos };
}

/** Axis-aligned bounds of an object after rotation. */
export function objectBounds(o: SceneObject): Box {
  if (!o.rotation) return { x: o.x, y: o.y, w: o.w, h: o.h };
  const c = center(o);
  const corners = [
    { x: o.x, y: o.y },
    { x: o.x + o.w, y: o.y },
    { x: o.x + o.w, y: o.y + o.h },
    { x: o.x, y: o.y + o.h },
  ].map((p) => rotatePoint(p, c, o.rotation));
  return boundsOfPoints(corners);
}

export function boundsOfPoints(points: Point[]): Box {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const p of points) {
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
  }
  if (!Number.isFinite(minX)) return { x: 0, y: 0, w: 0, h: 0 };
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
}

export function unionBounds(boxes: Box[]): Box | null {
  if (!boxes.length) return null;
  return boundsOfPoints(boxes.flatMap((b) => [{ x: b.x, y: b.y }, { x: b.x + b.w, y: b.y + b.h }]));
}

export function boxesIntersect(a: Box, b: Box) {
  return a.x <= b.x + b.w && a.x + a.w >= b.x && a.y <= b.y + b.h && a.y + a.h >= b.y;
}

export function normalizeBox(a: Point, b: Point): Box {
  return { x: Math.min(a.x, b.x), y: Math.min(a.y, b.y), w: Math.abs(b.x - a.x), h: Math.abs(b.y - a.y) };
}

// ------------------------------------------------------------------ linear

export function absolutePoints(o: LinearObject): Point[] {
  return o.points.map(([px, py]) => ({ x: o.x + px, y: o.y + py }));
}

/** Rebuild a linear object's box and relative points from absolute points. */
export function withAbsolutePoints(o: LinearObject, pts: Point[]): LinearObject {
  const b = boundsOfPoints(pts);
  return { ...o, x: b.x, y: b.y, w: b.w, h: b.h, points: pts.map((p) => [p.x - b.x, p.y - b.y]) };
}

/**
 * Point where a ray from the centre of `target` towards `toward` leaves the
 * target's outline, pushed out by `gap`. Works for rotated objects.
 */
export function boundaryPoint(target: SceneObject, toward: Point, gap = 6): Point {
  const c = center(target);
  const local = rotatePoint(toward, c, -target.rotation);
  const dx = local.x - c.x;
  const dy = local.y - c.y;
  const len = Math.hypot(dx, dy);
  if (len < 1e-6) return c;
  const ux = dx / len;
  const uy = dy / len;
  const rx = Math.max(target.w / 2, 1);
  const ry = Math.max(target.h / 2, 1);
  let t: number;
  if (target.type === "ellipse") t = 1 / Math.sqrt((ux / rx) ** 2 + (uy / ry) ** 2);
  else if (target.type === "diamond") t = 1 / (Math.abs(ux) / rx + Math.abs(uy) / ry);
  else t = Math.min(Math.abs(ux) < 1e-9 ? Infinity : rx / Math.abs(ux), Math.abs(uy) < 1e-9 ? Infinity : ry / Math.abs(uy));
  const d = Math.min(t + gap, len);
  return rotatePoint({ x: c.x + ux * d, y: c.y + uy * d }, c, target.rotation);
}

/**
 * Recompute endpoints of bound connectors so they follow their shapes.
 * Returns the same array instance if nothing changed.
 */
export function resolveConnectors(objects: SceneObject[], onlyIds?: Set<string>): SceneObject[] {
  const byId = new Map(objects.map((o) => [o.id, o]));
  let changed = false;
  const next = objects.map((o) => {
    if (!isLinear(o) || (!o.startBinding && !o.endBinding)) return o;
    const s = o.startBinding ? byId.get(o.startBinding.objectId) : undefined;
    const e = o.endBinding ? byId.get(o.endBinding.objectId) : undefined;
    if (onlyIds && !onlyIds.has(o.id) && !(s && onlyIds.has(s.id)) && !(e && onlyIds.has(e.id))) return o;
    const pts = absolutePoints(o);
    const n = pts.length;
    if (s) {
      const ref = n > 2 ? pts[1] : e ? center(e) : pts[n - 1];
      pts[0] = boundaryPoint(s, ref);
    }
    if (e) {
      const ref = n > 2 ? pts[n - 2] : s ? center(s) : pts[0];
      pts[n - 1] = boundaryPoint(e, ref);
    }
    const updated = withAbsolutePoints(o, pts);
    const same = updated.points.every((p, i) => Math.abs(p[0] - o.points[i][0]) < 0.01 && Math.abs(p[1] - o.points[i][1]) < 0.01) &&
      Math.abs(updated.x - o.x) < 0.01 && Math.abs(updated.y - o.y) < 0.01;
    if (same) return o;
    changed = true;
    return updated;
  });
  return changed ? next : objects;
}

/** Remove bindings pointing at objects that no longer exist. */
export function pruneBindings(objects: SceneObject[]): SceneObject[] {
  const ids = new Set(objects.map((o) => o.id));
  let changed = false;
  const next = objects.map((o) => {
    if (!isLinear(o)) return o;
    const sb = o.startBinding && !ids.has(o.startBinding.objectId);
    const eb = o.endBinding && !ids.has(o.endBinding.objectId);
    if (!sb && !eb) return o;
    changed = true;
    return { ...o, startBinding: sb ? null : o.startBinding, endBinding: eb ? null : o.endBinding };
  });
  return changed ? next : objects;
}

export function arrowheadPath(head: Arrowhead, tip: Point, from: Point, strokeWidth: number) {
  if (head === "none") return null;
  const angle = Math.atan2(tip.y - from.y, tip.x - from.x);
  const size = 8 + strokeWidth * 2.2;
  const spread = Math.PI / 7;
  const a1 = { x: tip.x - size * Math.cos(angle - spread), y: tip.y - size * Math.sin(angle - spread) };
  const a2 = { x: tip.x - size * Math.cos(angle + spread), y: tip.y - size * Math.sin(angle + spread) };
  if (head === "arrow") return { d: `M${a1.x},${a1.y} L${tip.x},${tip.y} L${a2.x},${a2.y}`, filled: false };
  if (head === "triangle") return { d: `M${a1.x},${a1.y} L${tip.x},${tip.y} L${a2.x},${a2.y} Z`, filled: true };
  const r = 2.5 + strokeWidth;
  return { d: `M${tip.x - r},${tip.y} a${r},${r} 0 1,0 ${r * 2},0 a${r},${r} 0 1,0 ${-r * 2},0`, filled: true };
}

// ---------------------------------------------------------------- freehand

export function freehandPath(o: Pick<DrawObject, "points" | "strokeWidth" | "highlighter">): string {
  const hasPressure = o.points.some((p) => p[2] !== 0.5 && p[2] > 0);
  const outline = getStroke(o.points, {
    size: o.highlighter ? o.strokeWidth * 4 : o.strokeWidth * 1.6,
    thinning: o.highlighter ? 0 : 0.55,
    smoothing: 0.55,
    streamline: 0.45,
    simulatePressure: !hasPressure && !o.highlighter,
    start: { cap: true },
    end: { cap: true },
  });
  if (!outline.length) return "";
  const avg = (a: number, b: number) => (a + b) / 2;
  let d = `M${outline[0][0].toFixed(2)},${outline[0][1].toFixed(2)} Q`;
  for (let i = 0; i < outline.length; i++) {
    const [x0, y0] = outline[i];
    const [x1, y1] = outline[(i + 1) % outline.length];
    d += `${x0.toFixed(2)},${y0.toFixed(2)} ${avg(x0, x1).toFixed(2)},${avg(y0, y1).toFixed(2)} `;
  }
  return d + "Z";
}

/** Distance from point p to segment ab. */
export function distToSegment(p: Point, a: Point, b: Point) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len2 = dx * dx + dy * dy;
  const t = len2 ? Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2)) : 0;
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}

/** Geometric hit test used by the eraser (page coordinates). */
export function hitTest(o: SceneObject, p: Point, tolerance: number): boolean {
  const local = rotatePoint(p, center(o), -o.rotation);
  if (o.type === "draw") {
    const sx = o.w / o.baseW;
    const sy = o.h / o.baseH;
    const pts = o.points.map(([x, y]) => ({ x: o.x + x * sx, y: o.y + y * sy }));
    const tol = tolerance + o.strokeWidth;
    if (pts.length === 1) return Math.hypot(local.x - pts[0].x, local.y - pts[0].y) <= tol;
    for (let i = 1; i < pts.length; i++) if (distToSegment(local, pts[i - 1], pts[i]) <= tol) return true;
    return false;
  }
  if (isLinear(o)) {
    const pts = absolutePoints(o);
    for (let i = 1; i < pts.length; i++)
      if (distToSegment(local, pts[i - 1], pts[i]) <= tolerance + o.style.strokeWidth) return true;
    return false;
  }
  return (
    local.x >= o.x - tolerance &&
    local.x <= o.x + o.w + tolerance &&
    local.y >= o.y - tolerance &&
    local.y <= o.y + o.h + tolerance
  );
}
