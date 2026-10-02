import { describe, expect, it } from "vitest";
import { removeSubtree } from "@/lib/chat/remove-subtree";
import type { MessageMap } from "@/types/message/message-map";

describe("removeSubtree", () => {
  it("handles non-existent message ID", () => {
    const messages: MessageMap = {};
    const result = removeSubtree(messages, "non-existent");
    expect(result.updatedMessages).toEqual({});
    expect(result.parentId).toBeNull();
  });

  it("removes child and updates parent childrenIds", () => {
    const messages: MessageMap = {
      p1: {
        id: "p1",
        chatId: "c1",
        role: "user",
        content: "Hi",
        parentId: null,
        childrenIds: ["c1-id", "c2-id"],
        metadata: null,
        createdAt: new Date(),
      },
      "c1-id": {
        id: "c1-id",
        chatId: "c1",
        role: "assistant",
        content: "Hello",
        parentId: "p1",
        childrenIds: ["gc1-id"],
        metadata: null,
        createdAt: new Date(),
      },
      "gc1-id": {
        id: "gc1-id",
        chatId: "c1",
        role: "user",
        content: "Next",
        parentId: "c1-id",
        childrenIds: [],
        metadata: null,
        createdAt: new Date(),
      },
      "c2-id": {
        id: "c2-id",
        chatId: "c1",
        role: "assistant",
        content: "Branch",
        parentId: "p1",
        childrenIds: [],
        metadata: null,
        createdAt: new Date(),
      },
    };

    const result = removeSubtree(messages, "c1-id");
    expect(result.parentId).toBe("p1");
    expect(result.updatedMessages["c1-id"]).toBeUndefined();
    expect(result.updatedMessages["gc1-id"]).toBeUndefined();
    expect(result.updatedMessages.p1.childrenIds).toEqual(["c2-id"]);
    expect(result.updatedMessages["c2-id"]).toBeDefined();
  });

  it("handles message with parentId that is not in the message map", () => {
    const messages: MessageMap = {
      orphan: {
        id: "orphan",
        chatId: "c1",
        role: "user",
        content: "Orphan",
        parentId: "missing-parent",
        childrenIds: [],
        metadata: null,
        createdAt: new Date(),
      },
    };

    const result = removeSubtree(messages, "orphan");
    expect(result.parentId).toBe("missing-parent");
    expect(result.updatedMessages.orphan).toBeUndefined();
  });
});

