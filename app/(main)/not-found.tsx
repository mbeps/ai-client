import { NotFoundPage } from "@/components/shared/not-found-page";

/**
 * 404 not-found fallback for main app routes.
 * Displays when no matching route is found within the protected (/chats, /assistants, etc.) segment.
 * Renders user-friendly message with link back to home.
 *
 * @author Maruf Bepary
 * @see {@link NotFoundPage} for not-found UI presentation.
 */
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
