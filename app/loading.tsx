import { Spinner } from "@/components/ui/spinner";

/**
 * Root loading fallback for page transitions.
 * Displays centered spinner while route data loads.
 */
export default function RootLoading() {
  return (
    <div className="flex h-full min-h-screen w-full items-center justify-center bg-background">
      <Spinner size="lg" />
    </div>
  );
}
