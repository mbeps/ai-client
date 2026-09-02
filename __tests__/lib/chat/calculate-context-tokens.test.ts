import { describe, expect, it } from "vitest";
import type { UserModelOption } from "@/hooks/use-user-models";
import {
  calculateContextUsage,
  estimateAttachmentTokens,
  estimateTokens,
  formatTokens,
} from "@/lib/chat/calculate-context-tokens";
import type { Attachment } from "@/types/attachment/attachment";
import type { Message } from "@/types/message/message";

describe("calculate-context-tokens utility", () => {
  describe("estimateTokens", () => {
    it("returns 0 for empty or null strings", () => {
      expect(estimateTokens("")).toBe(0);
      expect(estimateTokens(null)).toBe(0);
      expect(estimateTokens(undefined)).toBe(0);
    });

    it("estimates tokens accurately based on character count", () => {
      // ~3.8 chars per token
      expect(estimateTokens("hello world")).toBe(3); // 11 chars -> 3 tokens
      expect(estimateTokens("a".repeat(380))).toBe(100);
    });
  });

  describe("estimateAttachmentTokens", () => {
    it("returns fixed vision estimate for images", () => {
      const imgAttachment: Attachment = {
        id: "att-1",
        name: "test.png",
        type: "image",
        mimeType: "image/png",
        dataUrl: "data:image/png;base64,...",
        sizeBytes: 50000,
        url: "https://example.com/test.png",
      };
      expect(estimateAttachmentTokens(imgAttachment)).toBe(800);
    });

    it("estimates based on extractedText when available", () => {
      const docAttachment: Attachment = {
        id: "att-2",
        name: "doc.pdf",
        type: "document",
        mimeType: "application/pdf",
        dataUrl: "",
        sizeBytes: 100000,
        url: "https://example.com/doc.pdf",
        extractedText: "Extracted text content from the document",
      };
      expect(estimateAttachmentTokens(docAttachment)).toBe(
        estimateTokens(docAttachment.extractedText),
      );
    });

    it("estimates based on sizeBytes when extractedText is absent", () => {
      const docAttachment: Attachment = {
        id: "att-3",
        name: "data.csv",
        type: "document",
        mimeType: "text/csv",
        dataUrl: "",
        sizeBytes: 4000,
      };
      expect(estimateAttachmentTokens(docAttachment)).toBe(1000); // 4000 / 4 = 1000
    });
  });

  describe("formatTokens", () => {
    it("formats small numbers directly", () => {
      expect(formatTokens(850)).toBe("850");
      expect(formatTokens(0)).toBe("0");
    });

    it("formats thousands as K", () => {
      expect(formatTokens(1200)).toBe("1.2K");
      expect(formatTokens(12400)).toBe("12.4K");
      expect(formatTokens(371500)).toBe("372K");
    });

    it("formats millions as M", () => {
      expect(formatTokens(1000000)).toBe("1M");
      expect(formatTokens(1500000)).toBe("1.5M");
      expect(formatTokens(20000000)).toBe("20M");
    });
  });

  describe("calculateContextUsage", () => {
    const mockModel: UserModelOption = {
      id: "gpt-4o",
      modelId: "gpt-4o",
      name: "GPT-4o",
      providerName: "OpenAI",
      contextWindow: 128000,
      capVision: true,
      capTools: true,
      modelType: "chat",
      pricing: { inputRatePer1m: 5, outputRatePer1m: 15 },
    };

    it("calculates baseline system overhead for empty state", () => {
      const result = calculateContextUsage({
        selectedModel: mockModel,
      });

      expect(result.maxTokens).toBe(128000);
      expect(result.totalTokens).toBeGreaterThan(0);
      expect(result.percentage).toBeLessThanOrEqual(1);
      expect(result.isNearLimit).toBe(false);
      expect(result.isExceeded).toBe(false);
    });

    it("calculates thread messages and tool metadata tokens", () => {
      const messages: Message[] = [
        {
          id: "msg-1",
          chatId: "chat-1",
          role: "user",
          content: "Hello AI, write me a story",
          parentId: null,
          childrenIds: [],
          createdAt: new Date(),
          metadata: null,
        },
        {
          id: "msg-2",
          chatId: "chat-1",
          role: "assistant",
          content: "Once upon a time in a digital world...",
          parentId: "msg-1",
          childrenIds: [],
          createdAt: new Date(),
          metadata: JSON.stringify({
            reasoning: "Let's formulate a nice story beginning",
            toolCalls: [
              {
                toolCallId: "tc-1",
                toolName: "search",
                args: { query: "story themes" },
              },
            ],
            toolResults: [
              {
                toolCallId: "tc-1",
                toolName: "search",
                result: "Relevant story themes",
              },
            ],
          }),
        },
      ];

      const result = calculateContextUsage({
        thread: messages,
        selectedModel: mockModel,
        input: "Can you continue the story?",
        toolNames: ["search", "manage_artifact"],
        mcpServerCount: 1,
      });

      expect(result.breakdown.messages).toBeGreaterThan(0);
      expect(result.breakdown.toolDefinitions).toBe(2 * 180 + 50); // 2 tools + 1 server overhead
      expect(result.breakdown.toolResults).toBeGreaterThan(0);
      expect(result.breakdown.draft).toBeGreaterThan(0);
      expect(result.totalTokens).toBeGreaterThan(
        result.breakdown.messages + result.breakdown.toolDefinitions,
      );
    });

    it("flags isNearLimit when tokens exceed 75% of context window", () => {
      const tinyModel: UserModelOption = {
        id: "tiny-model",
        modelId: "tiny-model",
        name: "Tiny",
        providerName: "Local",
        contextWindow: 1000,
        capVision: false,
        capTools: false,
        modelType: "chat",
        pricing: { inputRatePer1m: 0, outputRatePer1m: 0 },
      };

      const result = calculateContextUsage({
        selectedModel: tinyModel,
        input: "a".repeat(3200), // ~842 tokens
      });

      expect(result.percentage).toBeGreaterThanOrEqual(75);
      expect(result.isNearLimit).toBe(true);
    });
  });
});
