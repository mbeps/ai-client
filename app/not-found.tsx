import { NotFoundPage } from "@/components/shared/not-found-page";
import { ROUTES } from "@/constants/routes";

/**
 * Global 404 not-found fallback for the entire application.
 * Displays when no matching route is found across the site.
 * Renders user-friendly message with link back to home.
 *
 * @see {@link NotFoundPage} for not-found UI presentation.
 */
export default function RootNotFound() {
  return (
    <NotFoundPage
      title="Page not found"
      description="The page you are looking for does not exist or has been moved."
      linkHref={ROUTES.HOME.path}
      linkLabel="Go home"
    />
  );
}
