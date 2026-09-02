import { NotFoundPage } from "@/components/shared/not-found-page";
import { ROUTES } from "@/constants/routes";

/**
 * Chat not found page: 404 fallback for missing or inaccessible chats.
 *
 * Renders when chat UUID doesn't exist or user lacks ownership permission.
 * Provides navigation link back to chat list and contextual 404 message.
 *
 * @author Maruf Bepary
 */
export default function ChatNotFound() {
  return (
    <NotFoundPage
      title="Chat not found"
      description="This chat does not exist or you don't have access to it."
      linkHref={ROUTES.CHATS.path}
      linkLabel="Back to chats"
    />
  );
}
