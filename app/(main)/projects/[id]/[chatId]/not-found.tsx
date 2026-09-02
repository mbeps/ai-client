import { FolderKanban } from "lucide-react";
import { NotFoundPage } from "@/components/shared/not-found-page";
import { ROUTES } from "@/constants/routes";

/**
 * Project chat not found page — displays 404 UI when requested project chat does not exist.
 * Shows link back to projects list.
 */
export default function ProjectChatNotFound() {
  return (
    <NotFoundPage
      title="Project chat not found"
      description="This chat does not exist or you don't have access to it."
      linkHref={ROUTES.PROJECTS.path}
      linkLabel="Back to projects"
      linkIcon={FolderKanban}
    />
  );
}
