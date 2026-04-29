"use client";

import { ErrorPage } from "@/components/shared/error-page";
import { RotateCcw, Home } from "lucide-react";

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
