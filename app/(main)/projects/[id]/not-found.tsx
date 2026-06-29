/**
 * Project not found page: 404 fallback for missing or inaccessible projects.
 *
 * Renders when project UUID doesn't exist or user lacks ownership permission.
 * Provides navigation link back to project list and contextual 404 message.
 *
 * @author Maruf Bepary
 */
import { NotFoundPage } from "@/components/shared/not-found-page";

export default function ProjectNotFound() {
  return (
    <NotFoundPage
      title="Project not found"
      description="This project does not exist or you don't have access to it."
      linkHref="/projects"
      linkLabel="Back to projects"
    />
  );
}
