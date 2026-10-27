"use client";

import { memo } from "react";
import { absolutePoints, isLinear, objectBounds } from "@/lib/editor/geometry";
import { selectionBounds } from "@/lib/editor/objects";
import type { SceneObject } from "@/lib/editor/scene";
import { useEditorStore } from "@/stores/editor-store";

export type HandleKind = "nw" | "n" | "ne" | "e" | "se" | "s" | "sw" | "w" | "rotate" | "start" | "end";

const HANDLE_CURSORS: Record<string, string> = {
  nw: "nwse-resize",
  se: "nwse-resize",
  ne: "nesw-resize",
  sw: "nesw-resize",
  n: "ns-resize",
  s: "ns-resize",
  e: "ew-resize",
  w: "ew-resize",
};

/** Rotate a resize cursor to match the object's rotation (in 45° steps). */
function cursorFor(handle: string, rotation: number) {
  const order = ["n", "ne", "e", "se", "s", "sw", "w", "nw"];
  const idx = order.indexOf(handle);
  if (idx === -1) return "crosshair";
  const shifted = order[(idx + Math.round(rotation / 45) + 8) % 8];
  return HANDLE_CURSORS[shifted];
}

function Handles({
  box,
  rotation,
  zoom,
  kinds,
  pageId,
}: {
  box: { x: number; y: number; w: number; h: number };
  rotation: number;
  zoom: number;
  kinds: HandleKind[];
  pageId: string;
}) {
  const s = 9 / zoom;
  const pos: Record<string, [number, number]> = {
    nw: [0, 0],
    n: [0.5, 0],
    ne: [1, 0],
    e: [1, 0.5],
    se: [1, 1],
    s: [0.5, 1],
    sw: [0, 1],
    w: [0, 0.5],
  };
  return (
    <div
      className="absolute"
      style={{
        left: box.x,
        top: box.y,
        width: box.w,
        height: box.h,
        transform: rotation ? `rotate(${rotation}deg)` : undefined,
      }}
    >
      <div className="absolute inset-0" style={{ outline: `${1.5 / zoom}px solid var(--selection)` }} />
      {kinds.includes("rotate") && (
        <>
          <div
            className="absolute left-1/2 bg-[var(--selection)]"
            style={{ width: 1 / zoom, height: 18 / zoom, top: -18 / zoom, transform: "translateX(-50%)" }}
          />
          <div
            data-handle="rotate"
            data-page-id={pageId}
            title="Rotate (Shift snaps to 15°)"
            className="pointer-events-auto absolute left-1/2 rounded-full border bg-white"
            style={{
              width: s * 1.25,
              height: s * 1.25,
              top: -18 / zoom - s * 1.25,
              transform: "translateX(-50%)",
              borderWidth: 1.5 / zoom,
              borderColor: "var(--selection)",
              cursor: "grab",
            }}
          />
        </>
      )}
      {kinds
        .filter((k) => k in pos)
        .map((k) => (
          <div
            key={k}
            data-handle={k}
            data-page-id={pageId}
            className="pointer-events-auto absolute bg-white"
            style={{
              width: s,
              height: s,
              left: `calc(${pos[k][0] * 100}% - ${s / 2}px)`,
              top: `calc(${pos[k][1] * 100}% - ${s / 2}px)`,
              border: `${1.5 / zoom}px solid var(--selection)`,
              borderRadius: 2 / zoom,
              cursor: cursorFor(k, rotation),
            }}
          />
        ))}
    </div>
  );
}

function LinearHandles({ o, zoom, pageId }: { o: SceneObject & { type: "line" | "arrow" }; zoom: number; pageId: string }) {
  const pts = absolutePoints(o);
  const s = 11 / zoom;
  const ends: [HandleKind, (typeof pts)[number], boolean][] = [
    ["start", pts[0], !!o.startBinding],
    ["end", pts[pts.length - 1], !!o.endBinding],
  ];
  return (
    <>
      {ends.map(([k, p, bound]) => (
        <div
          key={k}
          data-handle={k}
          data-page-id={pageId}
          title={bound ? "Attached — drag to detach" : "Drag onto a shape to attach"}
          className="pointer-events-auto absolute rounded-full"
          style={{
            left: p.x - s / 2,
            top: p.y - s / 2,
            width: s,
            height: s,
            background: bound ? "var(--selection)" : "white",
            border: `${1.5 / zoom}px solid var(--selection)`,
            cursor: "move",
          }}
        />
      ))}
    </>
  );
}

