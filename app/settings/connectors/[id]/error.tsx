"use client";

import { RotateCcw, Wrench } from "lucide-react";
import { ErrorPage } from "@/components/shared/error-page";
import { ROUTES } from "@/config/routes";

/**
 * Connector error boundary page — displays error UI when MCP server detail page fails to load.
 * Shows retry button and link back to the connectors list.
 *
 * @author Maruf Bepary
 */
export default function ConnectorError({
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
      heading="Failed to load connector"
      fallbackDescription="This connector could not be loaded. Please try again."
      linkHref={ROUTES.CONNECTORS.path}
      linkLabel="Back to connectors"
      linkIcon={Wrench}
      resetIcon={RotateCcw}
    />
  );
}
