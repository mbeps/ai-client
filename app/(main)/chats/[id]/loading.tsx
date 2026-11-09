import { ChatPageSkeleton } from "@/components/skeletons/chat-page-skeleton";

/**
 * Streaming loading fallback for chat detail page (/chats/[id]).
 * Displays chat header, message bubbles, and composer skeletons while getChat resolves.
 *
 * @author Maruf Bepary
 */
export default function ChatLoading() {
  return <ChatPageSkeleton />;
}
