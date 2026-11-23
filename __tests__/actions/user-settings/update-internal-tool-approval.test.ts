import { beforeEach, describe, expect, it, vi } from "vitest";
import { ERROR_CODE } from "@/lib/error/error-code";

const {
  mockRequireSession,
  mockInsertValues,
  mockOnConflictDoNothing,
  mockSelectFrom,
  mockSelectWhere,
  mockSelectFor,
  mockUpdateSet,
  mockUpdateWhere,
  mockUpdateReturning,
  mockTransaction,
  mockRevalidatePath,
} = vi.hoisted(() => {
  const mockUpdateReturning = vi.fn();
  const mockUpdateWhere = vi.fn(() => ({ returning: mockUpdateReturning }));
  const mockUpdateSet = vi.fn(() => ({ where: mockUpdateWhere }));
  const mockSelectFor = vi.fn();
  const mockSelectWhere = vi.fn(() => ({ for: mockSelectFor }));
  const mockSelectFrom = vi.fn(() => ({ where: mockSelectWhere }));
  const mockOnConflictDoNothing = vi.fn().mockResolvedValue(undefined);
  const mockInsertValues = vi.fn(() => ({
    onConflictDoNothing: mockOnConflictDoNothing,
  }));
  const mockTx = {
    insert: vi.fn(() => ({ values: mockInsertValues })),
    select: vi.fn(() => ({ from: mockSelectFrom })),
    update: vi.fn(() => ({ set: mockUpdateSet })),
  };
  const mockTransaction = vi.fn(
    async (cb: (tx: typeof mockTx) => Promise<unknown>) => cb(mockTx),
  );
  const mockRequireSession = vi.fn();
  const mockRevalidatePath = vi.fn();

  return {
    mockRequireSession,
    mockInsertValues,
    mockOnConflictDoNothing,
    mockSelectFrom,
    mockSelectWhere,
    mockSelectFor,
    mockUpdateSet,
    mockUpdateWhere,
    mockUpdateReturning,
    mockTransaction,
    mockRevalidatePath,
  };
});

vi.mock("@/lib/auth/require-session", () => ({
  requireSession: () => mockRequireSession(),
}));

