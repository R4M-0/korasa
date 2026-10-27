import { CollectionView } from "@/components/courses/collection-view";

// The collection id is read client-side (useParams) inside the shell's
// Suspense boundary, so this route's shell stays instant under cacheComponents.
export default function CollectionPage() {
  return <CollectionView />;
}
