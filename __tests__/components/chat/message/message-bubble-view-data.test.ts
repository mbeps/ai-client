import { describe, expect, it } from "vitest";
import {
  deriveMessageBubbleViewData,
  resolveMessageEditParams,
} from "@/components/chat/message/message-bubble-view-data";

describe("message-bubble-view-data", () => {
  it("resolves message edit params with promptIds, nullish fallbacks, and assistantId", () => {
    const res1 = resolveMessageEditParams({
      message: { id: "m1", attachments: undefined } as any,
      editContent: "edited",
      metadata: {
        promptMeta: { promptId: "p-single" },
        modelId: null,
        selectedServerIds: null,
        selectedTools: null,
        selectedKbIds: null,
        selectedSkillIds: null,
        subagentsEnabled: false,
        subagentModelId: undefined,
      } as any,
      promptIds: ["p1", "p2"],
      assistantId: "a1",
    });
  });

  it("resolves promptId fallback and citations from rawToolData", () => {
    const viewData = deriveMessageBubbleViewData(
      {
        id: "m-fallback",
        role: "assistant",
        content: "hi",
        createdAt: new Date(),
        metadata: JSON.stringify({
          promptMeta: { promptId: "p-single" },
          toolData: { toolResults: [] },
        }),
      } as any,
      false,
      undefined,
    );
    expect(viewData.promptIds).toEqual([]);
    expect(viewData.citations).toEqual([]);

    const emptyPromptViewData = deriveMessageBubbleViewData(
      {
        id: "m-empty-prompt",
        role: "assistant",
        content: "hi",
        createdAt: new Date(),
        metadata: JSON.stringify({
          promptMeta: {},
        }),
      } as any,
      false,
      undefined,
    );
    expect(emptyPromptViewData.promptIds).toEqual([]);

    const res2 = resolveMessageEditParams({
      message: { id: "m2", attachments: [{ id: "att1" }] } as any,
      editContent: "edited 2",
      metadata: {
        promptMeta: { promptId: "p-single" },
        modelId: "gpt-4o",
        selectedServerIds: ["s1"],
        selectedTools: ["t1"],
        selectedKbIds: ["kb1"],
        selectedSkillIds: ["sk1"],
        subagentsEnabled: true,
        subagentModelId: "gpt-4o-mini",
      } as any,
      promptIds: [],
      assistantId: null,
    });
  });

  it("resolves promptId fallback and citations from rawToolData", () => {
    const viewData = deriveMessageBubbleViewData(
      {
        id: "m-fallback",
        role: "assistant",
        content: "hi",
        createdAt: new Date(),
        metadata: JSON.stringify({
          promptMeta: { promptId: "p-single" },
          toolData: { toolResults: [] },
        }),
      } as any,
      false,
      undefined,
    );
    expect(viewData.promptIds).toEqual([]);
    expect(viewData.citations).toEqual([]);

    const emptyPromptViewData = deriveMessageBubbleViewData(
      {
        id: "m-empty-prompt",
        role: "assistant",
        content: "hi",
        createdAt: new Date(),
        metadata: JSON.stringify({
          promptMeta: {},
        }),
      } as any,
      false,
      undefined,
    );
    expect(emptyPromptViewData.promptIds).toEqual([]);
  });

  it("resolves promptId fallback and citations from rawToolData", () => {
    const viewData = deriveMessageBubbleViewData(
      {
        id: "m-fallback",
        role: "assistant",
        content: "hi",
        createdAt: new Date(),
        metadata: JSON.stringify({
          promptMeta: { promptId: "p-single" },
          toolData: { toolResults: [] },
        }),
      } as any,
      false,
      undefined,
    );
    expect(viewData.promptIds).toEqual([]);
    expect(viewData.citations).toEqual([]);

    const emptyPromptViewData = deriveMessageBubbleViewData(
      {
        id: "m-empty-prompt",
        role: "assistant",
        content: "hi",
        createdAt: new Date(),
        metadata: JSON.stringify({
          promptMeta: {},
        }),
      } as any,
      false,
      undefined,
    );
    expect(emptyPromptViewData.promptIds).toEqual([]);
  });

  it("derives assistant view data with streamingCitations, toolData, and promptMeta variants", () => {
    const withStreaming = deriveMessageBubbleViewData(
      { id: "m1", role: "assistant", content: "hi", metadata: null } as any,
      false,
      [{ documentId: "d1", content: "cite" } as any],
    );
    expect(withStreaming.citations).toHaveLength(1);

    const withToolData = deriveMessageBubbleViewData(
      {
        id: "m2",
        role: "assistant",
        content: "hi",
        metadata: JSON.stringify({
          promptMeta: { promptIds: ["p1"] },
          toolData: { toolResults: [] },
        }),
      } as any,
      false,
      [],
    );
    expect(withToolData.promptIds).toEqual([]);
    expect(withToolData.citations).toEqual([]);

    const withSinglePrompt = deriveMessageBubbleViewData(
      {
        id: "m3",
        role: "user",
        content: "hi",
        metadata: JSON.stringify({ promptId: "p-only", userContent: "hi" }),
      } as any,
      true,
    );
    expect(withSinglePrompt.promptIds).toEqual(["p-only"]);

    const withPromptMetaId = deriveMessageBubbleViewData(
      {
        id: "m4",
        role: "user",
        content: "hi",
        metadata: JSON.stringify({ promptMeta: { promptId: "p-meta" }, userContent: "hi" }),
      } as any,
      true,
    );
    expect(withPromptMetaId.promptIds).toEqual([]);

    const withEmptyPromptMeta = deriveMessageBubbleViewData(
      {
        id: "m5",
        role: "user",
        content: "hi",
        metadata: JSON.stringify({ promptMeta: {}, userContent: "hi" }),
      } as any,
      true,
    );
    expect(withEmptyPromptMeta.promptIds).toEqual([]);
  });

  it("resolves promptId fallback and citations from rawToolData", () => {
    const viewData = deriveMessageBubbleViewData(
      {
        id: "m-fallback",
        role: "assistant",
        content: "hi",
        createdAt: new Date(),
        metadata: JSON.stringify({
          promptMeta: { promptId: "p-single" },
          toolData: { toolResults: [] },
        }),
      } as any,
      false,
      undefined,
    );
    expect(viewData.promptIds).toEqual([]);
    expect(viewData.citations).toEqual([]);

    const emptyPromptViewData = deriveMessageBubbleViewData(
      {
        id: "m-empty-prompt",
        role: "assistant",
        content: "hi",
        createdAt: new Date(),
        metadata: JSON.stringify({
          promptMeta: {},
        }),
      } as any,
      false,
      undefined,
    );
    expect(emptyPromptViewData.promptIds).toEqual([]);
  });
});
