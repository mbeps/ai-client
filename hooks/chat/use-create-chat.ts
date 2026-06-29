"use client";

import { useRouter } from "next/navigation";
import { useAppStore } from "@/lib/store";
import { ROUTES } from "@/constants/routes";

/**
 * Creates new chat sessions and navigates to chat detail page.
 * Integrates with Zustand store createChatDb action to persist chat to database.
 * Routes dynamically based on context: project chat, assistant chat, or standalone chat.
 * Automatically handles database errors and swallows exceptions (logs only).
 *
 * Side effects: Creates database record via store, navigates via router.push().
 * Use case: New chat button handlers, project/assistant chat initialisation.
 * Constraint: Errors are logged; returned function should wrap in try/catch if caller needs to handle.
 *
 * @returns Async function accepting optional title, projectId, assistantId; returns created chat ID.
 * @throws Errors from database creation are logged; should be caught by caller for UI feedback.
 * @see useEntityOptions for managing created chat state mutations (rename, delete).
 * @see ROUTES for route constants.
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
