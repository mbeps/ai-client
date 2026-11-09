import { ChatPageSkeleton } from "@/components/skeletons/chat-page-skeleton";

/**
 * Streaming loading fallback for project-scoped chat page (/projects/[id]/[chatId]).
 *
 * @author Maruf Bepary
 */
export default function ProjectChatLoading() {
  return <ChatPageSkeleton />;
}
