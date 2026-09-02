import { Bot } from "lucide-react";
import { NotFoundPage } from "@/components/shared/not-found-page";
import { ROUTES } from "@/constants/routes";

/**
 * Assistant chat not found page — displays 404 UI when requested assistant chat does not exist.
 * Shows link back to assistants list.
 */
export default function AssistantChatNotFound() {
  return (
    <NotFoundPage
      title="Assistant chat not found"
      description="This chat does not exist or you don't have access to it."
      linkHref={ROUTES.ASSISTANTS.path}
      linkLabel="Back to assistants"
      linkIcon={Bot}
    />
  );
}
