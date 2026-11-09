import { AppShellSkeleton } from "@/components/skeletons/app-shell-skeleton";

/**
 * Root loading fallback for page transitions.
 * Displays content-aware application shell skeleton while route data loads.
 *
 * @author Maruf Bepary
 */
export default function RootLoading() {
  return <AppShellSkeleton />;
}
