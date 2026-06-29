/**
 * Chat not found page: 404 fallback for missing or inaccessible chats.
 *
 * Renders when chat UUID doesn't exist or user lacks ownership permission.
 * Provides navigation link back to chat list and contextual 404 message.
 *
 * @author Maruf Bepary
 */
import { NotFoundPage } from "@/components/shared/not-found-page";

export default function ChatNotFound() {
  return (
    <NotFoundPage
      title="Chat not found"
      description="This chat does not exist or you don't have access to it."
      linkHref="/chats"
      linkLabel="Back to chats"
    />
  );
}
