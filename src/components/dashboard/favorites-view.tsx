"use client";

import { EmptyNote, PageFrame, PageTitle } from "@/components/dashboard/page-frame";
import { FavoritesGrid, useFavorites } from "@/components/dashboard/favorites";
import { WorkspaceGate } from "@/components/dashboard/workspace-gate";

export function FavoritesView() {
  return (
    <PageFrame>
      <PageTitle title="Favorites" description="The courses, projects and pages you keep coming back to." />
      <WorkspaceGate>
        <FavoritesBody />
      </WorkspaceGate>
    </PageFrame>
  );
}

function FavoritesBody() {
  const items = useFavorites();
  if (!items.length)
    return (
      <EmptyNote>
        Nothing starred yet. Use <span className="font-medium text-foreground">Add to favorites</span> from any
        item’s menu.
      </EmptyNote>
    );
  return <FavoritesGrid items={items} />;
}
