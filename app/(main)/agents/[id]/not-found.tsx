import { Bot } from "lucide-react";
import { NotFoundPage } from "@/components/shared/not-found-page";
import { ROUTES } from "@/config/routes";

/**
 * Agent not found page — displays 404 UI when requested agent does not exist.
 */
export default function AgentNotFound() {
  return (
    <NotFoundPage
      title="Agent not found"
      description="This agent does not exist or you don't have access to it."
      linkHref={ROUTES.AGENTS.path}
      linkLabel="Back to agents"
      linkIcon={Bot}
    />
  );
}
