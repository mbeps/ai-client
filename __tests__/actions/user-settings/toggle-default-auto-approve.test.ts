import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  mockRequireSession,
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
  const mockRequireSession = vi.fn();
  const mockRevalidatePath = vi.fn();
  return {
    mockRequireSession,
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
    insert: (...args: unknown[]) => mockDbInsert(...args),
  },
}));

vi.mock("next/cache", () => ({
  revalidatePath: (...args: unknown[]) => mockRevalidatePath(...args),
}));

import { toggleDefaultAutoApprove } from "@/actions/user-settings/toggle-default-auto-approve";
import { ROUTES } from "@/config/routes";

describe("toggleDefaultAutoApprove", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireSession.mockResolvedValue({ user: { id: "user-123" } });
  });

  it("updates defaultAutoApprove to true and revalidates tools settings", async () => {
    mockReturning.mockResolvedValue([
      {
        id: "settings-1",
        userId: "user-123",
        defaultAutoApprove: true,
        updatedAt: new Date(),
      },
    ]);

    const result = await toggleDefaultAutoApprove(true);

    expect(mockRequireSession).toHaveBeenCalled();
    expect(mockDbInsert).toHaveBeenCalled();
    expect(mockValues).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "user-123",
        defaultAutoApprove: true,
      }),
    );
    expect(mockRevalidatePath).toHaveBeenCalledWith(ROUTES.SETTINGS.APP.path);
    expect(result).toEqual({
      ok: true,
      value: expect.objectContaining({ defaultAutoApprove: true }),
    });
  });

  it("updates defaultAutoApprove to false", async () => {
    mockReturning.mockResolvedValue([
      {
        id: "settings-1",
        userId: "user-123",
        defaultAutoApprove: false,
        updatedAt: new Date(),
      },
    ]);

    const result = await toggleDefaultAutoApprove(false);

    expect(mockValues).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "user-123",
        defaultAutoApprove: false,
      }),
    );
    expect(result).toEqual({
      ok: true,
      value: expect.objectContaining({ defaultAutoApprove: false }),
    });
  });

  it("returns validation error when input is not a boolean", async () => {
    const result = await toggleDefaultAutoApprove("invalid" as unknown as boolean);

    expect(result.ok).toBe(false);
    expect(mockDbInsert).not.toHaveBeenCalled();
  });
});