vi.mock("@/drizzle/db", () => ({
  db: {
    transaction: (...args: unknown[]) => mockTransaction(...args),
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
    mockOnConflictDoNothing.mockResolvedValue(undefined);
    mockSelectFor.mockResolvedValue([]);
  });

  it("rejects invalid approval values with INVALID_INPUT before any DB operations", async () => {
    const result = await updateInternalToolApproval({
      toolName: "save_memory",
      approval: "always" as any,
    });

    expect(result).toEqual({
      ok: false,
      error: expect.objectContaining({
        code: ERROR_CODE.INVALID_INPUT,
      }),
    });
    expect(mockTransaction).not.toHaveBeenCalled();
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
    expect(mockTransaction).not.toHaveBeenCalled();
  });

  it("stores an override when approval differs from catalogue default", async () => {
    mockSelectFor.mockResolvedValueOnce([
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
    mockUpdateReturning.mockResolvedValueOnce([updatedRow]);

    const result = await updateInternalToolApproval({
      toolName: "create_skill",
      approval: "auto",
    });

    expect(mockInsertValues).toHaveBeenCalledWith({ userId });
    expect(mockUpdateSet).toHaveBeenCalledWith(
      expect.objectContaining({
        internalToolApprovals: JSON.stringify({
          save_memory: "ask",
          create_skill: "auto",
        }),
        updatedAt: expect.any(Date),
      }),
    );
    expect(mockRevalidatePath).toHaveBeenCalledWith("/settings/tools");
    expect(result).toEqual({ ok: true, value: updatedRow });
  });

  it("prunes the override key when approval matches the catalogue default", async () => {
    mockSelectFor.mockResolvedValueOnce([
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
    mockUpdateReturning.mockResolvedValueOnce([updatedRow]);

    const result = await updateInternalToolApproval({
      toolName: "create_skill",
      approval: "ask", // defaultApproval for create_skill is "ask"
    });

    expect(mockUpdateSet).toHaveBeenCalledWith(
      expect.objectContaining({
        internalToolApprovals: JSON.stringify({ save_memory: "ask" }),
      }),
    );
    expect(result).toEqual({ ok: true, value: updatedRow });
  });

  it("stores block override when approval is set to block", async () => {
    mockSelectFor.mockResolvedValueOnce([]);
    const updatedRow = {
      id: "settings-1",
      userId,
      internalToolApprovals: JSON.stringify({ save_memory: "block" }),
    };
    mockUpdateReturning.mockResolvedValueOnce([updatedRow]);

    const result = await updateInternalToolApproval({
      toolName: "save_memory",
      approval: "block",
    });

    expect(mockUpdateSet).toHaveBeenCalledWith(
      expect.objectContaining({
        internalToolApprovals: JSON.stringify({ save_memory: "block" }),
      }),
    );
    expect(result).toEqual({ ok: true, value: updatedRow });
  });

  it("stores null when all overrides are pruned back to defaults", async () => {
    mockSelectFor.mockResolvedValueOnce([
      { internalToolApprovals: JSON.stringify({ create_skill: "auto" }) },
    ]);
    const updatedRow = {
      id: "settings-1",
      userId,
      internalToolApprovals: null,
    };
    mockUpdateReturning.mockResolvedValueOnce([updatedRow]);

    const result = await updateInternalToolApproval({
      toolName: "create_skill",
      approval: "ask",
    });

    expect(mockUpdateSet).toHaveBeenCalledWith(
      expect.objectContaining({
        internalToolApprovals: null,
      }),
    );
    expect(result).toEqual({ ok: true, value: updatedRow });
  });

  it("preserves both changes when two updates for the same user overlap without an initial row", async () => {
    // Simulate Postgres per-user row lock + insert onConflictDoNothing inside db.transaction
    let storedRow: {
      id: string;
      userId: string;
      internalToolApprovals: string | null;
      updatedAt?: Date;
    } | null = null;
    let txLock = Promise.resolve();

    mockTransaction.mockImplementation(async (cb) => {
      const prev = txLock;
      let release!: () => void;
      txLock = new Promise<void>((r) => {
        release = r;
      });
      await prev;

      try {
        const tx = {
          insert: vi.fn(() => ({
            values: vi.fn((vals: { userId: string }) => ({
              onConflictDoNothing: vi.fn(async () => {
                await Promise.resolve();
                if (!storedRow) {
                  storedRow = {
                    id: "settings-new",
                    userId: vals.userId,
                    internalToolApprovals: null,
                  };
                }
              }),
            })),
          })),
          select: vi.fn(() => ({
            from: vi.fn(() => ({
              where: vi.fn(() => ({
                for: vi.fn(async (mode: string) => {
                  expect(mode).toBe("update");
                  return storedRow ? [storedRow] : [];
                }),
              })),
            })),
          })),
          update: vi.fn(() => ({
            set: vi.fn((vals: { internalToolApprovals: string | null; updatedAt: Date }) => ({
              where: vi.fn(() => ({
                returning: vi.fn(async () => {
                  storedRow = {
                    ...(storedRow as NonNullable<typeof storedRow>),
                    internalToolApprovals: vals.internalToolApprovals,
                    updatedAt: vals.updatedAt,
                  };
                  return [storedRow];
                }),
              })),
            })),
          })),
        };
        return await cb(tx as any);
      } finally {
        release();
      }
    });

    const [res1, res2] = await Promise.all([
      updateInternalToolApproval({ toolName: "save_memory", approval: "block" }),
      updateInternalToolApproval({ toolName: "create_skill", approval: "auto" }),
    ]);

    expect(res1.ok).toBe(true);
    expect(res2.ok).toBe(true);
    expect(JSON.parse(storedRow!.internalToolApprovals!)).toEqual({
      save_memory: "block",
      create_skill: "auto",
    });
  });
});