function resizeKinds(o: SceneObject): HandleKind[] {
  if (o.type === "text") return ["nw", "ne", "se", "sw", "e", "w", "rotate"];
  return ["nw", "n", "ne", "e", "se", "s", "sw", "w", "rotate"];
}

/**
 * Selection chrome for one page. Rendered outside the paper's clip so handles
 * stay usable at the sheet edge; sizes are divided by zoom to stay constant
 * on screen.
 */
export const SelectionOverlay = memo(function SelectionOverlay({ pageId, objects }: { pageId: string; objects: SceneObject[] }) {
  const zoom = useEditorStore((s) => s.viewport.zoom);
  const ids = useEditorStore((s) => (s.selection.pageId === pageId ? s.selection.ids : null));
  const editingId = useEditorStore((s) => s.editing?.id ?? null);
  const marquee = useEditorStore((s) => (s.marquee?.pageId === pageId ? s.marquee.box : null));
  const bindTarget = useEditorStore((s) => s.bindTarget);
  const tool = useEditorStore((s) => s.tool);

  const selected = ids?.length ? objects.filter((o) => ids.includes(o.id)) : [];
  const bindObj = bindTarget ? objects.find((o) => o.id === bindTarget) : undefined;

  let chrome: React.ReactNode = null;
  if (selected.length === 1 && tool === "select") {
    const o = selected[0];
    if (isLinear(o)) chrome = o.locked ? null : <LinearHandles o={o} zoom={zoom} pageId={pageId} />;
    else if (o.locked || o.id === editingId)
      chrome = (
        <div
          className="absolute"
          style={{
            left: o.x,
            top: o.y,
            width: o.w,
            height: o.h,
            transform: o.rotation ? `rotate(${o.rotation}deg)` : undefined,
            outline: `${1.5 / zoom}px ${o.locked ? "dashed" : "solid"} var(--selection)`,
            outlineOffset: o.id === editingId ? 3 / zoom : 0,
          }}
        />
      );
    else chrome = <Handles box={o} rotation={o.rotation} zoom={zoom} kinds={resizeKinds(o)} pageId={pageId} />;
  } else if (selected.length > 1) {
    const b = selectionBounds(selected)!;
    chrome = (
      <>
        {selected.map((o) => {
          const ob = objectBounds(o);
          return (
            <div
              key={o.id}
              className="absolute"
              style={{ left: ob.x, top: ob.y, width: ob.w, height: ob.h, outline: `${1 / zoom}px solid color-mix(in oklch, var(--selection) 55%, transparent)` }}
            />
          );
        })}
        {tool === "select" && (
          <Handles box={b} rotation={0} zoom={zoom} kinds={["nw", "n", "ne", "e", "se", "s", "sw", "w", "rotate"]} pageId={pageId} />
        )}
      </>
    );
  }

  return (
    <div className="pointer-events-none absolute inset-0 overflow-visible">
      {bindObj && (
        <div
          className="absolute rounded-sm"
          style={{
            left: bindObj.x - 4 / zoom,
            top: bindObj.y - 4 / zoom,
            width: bindObj.w + 8 / zoom,
            height: bindObj.h + 8 / zoom,
            transform: bindObj.rotation ? `rotate(${bindObj.rotation}deg)` : undefined,
            outline: `${2 / zoom}px solid color-mix(in oklch, var(--selection) 60%, transparent)`,
            background: "color-mix(in oklch, var(--selection) 8%, transparent)",
          }}
        />
      )}
      {chrome}
      {marquee && (
        <div
          className="absolute"
          style={{
            left: marquee.x,
            top: marquee.y,
            width: marquee.w,
            height: marquee.h,
            background: "color-mix(in oklch, var(--selection) 10%, transparent)",
            outline: `${1 / zoom}px solid color-mix(in oklch, var(--selection) 70%, transparent)`,
          }}
        />
      )}
    </div>
  );
});
