import { CardGridSkeleton } from "@/components/skeletons/card-grid-skeleton";

/**
 * Streaming loading fallback for transform agents list page (/transform).
 *
 * @author Maruf Bepary
 */
export default function TransformLoading() {
  return <CardGridSkeleton columns={2} />;
}
