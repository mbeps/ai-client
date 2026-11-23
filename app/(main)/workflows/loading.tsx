import { CardGridSkeleton } from "@/components/skeletons/card-grid-skeleton";

/**
 * Loading skeleton matching the visual workflows list layout.
 */
export default function WorkflowsLoading() {
  return <CardGridSkeleton columns={2} count={4} />;
}
