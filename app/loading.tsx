import { Spinner } from "@/components/ui/spinner";

/**
 * Root loading fallback for page transitions.
 * Displays centered spinner while route data loads.
 */
export default function RootLoading() {
  return (
    <div className="bg-background flex h-full min-h-screen w-full items-center justify-center">
      <Spinner size="lg" />
    </div>
  );
}
