import { getLogger } from "@/lib/logger";

const log = getLogger(["app", "chat", "abort-registry"]);

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
   */
  register(chatId: string): AbortController {
    const existing = this.controllers.get(chatId);
    if (existing) {
      log.debug("Aborting previous stream for chat (chatId: {chatId})", {
        chatId,
      });
      existing.abort();
    }
    const controller = new AbortController();
    this.controllers.set(chatId, controller);
    return controller;
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
   * Removes the controller for a chat upon normal completion.
   */
  delete(chatId: string): void {
    this.controllers.delete(chatId);
  }
}

export const chatAbortRegistry = new ChatAbortRegistry();
