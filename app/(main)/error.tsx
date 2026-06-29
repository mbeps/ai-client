"use client";

import { ErrorPage } from "@/components/shared/error-page";
import { RotateCcw, Home } from "lucide-react";

/**
 * Error boundary for main app routes (/chats, /assistants, /projects, /settings).
 * Catches and displays runtime errors within protected routes with recovery options.
 * Renders error page with reset action and link to home.
 *
 * @param error - The thrown error object with optional digest for tracking.
 * @param reset - Function to reset the error boundary and retry rendering.
 * @author Maruf Bepary
 * @see {@link ErrorPage} for error UI presentation.
 */
export default function MainError({
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
