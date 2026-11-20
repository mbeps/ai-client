import { ChatPageSkeleton } from "@/components/skeletons/chat-page-skeleton";

/**
 * Streaming loading fallback for agent-scoped chat page (/agents/[id]/[chatId]).
 */
export default function AgentChatLoading() {
  return <ChatPageSkeleton />;
}
