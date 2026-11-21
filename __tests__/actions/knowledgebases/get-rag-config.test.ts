import { beforeEach, describe, expect, it, vi } from "vitest";

const mockEnv = vi.hoisted(() => ({
  RAG_MODE: "hybrid" as "hybrid" | "vector" | "file_read",
}));

const mockRequireSession = vi.hoisted(() => vi.fn());

vi.mock("@/config/env", () => ({
  env: mockEnv,
}));

vi.mock("@/lib/auth/require-session", () => ({
  requireSession: mockRequireSession,
}));

import { getRagConfig } from "@/actions/knowledgebases/get-rag-config";

describe("getRagConfig action", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockEnv.RAG_MODE = "hybrid";
    mockRequireSession.mockResolvedValue({
      user: { id: "user-1", name: "Test User", email: "test@example.com" },
      session: { id: "session-1" },
    });
  });

  it("returns hybrid mode with requiresEmbedding true", async () => {
    mockEnv.RAG_MODE = "hybrid";

    const result = await getRagConfig();

    expect(result).toEqual({
      ok: true,
      value: { ragMode: "hybrid", requiresEmbedding: true },
    });
  });

  it("returns vector mode with requiresEmbedding true", async () => {
    mockEnv.RAG_MODE = "vector";

    const result = await getRagConfig();

    expect(result).toEqual({
      ok: true,
      value: { ragMode: "vector", requiresEmbedding: true },
    });
  });

  it("returns file_read mode with requiresEmbedding false", async () => {
    mockEnv.RAG_MODE = "file_read";

    const result = await getRagConfig();

    expect(result).toEqual({
      ok: true,
      value: { ragMode: "file_read", requiresEmbedding: false },
    });
  });

  it("returns error when session is missing", async () => {
    mockRequireSession.mockRejectedValueOnce(new Error("Unauthorized"));

    const result = await getRagConfig();

    expect(result.ok).toBe(false);
  });
});
