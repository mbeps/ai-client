import { Bot } from "lucide-react";
import { NotFoundPage } from "@/components/shared/not-found-page";
import { ROUTES } from "@/config/routes";

/**
 * Agent chat not found page — displays 404 UI when requested agent chat does not exist.
 */
export default function AgentChatNotFound() {
  return (
    <NotFoundPage
      title="Agent chat not found"
      description="This chat does not exist or you don't have access to it."
      linkHref={ROUTES.AGENTS.path}
      linkLabel="Back to agents"
      linkIcon={Bot}
    />
  );
}
