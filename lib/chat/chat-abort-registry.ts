import { getLogger } from "@/lib/logger";

const log = getLogger(["app", "chat", "abort-registry"]);

export interface RegisteredChatAbortHandle {
  controller: AbortController;
  release: () => void;
}

/**
 * Global in-memory registry of AbortControllers for active chat streams.
 * Allows /api/chat/stop to immediately abort the underlying HTTP connection
 * to the AI provider (OpenRouter, etc.) and terminate the Inngest stream loop.
 */
class ChatAbortRegistry {
  private controllers = new Map<string, AbortController>();

  /**
   * Registers a new AbortController for a chat.
   * If an active controller already exists for this chat, aborts it first.
   * Returns the controller and a conditional release handle that only removes
   * the registry entry if this specific controller is still the active one.
   */
  register(chatId: string): RegisteredChatAbortHandle {
    const existing = this.controllers.get(chatId);
    if (existing) {
      log.debug("Aborting previous stream for chat (chatId: {chatId})", {
        chatId,
      });
      existing.abort();
    }
    const controller = new AbortController();
    this.controllers.set(chatId, controller);
    return {
      controller,
      release: () => {
        if (this.controllers.get(chatId) === controller) {
          this.controllers.delete(chatId);
          log.debug("Released active controller for chat (chatId: {chatId})", {
            chatId,
          });
        }
      },
    };
  }

  /**
   * Aborts and removes the controller for a chat.
   * Returns true if a controller was found and aborted.
   */
  abort(chatId: string): boolean {
    const controller = this.controllers.get(chatId);
    if (controller) {
      controller.abort();
      this.controllers.delete(chatId);
      log.info("Aborted active stream (chatId: {chatId})", { chatId });
      return true;
    }
    return false;
  }

  /**
   * Checks whether an active controller exists for a chat.
   */
  has(chatId: string): boolean {
    return this.controllers.has(chatId);
  }

  /**
   * Removes the controller for a chat upon normal completion.
   */
  delete(chatId: string): void {
    this.controllers.delete(chatId);
  }
}

export const chatAbortRegistry = new ChatAbortRegistry();
