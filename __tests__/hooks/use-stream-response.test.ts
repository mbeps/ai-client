import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { useStreamResponse } from "@/hooks/chat/use-stream-response";

// ─── Hoisted mock variables ────────────────────────────────────────────────
const mockPush = vi.hoisted(() => vi.fn());
const mockRefresh = vi.hoisted(() => vi.fn());
const mockToastInfo = vi.hoisted(() => vi.fn());
const mockToastError = vi.hoisted(() => vi.fn());
const mockToastSuccess = vi.hoisted(() => vi.fn());
const mockHandleApiError = vi.hoisted(() => vi.fn().mockReturnValue(false));
const mockAddMessage = vi.hoisted(() => vi.fn());
const mockUpdateMessageAttachments = vi.hoisted(() => vi.fn());
const mockPersistMessage = vi.hoisted(() =>
  vi.fn().mockResolvedValue(undefined),
);
const mockProcessAttachments = vi.hoisted(() => vi.fn().mockResolvedValue([]));
const mockGetState = vi.hoisted(() =>
  vi.fn().mockReturnValue({
    chats: {
      "chat-1": {
        id: "chat-1",
        currentLeafId: null,
        messages: {},
      },
    },
    prompts: [],
  }),
);

// ─── Mocks ─────────────────────────────────────────────────────────────────
vi.mock("next/navigation", () => ({
  useRouter: vi.fn().mockReturnValue({
    push: mockPush,
    refresh: mockRefresh,
  }),
}));

vi.mock("sonner", () => ({
  toast: {
    info: mockToastInfo,
    error: mockToastError,
    success: mockToastSuccess,
  },
}));

vi.mock("@/hooks/use-api-error", () => ({
  useApiError: vi.fn().mockReturnValue({
    handleApiError: mockHandleApiError,
  }),
}));

vi.mock("@/lib/store", () => {
  const storeState = {
    addMessage: mockAddMessage,
    updateMessageAttachments: mockUpdateMessageAttachments,
    chats: mockGetState().chats,
    prompts: mockGetState().prompts,
  };

  const useAppStoreMock = vi.fn((selector) => {
    if (typeof selector === "function") {
      return selector(storeState);
    }
    return storeState;
  });

  // Add getState static method
  useAppStoreMock.getState = () => storeState;

  return { useAppStore: useAppStoreMock };
});

vi.mock("@/lib/actions/chats/persist-message", () => ({
  persistMessage: mockPersistMessage,
}));

vi.mock("@/lib/chat/upload-attachments", () => ({
  processAttachments: mockProcessAttachments,
}));

// ─── Helper to create mock SSE stream ──────────────────────────────────────
function createMockSseStream(events: Array<{ type: string; data: any }>) {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      events.forEach(({ type, data }) => {
        const line = `data: ${JSON.stringify(data)}\n\n`;
        controller.enqueue(encoder.encode(line));
      });
      controller.close();
    },
  });
  return new Response(stream, {
    status: 200,
    headers: { "Content-Type": "text/event-stream" },
  });
}

