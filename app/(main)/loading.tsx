import { CardGridSkeleton } from "@/components/skeletons/card-grid-skeleton";

/**
 * Loading skeleton fallback for main app routes during async page transitions.
 * Displays content-aware card grid skeleton while route data loads.
 * Used by Next.js automatically during dynamic route rendering.
 *
 * @author Maruf Bepary
 */
export default function MainLoading() {
  return <CardGridSkeleton />;
}
