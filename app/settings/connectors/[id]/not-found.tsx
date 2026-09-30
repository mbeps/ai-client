import { Wrench } from "lucide-react";
import { NotFoundPage } from "@/components/shared/not-found-page";
import { ROUTES } from "@/config/routes";

/**
 * Connector not found page — displays 404 UI when requested MCP server does not exist.
 * Shows link back to the connectors list.
 *
 * @author Maruf Bepary
 */
export default function ConnectorNotFound() {
  return (
    <NotFoundPage
      title="Connector not found"
      description="This MCP server does not exist or you don't have access to it."
      linkHref={ROUTES.CONNECTORS.path}
      linkLabel="Back to connectors"
      linkIcon={Wrench}
    />
  );
}
