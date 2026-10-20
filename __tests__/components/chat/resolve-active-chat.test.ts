import { describe, expect, it, vi } from "vitest";

// Mock CSS imports for jsdom
vi.mock("katex/dist/katex.min.css", () => ({}));
vi.mock("@blocknote/mantine/style.css", () => ({}));
vi.mock("@blocknote/core/fonts/inter.css", () => ({}));

import { resolveActiveChat } from "@/components/chat/chat-ui";
import type { Chat } from "@/types/chat/chat";

describe("resolveActiveChat", () => {
  const storeChatWithMessages: Chat = {
    id: "chat-1",
    userId: "user-1",
    title: "Hydrated Store Chat",
    createdAt: new Date(),
    updatedAt: new Date(),
    currentLeafId: "msg-1",
    messages: {
      "msg-1": {
        id: "msg-1",
        chatId: "chat-1",
        role: "user",
        content: "Hello",
        parentId: null,
        childrenIds: [],
        createdAt: new Date(),
        metadata: null,
      },
    },
  };

  const storeChatEmpty: Chat = {
    id: "chat-1",
    userId: "user-1",
    title: "Empty Store Chat",
    createdAt: new Date(),
    updatedAt: new Date(),
    currentLeafId: null,
    messages: {},
  };

  const initialChat: Chat = {
    id: "chat-1",
    userId: "user-1",
    title: "Server Pre-fetched Chat",
    createdAt: new Date(),
    updatedAt: new Date(),
    currentLeafId: "msg-init",
    messages: {
      "msg-init": {
        id: "msg-init",
        chatId: "chat-1",
        role: "user",
        content: "Initial message",
        parentId: null,
        childrenIds: [],
        createdAt: new Date(),
        metadata: null,
      },
    },
  };

  it("returns storeChat if storeChat has messages", () => {
    const result = resolveActiveChat(storeChatWithMessages, initialChat, "chat-1");
    expect(result).toBe(storeChatWithMessages);
  });

  it("returns initialChat if storeChat is empty but initialChat ID matches", () => {
    const result = resolveActiveChat(storeChatEmpty, initialChat, "chat-1");
    expect(result).toBe(initialChat);
  });

  it("returns initialChat if storeChat is undefined but initialChat ID matches", () => {
    const result = resolveActiveChat(undefined, initialChat, "chat-1");
    expect(result).toBe(initialChat);
  });

  it("returns storeChat when initialChat ID does not match chatId", () => {
    const mismatchedInitial: Chat = {
      ...initialChat,
      id: "other-chat",
    };
    const result = resolveActiveChat(storeChatEmpty, mismatchedInitial, "chat-1");
    expect(result).toBe(storeChatEmpty);
  });

  it("returns undefined when neither storeChat nor matching initialChat exists", () => {
    const result = resolveActiveChat(undefined, undefined, "chat-1");
    expect(result).toBeUndefined();
  });
});
