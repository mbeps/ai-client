"use client";

import { useRouter } from "next/navigation";
import { useAppStore } from "@/lib/store";
import { ROUTES } from "@/lib/routes";

/**
 * Hook to handle new chat creation and navigation.
 * Centralises the logic for creating a chat and redirecting to its detail page.
 *
 * @returns A function to create a new chat.
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
      router.push(ROUTES.CHATS.detail(id));
      return id;
    } catch (error) {
      console.error("Failed to create new chat:", error);
      throw error;
    }
  };

  return createNewChat;
}
