import { ChatPageSkeleton } from "@/components/skeletons/chat-page-skeleton";

/**
 * Streaming loading fallback for assistant-scoped chat page (/assistants/[id]/[chatId]).
 *
 * @author Maruf Bepary
 */
export default function AssistantChatLoading() {
  return <ChatPageSkeleton />;
}
