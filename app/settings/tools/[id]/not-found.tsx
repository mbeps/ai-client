import { NotFoundPage } from "@/components/shared/not-found-page";
import { ROUTES } from "@/constants/routes";
import { Wrench } from "lucide-react";

/**
 * Tool not found page — displays 404 UI when requested MCP server does not exist.
 * Shows link back to tools list.
 *
 * @author Maruf Bepary
 */
export default function ToolNotFound() {
  return (
    <NotFoundPage
      title="Tool not found"
      description="This MCP server does not exist or you don't have access to it."
      linkHref={ROUTES.TOOLS.path}
      linkLabel="Back to tools"
      linkIcon={Wrench}
    />
  );
}
