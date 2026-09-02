import { Command } from "lucide-react";
import { NotFoundPage } from "@/components/shared/not-found-page";
import { ROUTES } from "@/constants/routes";

/**
 * Prompt not found page — displays 404 UI when requested prompt does not exist.
 * Shows link back to prompts list.
 */
export default function PromptNotFound() {
  return (
    <NotFoundPage
      title="Prompt not found"
      description="This prompt shortcut does not exist or you don't have access to it."
      linkHref={ROUTES.SETTINGS.PROMPTS.path}
      linkLabel="Back to prompts"
      linkIcon={Command}
    />
  );
}
