import { beforeEach, describe, expect, it, vi } from "vitest";
import { ERROR_CODE } from "@/lib/error/error-code";

const {
  mockRequireSession,
  mockSelectFrom,
  mockSelectWhere,
  mockDbInsert,
  mockValues,
  mockOnConflictDoUpdate,
  mockReturning,
  mockRevalidatePath,
} = vi.hoisted(() => {
  const mockReturning = vi.fn();
  const mockOnConflictDoUpdate = vi.fn(() => ({ returning: mockReturning }));
  const mockValues = vi.fn(() => ({ onConflictDoUpdate: mockOnConflictDoUpdate }));
  const mockDbInsert = vi.fn(() => ({ values: mockValues }));
  const mockSelectWhere = vi.fn();
  const mockSelectFrom = vi.fn(() => ({ where: mockSelectWhere }));
  const mockRequireSession = vi.fn();
  const mockRevalidatePath = vi.fn();

  return {
    mockRequireSession,
    mockSelectFrom,
    mockSelectWhere,
    mockDbInsert,
    mockValues,
    mockOnConflictDoUpdate,
    mockReturning,
    mockRevalidatePath,
  };
});

vi.mock("@/lib/auth/require-session", () => ({
  requireSession: () => mockRequireSession(),
}));

vi.mock("@/drizzle/db", () => ({
  db: {
    select: vi.fn(() => ({ from: mockSelectFrom })),
    insert: (...args: unknown[]) => mockDbInsert(...args),
  },
}));

vi.mock("next/cache", () => ({
  revalidatePath: (...args: unknown[]) => mockRevalidatePath(...args),
}));

import { updateInternalToolApproval } from "@/actions/user-settings/update-internal-tool-approval";

describe("updateInternalToolApproval", () => {
  const userId = "user-123";

  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireSession.mockResolvedValue({ user: { id: userId } });
    mockSelectWhere.mockResolvedValue([]);
  });

  it("rejects unknown toolName with INVALID_INPUT", async () => {
    const result = await updateInternalToolApproval({
      toolName: "non_existent_tool",
      approval: "auto",
    });

    expect(result).toEqual({
      ok: false,
      error: expect.objectContaining({
        code: ERROR_CODE.INVALID_INPUT,
      }),
    });
    expect(mockDbInsert).not.toHaveBeenCalled();
  });

  it("stores an override when approval differs from catalogue default", async () => {
    mockSelectWhere.mockResolvedValueOnce([
      { internalToolApprovals: JSON.stringify({ save_memory: "ask" }) },
    ]);
    const updatedRow = {
      id: "settings-1",
      userId,
      internalToolApprovals: JSON.stringify({
        save_memory: "ask",
        create_skill: "auto",
      }),
    };
    mockReturning.mockResolvedValueOnce([updatedRow]);

    const result = await updateInternalToolApproval({
      toolName: "create_skill",
      approval: "auto",
    });

    expect(mockValues).toHaveBeenCalledWith(
      expect.objectContaining({
        userId,
        internalToolApprovals: JSON.stringify({
          save_memory: "ask",
          create_skill: "auto",
        }),
      }),
    );
    expect(mockRevalidatePath).toHaveBeenCalledWith("/settings/tools");
    expect(result).toEqual({ ok: true, value: updatedRow });
  });

  it("prunes the override key when approval matches the catalogue default", async () => {
    mockSelectWhere.mockResolvedValueOnce([
      {
        internalToolApprovals: JSON.stringify({
          create_skill: "auto",
          save_memory: "ask",
        }),
      },
    ]);
    const updatedRow = {
      id: "settings-1",
      userId,
      internalToolApprovals: JSON.stringify({ save_memory: "ask" }),
    };
    mockReturning.mockResolvedValueOnce([updatedRow]);

    const result = await updateInternalToolApproval({
      toolName: "create_skill",
      approval: "ask", // defaultApproval for create_skill is "ask"
    });

    expect(mockValues).toHaveBeenCalledWith(
      expect.objectContaining({
        userId,
        internalToolApprovals: JSON.stringify({ save_memory: "ask" }),
      }),
    );
    expect(result).toEqual({ ok: true, value: updatedRow });
  });

  it("stores null when all overrides are pruned back to defaults", async () => {
    mockSelectWhere.mockResolvedValueOnce([
      { internalToolApprovals: JSON.stringify({ create_skill: "auto" }) },
    ]);
    const updatedRow = {
      id: "settings-1",
      userId,
      internalToolApprovals: null,
    };
    mockReturning.mockResolvedValueOnce([updatedRow]);

    const result = await updateInternalToolApproval({
      toolName: "create_skill",
      approval: "ask",
    });

    expect(mockValues).toHaveBeenCalledWith(
      expect.objectContaining({
        userId,
        internalToolApprovals: null,
      }),
    );
    expect(result).toEqual({ ok: true, value: updatedRow });
  });
});
