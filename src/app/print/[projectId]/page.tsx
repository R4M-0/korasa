import { Suspense } from "react";
import { PrintView } from "./print-view";

export const metadata = { title: "Print" };

async function PrintRoute(props: PageProps<"/print/[projectId]">) {
  const { projectId } = await props.params;
  const sp = await props.searchParams;
  const pages = typeof sp.pages === "string" ? sp.pages.split(",").filter(Boolean) : [];
  return <PrintView projectId={projectId} pageIds={pages} autoPrint={sp.auto !== "0"} />;
}

// Params are request data; under cacheComponents they must be read inside Suspense.
export default function PrintPage(props: PageProps<"/print/[projectId]">) {
  return (
    <Suspense fallback={<div className="desk-surface min-h-screen" />}>
      <PrintRoute {...props} />
    </Suspense>
  );
}
