/**
 * Centralised in-memory application state using Zustand.
 * Single source of truth for Projects, Assistants, Knowledge Bases, Chats, and Messages.
 * Separates optimistic UI mutations from database persistence via "Db" suffixed actions.
 *
 * Architecture:
 * - Composed of domain-specific slices (chat, entity) to maintain scalability
 * - All state is hydrated from database on app load via useEffect hooks
 * - Mutations are optimistic (immediate UI update) with async database sync
 * - Database operations fail silently with console logging, preserving offline-first UX
 *
 * Typical data flow:
 * 1. useEffect hook calls loadProjects/loadAssistants/loadChats on mount
 * 2. Database rows are transformed via mappers and loaded into store
 * 3. User actions call optimistic methods (createChat, addMessage) for immediate UI
 * 4. Async "Db" methods persist changes and handle errors gracefully
 *
 * @see useAppStore for the main store hook
 * @see AppState for the full state shape and action interfaces
 * @see ChatSlice and EntitySlice for implementation details
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
 * Manages projects, assistants, knowledge bases, chats, and messages entirely in-memory.
 * Chat data is persisted to PostgreSQL via server actions (non-blocking).
 *
 * Usage:
 * ```
 * const { chats, createChat, addMessage } = useAppStore();
 * const newChatId = createChat();
 * ```
 *
 * Slice composition:
 * - ChatSlice: Message tree operations, branching, persistence
 * - EntitySlice: Projects, Assistants, Prompts, Knowledge Bases, MCP Servers
 *
 * @returns Store with all entity collections and mutation actions
 * @see ChatSlice for chat and message management
 * @see createEntitySlice for projects, assistants, and other entity operations
 * @author Maruf Bepary
 */
export const useAppStore = create<AppState>((...a) => ({
  ...createChatSlice(...a),
  ...createEntitySlice(...a),
}));
