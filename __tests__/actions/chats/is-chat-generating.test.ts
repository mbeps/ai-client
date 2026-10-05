import { beforeEach, describe, expect, it, vi } from "vitest";

const mockRequireSession = vi.hoisted(() => vi.fn());
const mockFetchUserInngestRuns = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth/require-session", () => ({
  requireSession: mockRequireSession,
}));

vi.mock("@/lib/inngest/run-service", () => ({
  fetchUserInngestRuns: mockFetchUserInngestRuns,
}));

vi.mock("@/lib/logger", () => ({
  logger: {
    warn: vi.fn(),
    info: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

import { isChatGenerating } from "@/actions/chats/is-chat-generating";

describe("isChatGenerating server action", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireSession.mockResolvedValue({
      user: { id: "user-123" },
      session: { id: "session-123" },
    });
  });

  it("returns true for a RUNNING chat job with matching entityId", async () => {
    mockFetchUserInngestRuns.mockResolvedValueOnce({
      jobs: [
        {
          runId: "run-1",
          type: "chat",
          entityId: "chat-123",
          status: "RUNNING",
          title: "Chat generation",
          createdAt: new Date().toISOString(),
        },
      ],
    });

    const result = await isChatGenerating("chat-123");
    expect(result).toBe(true);
    expect(mockFetchUserInngestRuns).toHaveBeenCalledWith("user-123", {
      status: ["RUNNING", "QUEUED"],
      limit: 20,
    });
  });

  it("returns true for a QUEUED chat job with matching entityId", async () => {
    mockFetchUserInngestRuns.mockResolvedValueOnce({
      jobs: [
        {
          runId: "run-2",
          type: "chat",
          entityId: "chat-123",
          status: "QUEUED",
          title: "Chat generation",
          createdAt: new Date().toISOString(),
        },
      ],
    });

    const result = await isChatGenerating("chat-123");
    expect(result).toBe(true);
  });

  it("returns false for a chat job with a different entityId", async () => {
    mockFetchUserInngestRuns.mockResolvedValueOnce({
      jobs: [
        {
          runId: "run-3",
          type: "chat",
          entityId: "chat-999",
          status: "RUNNING",
          title: "Chat generation",
          createdAt: new Date().toISOString(),
        },
      ],
    });

    const result = await isChatGenerating("chat-123");
    expect(result).toBe(false);
  });

  it("returns false for a non-chat job with matching entityId", async () => {
    mockFetchUserInngestRuns.mockResolvedValueOnce({
      jobs: [
        {
          runId: "run-4",
          type: "kb-ingest",
          entityId: "chat-123",
          status: "RUNNING",
          title: "KB ingest",
          createdAt: new Date().toISOString(),
        },
      ],
    });

    const result = await isChatGenerating("chat-123");
    expect(result).toBe(false);
  });

  it("returns false for an empty jobs list", async () => {
    mockFetchUserInngestRuns.mockResolvedValueOnce({
      jobs: [],
    });

    const result = await isChatGenerating("chat-123");
    expect(result).toBe(false);
  });

  it("returns false when run service reports offline", async () => {
    mockFetchUserInngestRuns.mockResolvedValueOnce({
      jobs: [],
      offline: true,
      error: "Service unavailable",
    });

    const result = await isChatGenerating("chat-123");
    expect(result).toBe(false);
  });

  it("returns false when requireSession throws an error", async () => {
    mockRequireSession.mockRejectedValueOnce(new Error("Unauthorized"));

    const result = await isChatGenerating("chat-123");
    expect(result).toBe(false);
  });

  it("returns false when fetchUserInngestRuns throws an error", async () => {
    mockFetchUserInngestRuns.mockRejectedValueOnce(new Error("Network failure"));

    const result = await isChatGenerating("chat-123");
    expect(result).toBe(false);
  });
});
