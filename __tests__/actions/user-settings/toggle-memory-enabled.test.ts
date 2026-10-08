import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockRequireSession, mockDbInsert, mockValues, mockOnConflictDoUpdate, mockReturning } =
  vi.hoisted(() => {
    const mockReturning = vi.fn();
    const mockOnConflictDoUpdate = vi.fn(() => ({ returning: mockReturning }));
    const mockValues = vi.fn(() => ({ onConflictDoUpdate: mockOnConflictDoUpdate }));
    const mockDbInsert = vi.fn(() => ({ values: mockValues }));
    const mockRequireSession = vi.fn();
    return {
      mockRequireSession,
      mockDbInsert,
      mockValues,
      mockOnConflictDoUpdate,
      mockReturning,
    };
  });

vi.mock("@/lib/auth/require-session", () => ({
  requireSession: () => mockRequireSession(),
}));

vi.mock("@/drizzle/db", () => ({
  db: {
    insert: (...args: unknown[]) => mockDbInsert(...args),
  },
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

import { toggleMemoryEnabled } from "@/actions/user-settings/toggle-memory-enabled";

describe("toggleMemoryEnabled", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireSession.mockResolvedValue({ user: { id: "user-123" } });
  });

  it("updates memoryEnabled to false", async () => {
    mockReturning.mockResolvedValue([
      {
        id: "settings-1",
        userId: "user-123",
        memoryEnabled: false,
        updatedAt: new Date(),
      },
    ]);

    const result = await toggleMemoryEnabled(false);

    expect(mockRequireSession).toHaveBeenCalled();
    expect(mockDbInsert).toHaveBeenCalled();
    expect(mockValues).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "user-123",
        memoryEnabled: false,
      }),
    );
    expect(result.memoryEnabled).toBe(false);
  });

  it("updates memoryEnabled to true", async () => {
    mockReturning.mockResolvedValue([
      {
        id: "settings-1",
        userId: "user-123",
        memoryEnabled: true,
        updatedAt: new Date(),
      },
    ]);

    const result = await toggleMemoryEnabled(true);

    expect(mockValues).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "user-123",
        memoryEnabled: true,
      }),
    );
    expect(result.memoryEnabled).toBe(true);
  });
});

