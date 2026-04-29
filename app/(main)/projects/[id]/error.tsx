"use client";

import { ErrorPage } from "@/components/shared/error-page";

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
