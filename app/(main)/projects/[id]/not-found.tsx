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
