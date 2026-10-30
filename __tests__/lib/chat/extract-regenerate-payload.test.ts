import { describe, expect, it } from "vitest";
import { resolveRegeneratePayload } from "@/lib/chat/extract-regenerate-payload";
import type { Chat } from "@/types/chat/chat";
import type { Message } from "@/types/message/message";

function makeMessage(overrides: Partial<Message> & { id: string }): Message {
  return {
    chatId: "c1",
    role: "user",
    content: "hello",
    parentId: null,
    childrenIds: [],
    createdAt: new Date("2026-10-30T10:00:00Z"),
    metadata: null,
    ...overrides,
  };
}

function makeChat(messages: Message[]): Chat {
  const map: Record<string, Message> = {};
  for (const msg of messages) map[msg.id] = msg;
  return { id: "c1", messages: map } as unknown as Chat;
}

describe("resolveRegeneratePayload", () => {
  it("returns null when chat is missing", () => {
    expect(resolveRegeneratePayload(undefined, "a1")).toBeNull();
  });

  it("returns null when assistantMessageId is missing", () => {
    expect(resolveRegeneratePayload(makeChat([]), undefined)).toBeNull();
  });

  it("returns null when the assistant message id is unknown", () => {
    expect(resolveRegeneratePayload(makeChat([]), "missing")).toBeNull();
  });

  it("returns null when the message is not an assistant message", () => {
    const chat = makeChat([makeMessage({ id: "a1", role: "user" })]);
    expect(resolveRegeneratePayload(chat, "a1")).toBeNull();
  });

  it("returns null when the assistant message has no parentId", () => {
    const chat = makeChat([makeMessage({ id: "a1", role: "assistant" })]);
    expect(resolveRegeneratePayload(chat, "a1")).toBeNull();
  });

  it("returns null when the parent message is missing", () => {
    const chat = makeChat([
      makeMessage({ id: "a1", role: "assistant", parentId: "ghost" }),
    ]);
    expect(resolveRegeneratePayload(chat, "a1")).toBeNull();
  });

  it("builds payload from promptMeta when present", () => {
    const parent = makeMessage({
      id: "u1",
      content: "fallback content",
      metadata: JSON.stringify({
        userContent: "prompt content",
        promptIds: ["p1", "p2"],
        assistantId: "as-1",
        model: "gpt-x",
        selectedServerIds: ["s1"],
        selectedTools: ["t1"],
        selectedKbIds: ["k1"],
        selectedSkillIds: ["sk1"],
        subagentsEnabled: true,
        subagentModelId: "sub-model",
      }),
    });
    const chat = makeChat([
      parent,
      makeMessage({ id: "a1", role: "assistant", parentId: "u1" }),
    ]);

    const result = resolveRegeneratePayload(chat, "a1");
    expect(result).not.toBeNull();
    expect(result?.parentMsg).toBe(parent);
    expect(result?.payload).toEqual({
      userContent: "prompt content",
      model: "gpt-x",
      serverIds: ["s1"],
      toolIds: ["t1"],
      promptIds: ["p1", "p2"],
      assistantId: "as-1",
      selectedKbIds: ["k1"],
      selectedSkillIds: ["sk1"],
      subagentsEnabled: true,
      subagentModelId: "sub-model",
    });
  });

  it("falls back to parent content and legacy prompt ids when promptMeta is absent", () => {
    const parent = makeMessage({
      id: "u1",
      content: "raw user text",
      metadata: JSON.stringify({
        promptIds: ["legacy-1"],
        assistantId: "as-2",
      }),
    });
    const chat = makeChat([
      parent,
      makeMessage({ id: "a1", role: "assistant", parentId: "u1" }),
    ]);

    const result = resolveRegeneratePayload(chat, "a1");
    expect(result?.payload).toMatchObject({
      userContent: "raw user text",
      promptIds: ["legacy-1"],
      assistantId: "as-2",
      model: "",
      serverIds: [],
      toolIds: [],
      selectedKbIds: [],
      selectedSkillIds: [],
      subagentsEnabled: undefined,
      subagentModelId: undefined,
    });
  });

  it("uses legacy promptId fallback when promptIds array is empty", () => {
    const parent = makeMessage({
      id: "u1",
      metadata: JSON.stringify({ promptIds: [], promptId: "single-1" }),
    });
    const chat = makeChat([
      parent,
      makeMessage({ id: "a1", role: "assistant", parentId: "u1" }),
    ]);

    expect(resolveRegeneratePayload(chat, "a1")?.payload.promptIds).toEqual([
      "single-1",
    ]);
  });

  it("returns undefined promptIds when no prompt data exists", () => {
    const parent = makeMessage({ id: "u1", metadata: "{}" });
    const chat = makeChat([
      parent,
      makeMessage({ id: "a1", role: "assistant", parentId: "u1" }),
    ]);

    expect(
      resolveRegeneratePayload(chat, "a1")?.payload.promptIds,
    ).toBeUndefined();
  });

  it("returns undefined assistantId when assistantId is not a string", () => {
    const parent = makeMessage({
      id: "u1",
      metadata: JSON.stringify({ assistantId: 42 }),
    });
    const chat = makeChat([
      parent,
      makeMessage({ id: "a1", role: "assistant", parentId: "u1" }),
    ]);

    expect(
      resolveRegeneratePayload(chat, "a1")?.payload.assistantId,
    ).toBeUndefined();
  });

  it("returns undefined promptIds when promptId is not a string", () => {
    const parent = makeMessage({
      id: "u1",
      metadata: JSON.stringify({ promptId: 7 }),
    });
    const chat = makeChat([
      parent,
      makeMessage({ id: "a1", role: "assistant", parentId: "u1" }),
    ]);

    expect(
      resolveRegeneratePayload(chat, "a1")?.payload.promptIds,
    ).toBeUndefined();
  });

  it("tolerates malformed metadata JSON", () => {
    const parent = makeMessage({
      id: "u1",
      content: "kept content",
      metadata: "{not json",
    });
    const chat = makeChat([
      parent,
      makeMessage({ id: "a1", role: "assistant", parentId: "u1" }),
    ]);

    expect(resolveRegeneratePayload(chat, "a1")?.payload).toMatchObject({
      userContent: "kept content",
      promptIds: undefined,
      assistantId: undefined,
      model: "",
      serverIds: [],
      toolIds: [],
      selectedKbIds: [],
      selectedSkillIds: [],
    });
  });

  it("handles null metadata on the parent message", () => {
    const parent = makeMessage({ id: "u1", metadata: null });
    const chat = makeChat([
      parent,
      makeMessage({ id: "a1", role: "assistant", parentId: "u1" }),
    ]);

    expect(resolveRegeneratePayload(chat, "a1")?.payload).toMatchObject({
      userContent: "hello",
      promptIds: undefined,
      assistantId: undefined,
      model: "",
    });
  });

  it("handles non-string metadata objects passed at runtime", () => {
    const parent = makeMessage({
      id: "u1",
      metadata: {
        promptIds: ["obj-1"],
        assistantId: "as-obj",
        model: "m-1",
      } as unknown as string,
    });
    const chat = makeChat([
      parent,
      makeMessage({ id: "a1", role: "assistant", parentId: "u1" }),
    ]);

    expect(resolveRegeneratePayload(chat, "a1")?.payload).toMatchObject({
      promptIds: ["obj-1"],
      assistantId: "as-obj",
      model: "m-1",
    });
  });
});