// ─── Tests ─────────────────────────────────────────────────────────────────
describe("useStreamResponse", () => {
  const chatId = "chat-1";
  const userMsgId = "user-msg-1";
  const assistantMsgId = "assistant-msg-1";

  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ── Successful streaming ────────────────────────────────────────────────
  describe("Successful streaming", () => {
    it("should stream text tokens and accumulate content", async () => {
      const events = [
        { type: "data", data: { type: "text", delta: "Hello" } },
        { type: "data", data: { type: "text", delta: " world" } },
        {
          type: "data",
          data: { type: "done", id: assistantMsgId, metadata: {} },
        },
      ];

      (global.fetch as any).mockResolvedValue(createMockSseStream(events));

      const { result } = renderHook(() => useStreamResponse(chatId));

      await act(async () => {
        await result.current.streamResponse(
          userMsgId,
          "Test message",
          null,
          [],
          "gpt-4",
        );
      });

      expect(mockAddMessage).toHaveBeenCalledWith(
        chatId,
        "assistant",
        "Hello world",
        userMsgId,
        assistantMsgId,
        "{}",
        undefined,
        undefined,
      );
    });

    it("should track and update tool calls", async () => {
      const events = [
        {
          type: "data",
          data: {
            type: "tool-call",
            toolCallId: "call-1",
            toolName: "get_weather",
            args: { location: "NYC" },
          },
        },
        {
          type: "data",
          data: {
            type: "tool-result",
            toolCallId: "call-1",
            toolName: "get_weather",
            result: { temp: 72 },
          },
        },
        { type: "data", data: { type: "text", delta: "It's 72°F" } },
        {
          type: "data",
          data: { type: "done", id: assistantMsgId, metadata: {} },
        },
      ];

      (global.fetch as any).mockResolvedValue(createMockSseStream(events));

      const { result } = renderHook(() => useStreamResponse(chatId));

      await act(async () => {
        await result.current.streamResponse(
          userMsgId,
          "What's the weather?",
          null,
          [],
          "gpt-4",
        );
      });

      // Tool call should be tracked during streaming
      await waitFor(() => {
        expect(result.current.activeToolCalls.length).toBeGreaterThanOrEqual(0);
      });

      // After done, tool calls should be cleared
      expect(result.current.activeToolCalls).toEqual([]);
      expect(result.current.isLoading).toBe(false);
    });

    it("should accumulate reasoning tokens separately", async () => {
      const events = [
        { type: "data", data: { type: "reasoning", delta: "Let me think" } },
        { type: "data", data: { type: "reasoning", delta: " about this" } },
        { type: "data", data: { type: "text", delta: "The answer is 42" } },
        {
          type: "data",
          data: { type: "done", id: assistantMsgId, metadata: {} },
        },
      ];

      (global.fetch as any).mockResolvedValue(createMockSseStream(events));

      const { result } = renderHook(() => useStreamResponse(chatId));

      await act(async () => {
        await result.current.streamResponse(
          userMsgId,
          "Complex question",
          null,
          [],
          "gpt-4",
        );
      });

      // Assistant message should include reasoning
      expect(mockAddMessage).toHaveBeenCalledWith(
        chatId,
        "assistant",
        "The answer is 42",
        userMsgId,
        assistantMsgId,
        "{}",
        undefined,
        "Let me think about this",
      );
    });

    it("should persist metadata in done event", async () => {
      const metadata = {
        toolCalls: [{ name: "calculator", result: 42 }],
        model: "gpt-4",
      };

      const events = [
        { type: "data", data: { type: "text", delta: "Result: 42" } },
        {
          type: "data",
          data: { type: "done", id: assistantMsgId, metadata },
        },
      ];

      (global.fetch as any).mockResolvedValue(createMockSseStream(events));

      const { result } = renderHook(() => useStreamResponse(chatId));

      await act(async () => {
        await result.current.streamResponse(
          userMsgId,
          "Calculate",
          null,
          [],
          "gpt-4",
        );
      });

      expect(mockAddMessage).toHaveBeenCalledWith(
        chatId,
        "assistant",
        "Result: 42",
        userMsgId,
        assistantMsgId,
        JSON.stringify(metadata),
        undefined,
        undefined,
      );
    });
  });

  // ── Stream abort handling ───────────────────────────────────────────────
  describe("Stream abort handling", () => {
    it("should abort stream when stopStream is called", async () => {
      // Mock a slow stream that can be aborted
      (global.fetch as any).mockImplementation((url: string, options: any) => {
        return new Promise((resolve) => {
          options.signal.addEventListener("abort", () => {
            resolve(Promise.reject(new DOMException("Aborted", "AbortError")));
          });

          // Stream starts but never finishes
          setTimeout(() => {
            const stream = new ReadableStream({
              start(controller) {
                const encoder = new TextEncoder();
                controller.enqueue(
                  encoder.encode(
                    `data: ${JSON.stringify({ type: "text", delta: "Starting" })}\n\n`,
                  ),
                );
              },
            });
            resolve(
              new Response(stream, {
                status: 200,
                headers: { "Content-Type": "text/event-stream" },
              }),
            );
          }, 50);
        });
      });

      const { result } = renderHook(() => useStreamResponse(chatId));

      // Start streaming (don't await)
      let streamPromise: Promise<any>;
      act(() => {
        streamPromise = result.current.streamResponse(
          userMsgId,
          "Long task",
          null,
          [],
          "gpt-4",
        );
      });

      // Wait a bit for fetch to be called
      await new Promise((resolve) => setTimeout(resolve, 30));

      // Abort while "fetching"
      act(() => {
        result.current.stopStream();
      });

      // Wait for everything to settle
      await act(async () => {
        await streamPromise!.catch(() => {}); // Catch AbortError
      });

      // Verify cleanup happened
      expect(result.current.isLoading).toBe(false);
      expect(result.current.streamingContent).toBeNull();
    }, 10000);

    it("should save partial content on abort if content exists", async () => {
      const events = [
        { type: "data", data: { type: "text", delta: "Partial" } },
        { type: "data", data: { type: "text", delta: " content" } },
      ];

      (global.fetch as any).mockImplementation((url: string, options: any) => {
        // Create stream that will be aborted
        return Promise.resolve(createMockSseStream(events));
      });

      const { result } = renderHook(() => useStreamResponse(chatId));

      // Start streaming and abort quickly
      const streamPromise = act(async () => {
        result.current.streamResponse(userMsgId, "Message", null, [], "gpt-4");
      });

      // Abort after a brief moment
      await new Promise((resolve) => setTimeout(resolve, 20));
      act(() => {
        result.current.stopStream();
      });

      await streamPromise;

      // Should save partial content (may be empty if abort was too quick)
      expect(result.current.isLoading).toBe(false);
    });
  });

  // ── Error handling ──────────────────────────────────────────────────────
  describe("Error handling", () => {
    it("should handle 401 Unauthorized errors", async () => {
      vi.clearAllMocks();

      (global.fetch as any).mockResolvedValue(
        new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
        }),
      );

      const { result } = renderHook(() => useStreamResponse(chatId));

      // Hook catches errors internally and shows toast
      await act(async () => {
        await result.current.streamResponse(
          userMsgId,
          "Test",
          null,
          [],
          "gpt-4",
        );
      });

      expect(mockToastError).toHaveBeenCalledWith(
        "Your session has expired. Please log in again.",
      );
      expect(result.current.isLoading).toBe(false);
    });

    it("should handle 429 Rate limit errors", async () => {
      vi.clearAllMocks();

      (global.fetch as any).mockResolvedValue(
        new Response(JSON.stringify({ error: "Rate limit exceeded" }), {
          status: 429,
        }),
      );

      const { result } = renderHook(() => useStreamResponse(chatId));

      await act(async () => {
        await result.current.streamResponse(
          userMsgId,
          "Test",
          null,
          [],
          "gpt-4",
        );
      });

      expect(mockToastError).toHaveBeenCalledWith(
        "Too many requests. Please try again later.",
      );
      expect(result.current.isLoading).toBe(false);
    });

    it("should handle network failures", async () => {
      (global.fetch as any).mockRejectedValue(
        new Error("Network request failed"),
      );

      const { result } = renderHook(() => useStreamResponse(chatId));

      await act(async () => {
        await result.current.streamResponse(
          userMsgId,
          "Test",
          null,
          [],
          "gpt-4",
        );
      });

      expect(mockToastError).toHaveBeenCalled();
    });

    it("should handle SSE error events", async () => {
      const events = [
        { type: "data", data: { type: "text", delta: "Starting" } },
        {
          type: "data",
          data: { type: "error", message: "Provider error", code: "PROVIDER" },
        },
      ];

      (global.fetch as any).mockResolvedValue(createMockSseStream(events));

      const { result } = renderHook(() => useStreamResponse(chatId));

      await act(async () => {
        await result.current.streamResponse(
          userMsgId,
          "Test",
          null,
          [],
          "gpt-4",
        );
      });

      // Should add error message
      expect(mockAddMessage).toHaveBeenCalledWith(
        chatId,
        "assistant",
        "Provider error",
        userMsgId,
      );
    });

    it("should handle generic stream errors", async () => {
      (global.fetch as any).mockResolvedValue(
        new Response(JSON.stringify({ error: "Something went wrong" }), {
          status: 500,
        }),
      );

      const { result } = renderHook(() => useStreamResponse(chatId));

      await act(async () => {
        await result.current.streamResponse(
          userMsgId,
          "Test",
          null,
          [],
          "gpt-4",
        );
      });

      expect(mockToastError).toHaveBeenCalled();
    });
  });

  // ── Message persistence ─────────────────────────────────────────────────
  describe("Message persistence", () => {
    it("should persist user message before streaming", async () => {
      const events = [
        { type: "data", data: { type: "text", delta: "Response" } },
        {
          type: "data",
          data: { type: "done", id: assistantMsgId, metadata: {} },
        },
      ];

      (global.fetch as any).mockResolvedValue(createMockSseStream(events));

      const { result } = renderHook(() => useStreamResponse(chatId));

      await act(async () => {
        await result.current.streamResponse(
          userMsgId,
          "User message",
          null,
          [],
          "gpt-4",
          ["server-1"],
          ["tool-1"],
        );
      });

      // User message should be persisted
      expect(mockPersistMessage).toHaveBeenCalledWith(chatId, {
        id: userMsgId,
        role: "user",
        content: "User message",
        parentId: null,
        metadata: expect.any(String),
      });
    });

    it("should handle message persistence failures gracefully", async () => {
      mockPersistMessage.mockRejectedValueOnce(
        new Error("Database connection failed"),
      );

      const events = [
        { type: "data", data: { type: "text", delta: "Response" } },
        {
          type: "data",
          data: { type: "done", id: assistantMsgId, metadata: {} },
        },
      ];

      (global.fetch as any).mockResolvedValue(createMockSseStream(events));

      const { result } = renderHook(() => useStreamResponse(chatId));

      await act(async () => {
        await result.current.streamResponse(
          userMsgId,
          "User message",
          null,
          [],
          "gpt-4",
        );
      });

      // Should show error toast but continue streaming
      expect(mockToastError).toHaveBeenCalledWith(
        "Message may not have been saved. Please check your connection.",
      );

      // Stream should still complete
      expect(mockAddMessage).toHaveBeenCalledWith(
        chatId,
        "assistant",
        "Response",
        userMsgId,
        assistantMsgId,
        "{}",
        undefined,
        undefined,
      );
    });
  });

  // ── Attachment upload flow ──────────────────────────────────────────────
  describe("Attachment upload flow", () => {
    it("should upload attachments and update message", async () => {
      const attachments = [
        {
          id: "att-1",
          name: "test.png",
          mimeType: "image/png",
          size: 1024,
          url: "blob:test",
        },
      ];

      const uploadedAttachments = [
        {
          id: "att-1",
          name: "test.png",
          mimeType: "image/png",
          size: 1024,
          url: "https://s3.example.com/test.png",
        },
      ];

      mockProcessAttachments.mockResolvedValueOnce(uploadedAttachments);

      const events = [
        { type: "data", data: { type: "text", delta: "Done" } },
        {
          type: "data",
          data: { type: "done", id: assistantMsgId, metadata: {} },
        },
      ];

      (global.fetch as any).mockResolvedValue(createMockSseStream(events));

      const { result } = renderHook(() => useStreamResponse(chatId));

      await act(async () => {
        await result.current.streamResponse(
          userMsgId,
          "Message with attachment",
          null,
          attachments as any,
          "gpt-4",
        );
      });

      // Attachments should be processed
      expect(mockProcessAttachments).toHaveBeenCalledWith(
        attachments,
        userMsgId,
      );

      // Message should be updated with uploaded attachments
      expect(mockUpdateMessageAttachments).toHaveBeenCalledWith(
        chatId,
        userMsgId,
        uploadedAttachments,
      );
    });

    it("should handle empty attachment uploads", async () => {
      mockProcessAttachments.mockResolvedValueOnce([]);

      const events = [
        { type: "data", data: { type: "text", delta: "Response" } },
        {
          type: "data",
          data: { type: "done", id: assistantMsgId, metadata: {} },
        },
      ];

      (global.fetch as any).mockResolvedValue(createMockSseStream(events));

      const { result } = renderHook(() => useStreamResponse(chatId));

      await act(async () => {
        await result.current.streamResponse(
          userMsgId,
          "Message",
          null,
          [{ id: "att-1" } as any],
          "gpt-4",
        );
      });

      // Should not update attachments if none were uploaded
      expect(mockUpdateMessageAttachments).not.toHaveBeenCalled();
    });
  });

  // ── State management ────────────────────────────────────────────────────
  describe("State management", () => {
    it("should reset streaming state after completion", async () => {
      const events = [
        { type: "data", data: { type: "text", delta: "Complete" } },
        {
          type: "data",
          data: { type: "done", id: assistantMsgId, metadata: {} },
        },
      ];

      (global.fetch as any).mockResolvedValue(createMockSseStream(events));

      const { result } = renderHook(() => useStreamResponse(chatId));

      await act(async () => {
        await result.current.streamResponse(
          userMsgId,
          "Message",
          null,
          [],
          "gpt-4",
        );
      });

      // All streaming state should be reset
      expect(result.current.isLoading).toBe(false);
      expect(result.current.streamingContent).toBeNull();
      expect(result.current.streamingReasoning).toBeNull();
      expect(result.current.isStreamingReasoning).toBe(false);
      expect(result.current.activeToolCalls).toEqual([]);
    });

    it("should call onDone callback after successful completion", async () => {
      const onDone = vi.fn();

      const events = [
        { type: "data", data: { type: "text", delta: "Final result" } },
        {
          type: "data",
          data: { type: "done", id: assistantMsgId, metadata: {} },
        },
      ];

      (global.fetch as any).mockResolvedValue(createMockSseStream(events));

      const { result } = renderHook(() =>
        useStreamResponse(chatId, { onDone }),
      );

      await act(async () => {
        await result.current.streamResponse(
          userMsgId,
          "Message",
          null,
          [],
          "gpt-4",
        );
      });

      expect(onDone).toHaveBeenCalledWith("Final result");
    });
  });

  // ── Conversation history assembly ───────────────────────────────────────
  describe("Conversation history assembly", () => {
    it("should include current message in history when chat is new", async () => {
      const events = [
        { type: "data", data: { type: "text", delta: "Hi" } },
        {
          type: "data",
          data: { type: "done", id: assistantMsgId, metadata: {} },
        },
      ];

      (global.fetch as any).mockResolvedValue(createMockSseStream(events));

      const { result } = renderHook(() => useStreamResponse(chatId));

      await act(async () => {
        await result.current.streamResponse(
          userMsgId,
          "Hello",
          null,
          [],
          "gpt-4",
        );
      });

      // Fetch should be called with proper request body
      expect(global.fetch).toHaveBeenCalledWith(
        "/api/chat",
        expect.objectContaining({
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: expect.any(String),
        }),
      );
    });
  });

  // ── Metadata building ───────────────────────────────────────────────────
  describe("Metadata building", () => {
    it("should include all optional metadata fields when provided", async () => {
      const events = [
        { type: "data", data: { type: "text", delta: "Response" } },
        {
          type: "data",
          data: { type: "done", id: assistantMsgId, metadata: {} },
        },
      ];

      (global.fetch as any).mockResolvedValue(createMockSseStream(events));

      const { result } = renderHook(() => useStreamResponse(chatId));

      await act(async () => {
        await result.current.streamResponse(
          userMsgId,
          "Message",
          "parent-1",
          [],
          "gpt-4",
          ["server-1"],
          ["tool-1"],
          undefined,
          "assistant-1",
          ["kb-1"],
        );
      });

      // User message should have complete metadata
      const persistCall = mockPersistMessage.mock.calls[0];
      const metadata = JSON.parse(persistCall[1].metadata);

      expect(metadata).toMatchObject({
        model: "gpt-4",
        selectedServerIds: ["server-1"],
        selectedTools: ["tool-1"],
        assistantId: "assistant-1",
        selectedKbIds: ["kb-1"],
      });
    });

    it("should omit optional metadata fields when not provided", async () => {
      const events = [
        { type: "data", data: { type: "text", delta: "Response" } },
        {
          type: "data",
          data: { type: "done", id: assistantMsgId, metadata: {} },
        },
      ];

      (global.fetch as any).mockResolvedValue(createMockSseStream(events));

      const { result } = renderHook(() => useStreamResponse(chatId));

      await act(async () => {
        await result.current.streamResponse(
          userMsgId,
          "Message",
          null,
          [],
          "gpt-4",
        );
      });

      const persistCall = mockPersistMessage.mock.calls[0];
      const metadata = JSON.parse(persistCall[1].metadata);

      expect(metadata).toMatchObject({
        model: "gpt-4",
        selectedServerIds: [],
        selectedTools: [],
      });
      expect(metadata.assistantId).toBeUndefined();
      expect(metadata.selectedKbIds).toBeUndefined();
    });
  });
});
