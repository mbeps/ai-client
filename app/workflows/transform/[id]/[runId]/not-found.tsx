import { Play } from "lucide-react";
import { NotFoundPage } from "@/components/shared/not-found-page";
import { ROUTES } from "@/constants/routes";

/**
 * Transform run not found page — displays 404 UI when requested workflow run does not exist.
 * Shows link back to automations list.
 */
export default function TransformRunNotFound() {
  return (
    <NotFoundPage
      title="Automation run not found"
      description="This automation run does not exist or you don't have access to it."
      linkHref={ROUTES.WORKFLOWS.TRANSFORM.path}
      linkLabel="Back to automations"
      linkIcon={Play}
    />
  );
}
