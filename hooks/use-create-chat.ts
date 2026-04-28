"use client";

import { useRouter } from "next/navigation";
import { useAppStore } from "@/lib/store";
import { ROUTES } from "@/lib/routes";

/**
 * Creates new chats and navigates to the chat detail page.
 * Integrates with Zustand store to persist chat to database before routing.
 * Routes dynamically to project, assistant, or standalone chat views based on context.
 *
 * @returns Async function that creates chat with optional projectId/assistantId and returns the created chat ID.
 * @throws When database creation fails or navigation fails.
 * @see useEntityOptions for managing chat state mutations.
 * @author Maruf Bepary
 */
export function useCreateChat() {
  const router = useRouter();
  const createChatDb = useAppStore((state) => state.createChatDb);

  const createNewChat = async (
    title: string = "New Chat",
    projectId?: string,
    assistantId?: string,
  ) => {
    try {
      const id = await createChatDb(title, projectId, assistantId);
      router.push(
        projectId
          ? ROUTES.PROJECTS.chat(projectId, id)
          : assistantId
            ? ROUTES.ASSISTANTS.chat(assistantId, id)
            : ROUTES.CHATS.detail(id),
      );
      return id;
    } catch (error) {
      console.error("Failed to create new chat:", error);
      throw error;
    }
  };

  return createNewChat;
}
