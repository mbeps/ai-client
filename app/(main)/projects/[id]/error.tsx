"use client";

import { ErrorPage } from "@/components/shared/error-page";

/**
 * Project page error boundary: Graceful error handling for failed project loads.
 *
 * Displays error message when project fails to load (database error, auth failure, etc).
 * Provides reset button to retry and link back to project list. Uses shared ErrorPage layout.
 *
 * @author Maruf Bepary
 */
export default function ProjectError({
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
      heading="Failed to load project"
      fallbackDescription="This project could not be loaded. Please try again."
      linkHref="/projects"
      linkLabel="Back to projects"
    />
  );
}
