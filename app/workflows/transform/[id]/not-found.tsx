import { NotFoundPage } from "@/components/shared/not-found-page";
import { ROUTES } from "@/constants/routes";
import { List } from "lucide-react";

/**
 * Transform automation not found page — displays 404 UI when requested automation does not exist.
 * Shows link back to automations list.
 */
export default function TransformAgentNotFound() {
  return (
    <NotFoundPage
      title="Automation not found"
      description="This step-by-step automation does not exist or you don't have access to it."
      linkHref={ROUTES.WORKFLOWS.TRANSFORM.path}
      linkLabel="Back to automations"
      linkIcon={List}
    />
  );
}
