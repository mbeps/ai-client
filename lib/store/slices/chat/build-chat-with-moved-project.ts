import type { Chat } from "@/types/chat/chat";

/**
 * Pure state builder for moving a chat to a project (or clearing project association).
 *
 * @param chat - Existing Chat domain object
 * @param projectId - Target project ID or null
 * @returns Updated Chat domain object
 * @author Maruf Bepary
 */
export function buildChatWithMovedProject(
  chat: Chat,
  projectId: string | null,
): Chat {
  return {
    ...chat,
    projectId,
    updatedAt: new Date(),
  };
}
