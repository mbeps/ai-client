import { Workflow } from "lucide-react";
import { NotFoundPage } from "@/components/shared/not-found-page";
import { ROUTES } from "@/config/routes";

/**
 * 404 fallback page when a requested workflow run does not exist or is inaccessible.
 */
export default function WorkflowRunNotFound() {
  return (
    <NotFoundPage
      title="Workflow run not found"
      description="This workflow execution run doesn't exist or you don't have permission to access it."
      linkHref={ROUTES.WORKFLOWS.AUTOMATIONS.path}
      linkLabel="Back to Workflows"
      linkIcon={Workflow}
    />
  );
}
