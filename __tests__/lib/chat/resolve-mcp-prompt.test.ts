import { describe, expect, it, vi } from "vitest";
import { resolveMcpPrompt } from "@/lib/chat/resolve-mcp-prompt";

const getMcpPromptMock = vi.hoisted(() => vi.fn());
vi.mock("@/actions/mcp/get-mcp-prompt", () => ({
  getMcpPrompt: getMcpPromptMock,
}));

describe("resolveMcpPrompt", () => {
  it("concatenates prompt messages with different content shapes", async () => {
    getMcpPromptMock.mockResolvedValue({
      messages: [
        { content: "Hello prompt" },
        { content: { type: "text", text: "Text content" } },
        { content: { text: "Alt text content" } },
        { content: { type: "image" } }, // fallback to ""
      ],
    });

    const result = await resolveMcpPrompt("srv-1", "prompt-1");
    expect(result).toBe("Hello prompt\n\nText content\n\nAlt text content\n\n");
  });
});
