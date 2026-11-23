import { Workflow } from "lucide-react";
import { NotFoundPage } from "@/components/shared/not-found-page";
import { ROUTES } from "@/config/routes";

/**
 * 404 fallback page when a requested workflow does not exist or is inaccessible.
 */
export default function WorkflowNotFound() {
  return (
    <NotFoundPage
      title="Workflow not found"
      description="This workflow doesn't exist or may have been deleted."
      linkHref={ROUTES.WORKFLOWS.AUTOMATIONS.path}
      linkLabel="Back to Workflows"
      linkIcon={Workflow}
    />
  );
}
