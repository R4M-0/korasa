"use client";

import { memo, type CSSProperties } from "react";
import { PaperBackground } from "@/components/editor/render/paper-background";
import { ObjectView } from "@/components/editor/render/object-view";
import { pageSize, type Orientation, type PageBackground, type Scene } from "@/lib/editor/scene";

export interface StaticPageProps {
  scene: Scene;
  background: PageBackground;
  orientation: Orientation;
  className?: string;
  style?: CSSProperties;
}

/** A non-interactive A4 sheet at 1:1 page units. Used for thumbnails, print and export. */
export const StaticPage = memo(function StaticPage({ scene, background, orientation, className, style }: StaticPageProps) {
  const { w, h } = pageSize(orientation);
  return (
    <div
      className={className}
      style={{ position: "relative", width: w, height: h, background: "#fffefb", overflow: "hidden", ...style }}
    >
      <PaperBackground background={background} w={w} h={h} />
      {scene.objects.map((o) => (
        <ObjectView key={o.id} obj={o} />
      ))}
    </div>
  );
});

/** A scaled-down sheet for navigators and cards. */
export function PageThumbnail({
  width,
  ...props
}: StaticPageProps & { width: number }) {
  const { w, h } = pageSize(props.orientation);
  const scale = width / w;
  return (
    <div style={{ width, height: h * scale, overflow: "hidden", position: "relative" }} aria-hidden>
      <StaticPage {...props} style={{ transform: `scale(${scale})`, transformOrigin: "0 0", position: "absolute" }} />
    </div>
  );
}
