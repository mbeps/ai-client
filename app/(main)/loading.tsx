import { Spinner } from "@/components/ui/spinner";

/**
 * Loading skeleton for main app routes during async page transitions.
 * Displays centered spinner while route data loads.
 * Used by Next.js automatically during dynamic route rendering.
 *
 * @author Maruf Bepary
 */
export default function MainLoading() {
  return (
    <div className="flex h-full w-full items-center justify-center bg-background">
      <Spinner size="lg" />
    </div>
  );
}
