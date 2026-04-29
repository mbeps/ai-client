"use client";

import { ErrorPage } from "@/components/shared/error-page";
import { ROUTES } from "@/constants/routes";
import { RotateCcw, Wrench } from "lucide-react";

export default function ToolError({
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
      heading="Failed to load tool"
      fallbackDescription="This tool could not be loaded. Please try again."
      linkHref={ROUTES.TOOLS.path}
      linkLabel="Back to tools"
      linkIcon={Wrench}
      resetIcon={RotateCcw}
    />
  );
}
