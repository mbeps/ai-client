import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock auth session
const mockRequireSession = vi.hoisted(() => vi.fn());
vi.mock("@/lib/auth/require-session", () => ({
  requireSession: mockRequireSession,
}));

// Mock Inngest run service
const mockCancelInngestRun = vi.hoisted(() => vi.fn());
vi.mock("@/lib/inngest/run-service", () => ({
  cancelInngestRun: mockCancelInngestRun,
}));

// Mock chat abort registry
const mockChatAbortRegistry = vi.hoisted(() => ({
  abort: vi.fn().mockReturnValue(true),
}));
vi.mock("@/lib/chat/chat-abort-registry", () => ({
  chatAbortRegistry: mockChatAbortRegistry,
}));

// Mock Inngest client
const mockInngest = vi.hoisted(() => ({
  send: vi.fn().mockResolvedValue({ ids: ["evt-1"] }),
}));
vi.mock("@/lib/inngest/client", () => ({
  inngest: mockInngest,
}));

// Mock Drizzle database
const mockUpdateWhere = vi.hoisted(() => vi.fn().mockResolvedValue([]));
const mockUpdateSet = vi.hoisted(() => vi.fn().mockReturnValue({ where: mockUpdateWhere }));
const mockUpdate = vi.hoisted(() => vi.fn().mockReturnValue({ set: mockUpdateSet }));

vi.mock("@/drizzle/db", () => ({
  db: {
    update: mockUpdate,
  },
}));

import { cancelJob, cancelJobAction } from "@/actions/jobs/cancel-job";
import { transformRun } from "@/drizzle/schema";

describe("cancelJob Server Action", () => {
  const mockUser = { id: "user-123", email: "test@example.com" };

  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireSession.mockResolvedValue({
      user: mockUser,
      session: { id: "session-abc" },
    });
    mockCancelInngestRun.mockResolvedValue({ success: true });
  });

  describe("Authentication", () => {
    it("throws unauthorized error when session is missing", async () => {
      mockRequireSession.mockRejectedValueOnce(new Error("Unauthorized"));

      await expect(cancelJob("run-123")).rejects.toThrow("Unauthorized");
    });

    it("throws unauthorized error when session user is missing", async () => {
      mockRequireSession.mockResolvedValueOnce({ session: { id: "session-abc" } });

      await expect(cancelJob("run-123")).rejects.toThrow("Unauthorized");
    });
  });

  describe("Inngest Cancellation", () => {
    it("calls cancelInngestRun with runId and user ID, returning success", async () => {
      const result = await cancelJob("run-123");

      expect(mockCancelInngestRun).toHaveBeenCalledWith("run-123", mockUser.id);
      expect(result).toEqual({ success: true });
      expect(mockChatAbortRegistry.abort).not.toHaveBeenCalled();
      expect(mockInngest.send).not.toHaveBeenCalled();
      expect(mockUpdate).not.toHaveBeenCalled();
    });

    it("returns failure when cancelInngestRun returns failure", async () => {
      mockCancelInngestRun.mockResolvedValueOnce({
        success: false,
        error: "Run not found or already completed",
      });

      const result = await cancelJob("run-123");

      expect(result).toEqual({
        success: false,
        error: "Run not found or already completed",
      });
    });
  });

  describe("Dual-Layer Abort for Chat", () => {
    it("aborts in-memory controller, dispatches realtime/cancel events, and does not invoke cancelInngestRun to preserve COMPLETED status", async () => {
      const result = await cancelJob("run-123", { chatId: "chat-xyz" });

      expect(mockCancelInngestRun).not.toHaveBeenCalled();
      expect(mockChatAbortRegistry.abort).toHaveBeenCalledWith("chat-xyz");
      expect(mockInngest.send).toHaveBeenCalledWith({
        name: "chat/response.cancel",
        data: {
          chatId: "chat-xyz",
          userId: mockUser.id,
        },
      });
      expect(result).toEqual({ success: true });
    });
  });

  describe("Dual-Layer Abort for Transform Workflows", () => {
    it("updates transformRun status in DB to failed", async () => {
      const result = await cancelJob("run-123", {
        transformRunId: "run-tf-999",
      });

      expect(mockCancelInngestRun).toHaveBeenCalledWith("run-123", mockUser.id);
      expect(mockUpdate).toHaveBeenCalledWith(transformRun);
      expect(mockUpdateSet).toHaveBeenCalledWith({
        status: "failed",
        errorMessage: "Cancelled by user",
      });
      expect(mockUpdateWhere).toHaveBeenCalled();
      expect(mockInngest.send).not.toHaveBeenCalled();
      expect(result).toEqual({ success: true });
    });
  });

  describe("Dual-Layer Abort with Both Chat and Transform Options", () => {
    it("executes both abort pathways if both options are provided", async () => {
      const result = await cancelJob("run-123", {
        chatId: "chat-xyz",
        transformRunId: "run-tf-999",
      });

      expect(mockChatAbortRegistry.abort).toHaveBeenCalledWith("chat-xyz");
      expect(mockInngest.send).toHaveBeenCalledWith({
        name: "chat/response.cancel",
        data: {
          chatId: "chat-xyz",
          userId: mockUser.id,
        },
      });
      expect(mockUpdate).toHaveBeenCalledWith(transformRun);
      expect(result).toEqual({ success: true });
    });
  });
});

describe("cancelJobAction alias", () => {
  const mockUser = { id: "user-123", email: "test@example.com" };

  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireSession.mockResolvedValue({
      user: mockUser,
      session: { id: "session-abc" },
    });
    mockCancelInngestRun.mockResolvedValue({ success: true });
  });

  it("delegates to cancelJob and returns its result", async () => {
    const result = await cancelJobAction("run-abc");

    expect(mockCancelInngestRun).toHaveBeenCalledWith("run-abc", mockUser.id);
    expect(result).toEqual({ success: true });
  });

  it("forwards options to the transform cancel path", async () => {
    const result = await cancelJobAction("run-abc", {
      transformRunId: "run-tf-777",
    });

    expect(mockUpdate).toHaveBeenCalledWith(transformRun);
    expect(mockUpdateSet).toHaveBeenCalledWith({
      status: "failed",
      errorMessage: "Cancelled by user",
    });
    expect(mockInngest.send).not.toHaveBeenCalled();
    expect(result).toEqual({ success: true });
  });

  it("propagates the failure result from the delegated call", async () => {
    mockCancelInngestRun.mockResolvedValueOnce({
      success: false,
      error: "Run not found or already completed",
    });

    const result = await cancelJobAction("run-abc");

    expect(result).toEqual({
      success: false,
      error: "Run not found or already completed",
    });
  });
});
