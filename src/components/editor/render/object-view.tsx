"use client";

import { memo, type CSSProperties, type ReactNode } from "react";
import { ImageOff } from "lucide-react";
import { attachmentUrl } from "@/lib/api/client";
import { FONT_STACKS } from "@/lib/editor/fonts";
import { absolutePoints, arrowheadPath, freehandPath } from "@/lib/editor/geometry";
import { sanitizeHtml } from "@/lib/editor/sanitize";
import type {
  DrawObject,
  ImageObject,
  LinearObject,
  SceneObject,
  ShapeObject,
  StrokeStyle,
  TextObject,
} from "@/lib/editor/scene";

export function dashArray(style: StrokeStyle) {
  const sw = Math.max(style.strokeWidth, 1);
  if (style.dash === "dashed") return `${sw * 4} ${sw * 3}`;
  if (style.dash === "dotted") return `0.01 ${sw * 2.4}`;
  return undefined;
}

function frameStyle(o: SceneObject, autoHeight = false): CSSProperties {
  return {
    position: "absolute",
    left: o.x,
    top: o.y,
    width: o.w,
    // Auto-height text sizes to its content; `h` is a measured cache.
    height: autoHeight ? undefined : o.h,
    transform: o.rotation ? `rotate(${o.rotation}deg)` : undefined,
    opacity: o.opacity,
  };
}

export const textBoxStyle = (o: TextObject): CSSProperties => {
  const hasBg = o.background && o.background !== "transparent";
  return {
    fontSize: o.fontSize,
    fontFamily: FONT_STACKS[o.fontFamily],
    color: o.color,
    textAlign: o.align,
    background: hasBg ? o.background : undefined,
    padding: hasBg ? "12px 14px" : "2px 4px",
    borderRadius: hasBg ? 3 : undefined,
    boxShadow: hasBg ? "0 1px 1px rgba(40,30,10,.08), 0 6px 14px -8px rgba(40,30,10,.35)" : undefined,
    minHeight: "100%",
    lineHeight: o.fontFamily === "hand" ? 1.2 : undefined,
  };
};

function TextContent({ o }: { o: TextObject }) {
  return (
    <div
      className="paper-text"
      style={textBoxStyle(o)}
      dangerouslySetInnerHTML={{ __html: sanitizeHtml(o.html) }}
    />
  );
}

function ImageContent({ o }: { o: ImageObject }) {
  return (
    <>
      {/* eslint-disable-next-line @next/next/no-img-element -- local attachments, sized by the scene */}
      <img
        src={attachmentUrl(o.attachmentId)}
        alt={o.caption || "Image"}
        draggable={false}
        className="block size-full select-none"
        style={{ objectFit: "fill", border: o.border ? "1px solid #d6d3d1" : undefined }}
        onError={(e) => {
          e.currentTarget.style.display = "none";
          e.currentTarget.nextElementSibling?.removeAttribute("hidden");
        }}
      />
      <div hidden className="flex size-full flex-col items-center justify-center gap-1 bg-stone-100 text-xs text-stone-500">
        <ImageOff className="size-5" />
        Image unavailable
      </div>
    </>
  );
}

export function ImageCaption({ o }: { o: ImageObject }) {
  if (!o.caption) return null;
  return (
    <div
      className="absolute left-0 right-0 top-full pt-1.5 text-center text-[13px] italic leading-snug text-stone-600"
      style={{ fontFamily: FONT_STACKS.serif }}
    >
      {o.caption}
    </div>
  );
}

export function ShapeSvg({ o }: { o: ShapeObject }) {
  const { stroke, fill, strokeWidth } = o.style;
  const sw = strokeWidth;
  const inset = sw / 2;
  const w = Math.max(o.w, 1);
  const h = Math.max(o.h, 1);
  const common = {
    stroke: sw > 0 ? stroke : "none",
    strokeWidth: sw,
    fill: fill === "transparent" ? "none" : fill,
    strokeDasharray: dashArray(o.style),
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="absolute inset-0 overflow-visible">
      {o.type === "rect" && (
        <rect
          x={inset}
          y={inset}
          width={Math.max(w - sw, 0)}
          height={Math.max(h - sw, 0)}
          rx={Math.min(o.radius, w / 2, h / 2)}
          {...common}
        />
      )}
      {o.type === "ellipse" && (
        <ellipse cx={w / 2} cy={h / 2} rx={Math.max(w / 2 - inset, 0)} ry={Math.max(h / 2 - inset, 0)} {...common} />
      )}
      {o.type === "diamond" && (
        <polygon points={`${w / 2},${inset} ${w - inset},${h / 2} ${w / 2},${h - inset} ${inset},${h / 2}`} {...common} />
      )}
    </svg>
  );
}

