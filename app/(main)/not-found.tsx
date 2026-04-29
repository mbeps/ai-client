import { NotFoundPage } from "@/components/shared/not-found-page";

export default function MainNotFound() {
  return (
    <NotFoundPage
      title="Page not found"
      description="The page you are looking for does not exist or has been moved."
      linkHref="/"
      linkLabel="Go home"
    />
  );
}
