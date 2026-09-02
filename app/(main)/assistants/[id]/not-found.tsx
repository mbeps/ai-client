import { Bot } from "lucide-react";
import { NotFoundPage } from "@/components/shared/not-found-page";
import { ROUTES } from "@/constants/routes";

/**
 * Assistant not found page — displays 404 UI when requested assistant does not exist.
 * Shows link back to assistants list.
 */
export default function AssistantNotFound() {
  return (
    <NotFoundPage
      title="Assistant not found"
      description="This assistant does not exist or you don't have access to it."
      linkHref={ROUTES.ASSISTANTS.path}
      linkLabel="Back to assistants"
      linkIcon={Bot}
    />
  );
}
