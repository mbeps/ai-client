/**
 * Centralised in-memory application state using Zustand.
 * Single source of truth for Projects, Assistants, Knowledge Bases, Chats, and Messages.
 * Chat data is persisted to the database via server actions.
 *
 * @see useAppStore for the main store hook
 * @author Maruf Bepary
 */
import { create } from "zustand";
import { createChatSlice } from "./slices/chat-slice";
import { createEntitySlice } from "./slices/entity-slice";
import type { AppState } from "@/types/app-state";

// Re-export specific types if needed, or let components import from @/types directly.
export type { AppState };

/**
 * Global Zustand store hook for the AI chat client.
 * Manages projects, assistants, knowledge bases, and chats entirely in-memory.
 * Chat data is persisted to the database via server actions.
 *
 * This store is composed of domain-specific slices to maintain scalability.
 *
 * @author Maruf Bepary
 */
export const useAppStore = create<AppState>((...a) => ({
  ...createChatSlice(...a),
  ...createEntitySlice(...a),
}));
