import { useId } from "react";
import type { PageBackground } from "@/lib/editor/scene";

/**
 * Vector paper pattern. Rendered as SVG so it stays crisp when zoomed,
 * printed, or exported.
 */
export function PaperBackground({ background, w, h }: { background: PageBackground; w: number; h: number }) {
  const id = useId().replace(/:/g, "");
  if (background === "plain") return null;

  const line = "#9db4d6";
  return (
    <svg
      aria-hidden
      width={w}
      height={h}
      viewBox={`0 0 ${w} ${h}`}
      className="pointer-events-none absolute inset-0"
      style={{ printColorAdjust: "exact", WebkitPrintColorAdjust: "exact" }}
    >
      {background === "ruled" && (
        <>
          <defs>
            <pattern id={`ruled-${id}`} width={w} height={30} patternUnits="userSpaceOnUse" y={96 % 30}>
              <line x1={0} x2={w} y1={29.5} y2={29.5} stroke={line} strokeWidth={0.8} opacity={0.75} />
            </pattern>
          </defs>
          <rect x={0} y={96} width={w} height={h - 96 - 40} fill={`url(#ruled-${id})`} />
          <line x1={64} x2={64} y1={0} y2={h} stroke="#e8908a" strokeWidth={1} opacity={0.8} />
        </>
      )}
      {background === "grid" && (
        <>
          <defs>
            <pattern id={`grid-${id}`} width={20} height={20} patternUnits="userSpaceOnUse">
              <path d="M20 0H0V20" fill="none" stroke={line} strokeWidth={0.5} opacity={0.6} />
            </pattern>
            <pattern id={`grid5-${id}`} width={100} height={100} patternUnits="userSpaceOnUse">
              <path d="M100 0H0V100" fill="none" stroke={line} strokeWidth={0.9} opacity={0.55} />
            </pattern>
          </defs>
          <rect width={w} height={h} fill={`url(#grid-${id})`} />
          <rect width={w} height={h} fill={`url(#grid5-${id})`} />
        </>
      )}
      {background === "dotted" && (
        <>
          <defs>
            <pattern id={`dot-${id}`} width={24} height={24} patternUnits="userSpaceOnUse" x={1} y={1}>
              <circle cx={12} cy={12} r={1.15} fill="#8f9bb0" opacity={0.75} />
            </pattern>
          </defs>
          <rect width={w} height={h} fill={`url(#dot-${id})`} />
        </>
      )}
      {background === "bordered" && (
        <rect x={38} y={38} width={w - 76} height={h - 76} fill="none" stroke="#b9b2a6" strokeWidth={1} />
      )}
    </svg>
  );
}

export const BACKGROUND_LABELS: Record<PageBackground, string> = {
  plain: "Plain",
  ruled: "Ruled",
  grid: "Graph",
  dotted: "Dotted",
  bordered: "Bordered",
};