export function ShapeLabel({ o }: { o: ShapeObject }) {
  if (!o.label) return null;
  return (
    <div
      className="absolute inset-0 flex items-center justify-center overflow-hidden px-2 text-center leading-tight whitespace-pre-wrap"
      style={{ color: o.labelColor, fontSize: o.labelSize, fontFamily: FONT_STACKS.sans }}
    >
      {o.label}
    </div>
  );
}

/** Linear objects render in page coordinates (no frame transform). */
export function LinearSvg({ o, hitWidth = 12 }: { o: LinearObject; hitWidth?: number }) {
  const pts = absolutePoints(o).map((p) => ({ x: p.x - o.x, y: p.y - o.y }));
  const d = pts.map((p, i) => `${i ? "L" : "M"}${p.x},${p.y}`).join(" ");
  const sw = o.style.strokeWidth;
  const end = arrowheadPath(o.endArrow, pts[pts.length - 1], pts[pts.length - 2], sw);
  const start = arrowheadPath(o.startArrow, pts[0], pts[1], sw);
  return (
    <svg
      width={Math.max(o.w, 1)}
      height={Math.max(o.h, 1)}
      className="pointer-events-none absolute overflow-visible"
      style={{ left: o.x, top: o.y, opacity: o.opacity }}
      data-object-id={o.id}
    >
      <path d={d} fill="none" stroke="transparent" strokeWidth={hitWidth + sw} style={{ pointerEvents: "stroke" }} />
      <path
        d={d}
        fill="none"
        stroke={o.style.stroke}
        strokeWidth={sw}
        strokeDasharray={dashArray(o.style)}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {[start, end].map(
        (head, i) =>
          head && (
            <path
              key={i}
              d={head.d}
              fill={head.filled ? o.style.stroke : "none"}
              stroke={o.style.stroke}
              strokeWidth={sw}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          ),
      )}
    </svg>
  );
}

export function DrawSvg({ o, path }: { o: DrawObject; path?: string }) {
  const d = path ?? freehandPath(o);
  return (
    <svg
      width={Math.max(o.w, 1)}
      height={Math.max(o.h, 1)}
      viewBox={`0 0 ${o.baseW} ${o.baseH}`}
      preserveAspectRatio="none"
      className="absolute inset-0 overflow-visible"
      style={{ mixBlendMode: o.highlighter ? "multiply" : undefined }}
    >
      <path
        d={d}
        fill={o.stroke}
        fillOpacity={o.highlighter ? 0.38 : 1}
        stroke="transparent"
        strokeWidth={10}
        style={{ pointerEvents: "all" }}
      />
    </svg>
  );
}

const drawPathCache = new WeakMap<DrawObject["points"], string>();
function cachedFreehand(o: DrawObject) {
  let d = drawPathCache.get(o.points);
  if (d === undefined) {
    d = freehandPath(o);
    drawPathCache.set(o.points, d);
  }
  return d;
}

/**
 * Read-only rendering of a scene object. The editor reuses this for every
 * object that isn't currently being edited, so view and export are identical.
 */
export const ObjectView = memo(function ObjectView({
  obj,
  children,
  interactive = false,
}: {
  obj: SceneObject;
  /** Replaces the default content (used for in-place editing). */
  children?: ReactNode;
  interactive?: boolean;
}) {
  if (obj.type === "line" || obj.type === "arrow") return <LinearSvg o={obj} />;

  const pointerEvents = interactive ? (obj.type === "draw" ? "none" : "auto") : "none";
  return (
    <div
      data-object-id={obj.id}
      style={{ ...frameStyle(obj, obj.type === "text" && obj.autoHeight), pointerEvents }}
    >
      {children ??
        (obj.type === "text" ? (
          <TextContent o={obj} />
        ) : obj.type === "image" ? (
          <>
            <ImageContent o={obj} />
            <ImageCaption o={obj} />
          </>
        ) : obj.type === "draw" ? (
          <DrawSvg o={obj} path={cachedFreehand(obj)} />
        ) : (
          <>
            <ShapeSvg o={obj as ShapeObject} />
            <ShapeLabel o={obj as ShapeObject} />
          </>
        ))}
    </div>
  );
});
