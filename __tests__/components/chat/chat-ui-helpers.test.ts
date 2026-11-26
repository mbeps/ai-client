import { describe, expect, it, vi } from "vitest";
import { updateChatKnowledgebase } from "@/components/chat/chat-ui-helpers";

describe("chat-ui-helpers", () => {
  it("updateChatKnowledgebase passes first kbId or null", () => {
    const setKb = vi.fn();
    updateChatKnowledgebase("chat-1", ["kb-1", "kb-2"], setKb);
    expect(setKb).toHaveBeenCalledWith("chat-1", "kb-1");

    updateChatKnowledgebase("chat-1", [], setKb);
    expect(setKb).toHaveBeenCalledWith("chat-1", null);
  });
});
