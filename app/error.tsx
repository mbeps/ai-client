"use client";

import { Home, RotateCcw } from "lucide-react";
import { ErrorPage } from "@/components/shared/error-page";

/**
 * Global root error boundary for application routes.
 * Catches unhandled runtime exceptions and presents recovery options.
 */
export default function RootError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <ErrorPage
      error={error}
      reset={reset}
      heading="Something went wrong"
      fallbackDescription="An unexpected error occurred. Please try again."
      linkHref="/"
      linkLabel="Go home"
      linkIcon={Home}
      resetIcon={RotateCcw}
    />
  );
}
