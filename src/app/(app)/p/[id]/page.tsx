"use client";

import { Suspense } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { ProjectEditor } from "@/components/editor/editor";

function EditorRoute() {
  const { id } = useParams<{ id: string }>();
  const page = useSearchParams().get("page");
  return <ProjectEditor projectId={id} pageId={page} />;
}

export default function ProjectPage() {
  return (
    <Suspense>
      <EditorRoute />
    </Suspense>
  );
}
