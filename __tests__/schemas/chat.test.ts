import { describe, it, expect } from "vitest";
import {
  persistMessageSchema,
  createChatSchema,
  renameChatSchema,
  moveChatSchema,
  messageMetadataSchema,
  chatMessageSchema,
  chatRequestSchema,
} from "@/schemas/chat/chat";

const VALID_UUID = "550e8400-e29b-41d4-a716-446655440000";

// ---------------------------------------------------------------------------
// persistMessageSchema
// ---------------------------------------------------------------------------
describe("persistMessageSchema", () => {
  it("accepts valid user message", () => {
    const result = persistMessageSchema.safeParse({
      id: VALID_UUID,
      role: "user",
      content: "Hello!",
      parentId: null,
    });
    expect(result.success).toBe(true);
  });

  it("accepts assistant role", () => {
    const result = persistMessageSchema.safeParse({
      id: VALID_UUID,
      role: "assistant",
      content: "Hi there!",
      parentId: VALID_UUID,
    });
    expect(result.success).toBe(true);
  });

  it("accepts system role", () => {
    const result = persistMessageSchema.safeParse({
      id: VALID_UUID,
      role: "system",
      content: "You are helpful.",
      parentId: null,
    });
    expect(result.success).toBe(true);
  });

  it("rejects non-UUID id", () => {
    const result = persistMessageSchema.safeParse({
      id: "not-a-uuid",
      role: "user",
      content: "Hello",
      parentId: null,
    });
    expect(result.success).toBe(false);
  });

  it("rejects empty content", () => {
    const result = persistMessageSchema.safeParse({
      id: VALID_UUID,
      role: "user",
      content: "",
      parentId: null,
    });
    expect(result.success).toBe(false);
  });

  it("rejects invalid role", () => {
    const result = persistMessageSchema.safeParse({
      id: VALID_UUID,
      role: "admin",
      content: "Hi",
      parentId: null,
    });
    expect(result.success).toBe(false);
  });

  it("rejects non-UUID parentId", () => {
    const result = persistMessageSchema.safeParse({
      id: VALID_UUID,
      role: "user",
      content: "Hi",
      parentId: "bad-id",
    });
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// createChatSchema
// ---------------------------------------------------------------------------
describe("createChatSchema", () => {
  it("accepts empty object — all optional", () => {
    const result = createChatSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it("accepts title with projectId and assistantId", () => {
    const result = createChatSchema.safeParse({
      title: "My Chat",
      projectId: VALID_UUID,
      assistantId: VALID_UUID,
    });
    expect(result.success).toBe(true);
  });

  it("accepts null projectId and null assistantId", () => {
    const result = createChatSchema.safeParse({
      projectId: null,
      assistantId: null,
    });
    expect(result.success).toBe(true);
  });

  it("rejects empty title string", () => {
    const result = createChatSchema.safeParse({ title: "" });
    expect(result.success).toBe(false);
  });

  it("rejects title longer than 255 characters", () => {
    const result = createChatSchema.safeParse({ title: "t".repeat(256) });
    expect(result.success).toBe(false);
  });

  it("rejects non-UUID projectId", () => {
    const result = createChatSchema.safeParse({ projectId: "bad" });
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// renameChatSchema
// ---------------------------------------------------------------------------
describe("renameChatSchema", () => {
  it("accepts valid title", () => {
    const result = renameChatSchema.safeParse({ title: "New Title" });
    expect(result.success).toBe(true);
  });

  it("rejects empty title", () => {
    const result = renameChatSchema.safeParse({ title: "" });
    expect(result.success).toBe(false);
  });

  it("rejects title longer than 255 characters", () => {
    const result = renameChatSchema.safeParse({ title: "t".repeat(256) });
    expect(result.success).toBe(false);
  });

  it("rejects missing title field", () => {
    const result = renameChatSchema.safeParse({});
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// moveChatSchema
// ---------------------------------------------------------------------------
describe("moveChatSchema", () => {
  it("accepts valid UUID projectId", () => {
    const result = moveChatSchema.safeParse({ projectId: VALID_UUID });
    expect(result.success).toBe(true);
  });

  it("accepts null projectId (unbinding)", () => {
    const result = moveChatSchema.safeParse({ projectId: null });
    expect(result.success).toBe(true);
  });

  it("rejects non-UUID projectId", () => {
    const result = moveChatSchema.safeParse({ projectId: "not-a-uuid" });
    expect(result.success).toBe(false);
  });

  it("rejects missing projectId", () => {
    const result = moveChatSchema.safeParse({});
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// messageMetadataSchema
// ---------------------------------------------------------------------------
describe("messageMetadataSchema", () => {
  it("accepts empty object — all optional", () => {
    const result = messageMetadataSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it("accepts full valid metadata", () => {
    const result = messageMetadataSchema.safeParse({
      toolCalls: [
        { toolCallId: "id1", toolName: "search", args: { q: "test" } },
      ],
      toolResults: [
        { toolCallId: "id1", toolName: "search", result: { data: [] } },
      ],
      reasoning: "I thought about this.",
      model: "gpt-4",
    });
    expect(result.success).toBe(true);
  });

  it("accepts toolCalls with unknown args", () => {
    const result = messageMetadataSchema.safeParse({
      toolCalls: [{ toolCallId: "x", toolName: "calc", args: 42 }],
    });
    expect(result.success).toBe(true);
  });

  it("rejects toolCalls missing toolCallId", () => {
    const result = messageMetadataSchema.safeParse({
      toolCalls: [{ toolName: "search", args: {} }],
    });
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// chatMessageSchema
// ---------------------------------------------------------------------------
describe("chatMessageSchema", () => {
  it("accepts simple string content message", () => {
    const result = chatMessageSchema.safeParse({
      role: "user",
      content: "Hello!",
    });
    expect(result.success).toBe(true);
  });

  it("accepts array content (multimodal)", () => {
    const result = chatMessageSchema.safeParse({
      role: "user",
      content: [{ type: "text", text: "Describe this image" }],
    });
    expect(result.success).toBe(true);
  });

  it("rejects invalid role", () => {
    const result = chatMessageSchema.safeParse({ role: "bot", content: "hi" });
    expect(result.success).toBe(false);
  });

  it("accepts optional UUID id and parentId", () => {
    const result = chatMessageSchema.safeParse({
      role: "assistant",
      content: "Sure!",
      id: VALID_UUID,
      parentId: VALID_UUID,
    });
    expect(result.success).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// chatRequestSchema
// ---------------------------------------------------------------------------
describe("chatRequestSchema", () => {
  it("accepts minimal valid request", () => {
    const result = chatRequestSchema.safeParse({
      chatId: VALID_UUID,
      messages: [{ role: "user", content: "Hi" }],
    });
    expect(result.success).toBe(true);
  });

  it("accepts full valid request", () => {
    const result = chatRequestSchema.safeParse({
      chatId: VALID_UUID,
      userMessageId: VALID_UUID,
      model: "gpt-4",
      messages: [{ role: "user", content: "Hello" }],
      selectedServerIds: ["server-1"],
      selectedTools: ["search"],
    });
    expect(result.success).toBe(true);
  });

  it("rejects non-UUID chatId", () => {
    const result = chatRequestSchema.safeParse({
      chatId: "not-a-uuid",
      messages: [],
    });
    expect(result.success).toBe(false);
  });

  it("rejects more than 500 messages", () => {
    const messages = Array.from({ length: 501 }, () => ({
      role: "user" as const,
      content: "msg",
    }));
    const result = chatRequestSchema.safeParse({
      chatId: VALID_UUID,
      messages,
    });
    expect(result.success).toBe(false);
  });

  it("rejects model longer than 100 characters", () => {
    const result = chatRequestSchema.safeParse({
      chatId: VALID_UUID,
      messages: [],
      model: "m".repeat(101),
    });
    expect(result.success).toBe(false);
  });

  it("rejects more than 20 selectedServerIds", () => {
    const result = chatRequestSchema.safeParse({
      chatId: VALID_UUID,
      messages: [],
      selectedServerIds: Array.from({ length: 21 }, (_, i) => `s${i}`),
    });
    expect(result.success).toBe(false);
  });
});
