import { describe, it, expect, beforeEach, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useEntityOptions } from "@/hooks/use-entity-options";

// ─── Hoisted mock variables (must run before vi.mock factories) ────────────
const mockPush = vi.hoisted(() => vi.fn());
const mockToastSuccess = vi.hoisted(() => vi.fn());
const mockToastError = vi.hoisted(() => vi.fn());

// ─── Mocks ─────────────────────────────────────────────────────────────────
vi.mock("next/navigation", () => ({
  useRouter: vi.fn().mockReturnValue({ push: mockPush }),
}));

vi.mock("sonner", () => ({
  toast: {
    success: mockToastSuccess,
    error: mockToastError,
  },
}));

// Mock useIsMobile
vi.mock("@/hooks/use-is-mobile", () => ({
  useIsMobile: vi.fn().mockReturnValue(false),
}));

// ─── Tests ─────────────────────────────────────────────────────────────────
describe("useEntityOptions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── Initial state ────────────────────────────────────────────────────────
  describe("initial state", () => {
    it("returns showRename=false, showDelete=false, isDeleting=false", () => {
      const { result } = renderHook(() =>
        useEntityOptions({ id: "ent-1", type: "Project" }),
      );
      expect(result.current.showRename).toBe(false);
      expect(result.current.showDelete).toBe(false);
      expect(result.current.isDeleting).toBe(false);
    });

    it("exposes isMobile from the hook", () => {
      const { result } = renderHook(() =>
        useEntityOptions({ id: "ent-1", type: "Project" }),
      );
      expect(result.current.isMobile).toBe(false);
    });
  });

  // ── dialog state setters ─────────────────────────────────────────────────
  describe("dialog state", () => {
    it("setShowRename toggles showRename", () => {
      const { result } = renderHook(() =>
        useEntityOptions({ id: "ent-1", type: "Project" }),
      );
      act(() => result.current.setShowRename(true));
      expect(result.current.showRename).toBe(true);
      act(() => result.current.setShowRename(false));
      expect(result.current.showRename).toBe(false);
    });

    it("setShowDelete toggles showDelete", () => {
      const { result } = renderHook(() =>
        useEntityOptions({ id: "ent-1", type: "Project" }),
      );
      act(() => result.current.setShowDelete(true));
      expect(result.current.showDelete).toBe(true);
    });
  });

  // ── handleRename ─────────────────────────────────────────────────────────
  describe("handleRename", () => {
    it("calls onRename with the entity id and new name", async () => {
      const onRename = vi.fn().mockResolvedValue(undefined);
      const { result } = renderHook(() =>
        useEntityOptions({ id: "ent-1", type: "Project", onRename }),
      );

      await act(async () => {
        await result.current.handleRename("New Name");
      });

      expect(onRename).toHaveBeenCalledWith("ent-1", "New Name");
    });

    it("shows a success toast on success", async () => {
      const onRename = vi.fn().mockResolvedValue(undefined);
      const { result } = renderHook(() =>
        useEntityOptions({ id: "ent-1", type: "Project", onRename }),
      );

      await act(async () => {
        await result.current.handleRename("New Name");
      });

      expect(mockToastSuccess).toHaveBeenCalledWith("Project renamed");
    });

    it("shows an error toast and re-throws on failure", async () => {
      const onRename = vi.fn().mockRejectedValue(new Error("rename failed"));
      const { result } = renderHook(() =>
        useEntityOptions({ id: "ent-1", type: "Project", onRename }),
      );

      await expect(
        act(async () => {
          await result.current.handleRename("Bad Name");
        }),
      ).rejects.toThrow("rename failed");

      expect(mockToastError).toHaveBeenCalledWith("Failed to rename project");
    });

    it("does nothing when onRename is not provided", async () => {
      const { result } = renderHook(() =>
        useEntityOptions({ id: "ent-1", type: "Project" }),
      );

      await act(async () => {
        await result.current.handleRename("Whatever");
      });

      expect(mockToastSuccess).not.toHaveBeenCalled();
    });
  });

  // ── handleDelete ─────────────────────────────────────────────────────────
  describe("handleDelete", () => {
    it("calls onDelete with the entity id", async () => {
      const onDelete = vi.fn().mockResolvedValue(undefined);
      const { result } = renderHook(() =>
        useEntityOptions({ id: "ent-1", type: "Assistant", onDelete }),
      );

      await act(async () => {
        await result.current.handleDelete();
      });

      expect(onDelete).toHaveBeenCalledWith("ent-1");
    });

    it("shows a success toast on success", async () => {
      const onDelete = vi.fn().mockResolvedValue(undefined);
      const { result } = renderHook(() =>
        useEntityOptions({ id: "ent-1", type: "Assistant", onDelete }),
      );

      await act(async () => {
        await result.current.handleDelete();
      });

      expect(mockToastSuccess).toHaveBeenCalledWith("Assistant deleted");
    });

    it("navigates to redirectPath after successful deletion", async () => {
      const onDelete = vi.fn().mockResolvedValue(undefined);
      const { result } = renderHook(() =>
        useEntityOptions({
          id: "ent-1",
          type: "Assistant",
          onDelete,
          redirectPath: "/assistants",
        }),
      );

      await act(async () => {
        await result.current.handleDelete();
      });

      expect(mockPush).toHaveBeenCalledWith("/assistants");
    });

    it("does not navigate when redirectPath is not provided", async () => {
      const onDelete = vi.fn().mockResolvedValue(undefined);
      const { result } = renderHook(() =>
        useEntityOptions({ id: "ent-1", type: "Assistant", onDelete }),
      );

      await act(async () => {
        await result.current.handleDelete();
      });

      expect(mockPush).not.toHaveBeenCalled();
    });

    it("shows error toast and resets isDeleting on failure", async () => {
      const onDelete = vi.fn().mockRejectedValue(new Error("delete failed"));
      const { result } = renderHook(() =>
        useEntityOptions({ id: "ent-1", type: "Assistant", onDelete }),
      );

      await act(async () => {
        await result.current.handleDelete();
      });

      expect(mockToastError).toHaveBeenCalledWith("Failed to delete assistant");
      expect(result.current.isDeleting).toBe(false);
    });

    it("sets isDeleting=true during deletion and false after", async () => {
      let resolveDelete!: () => void;
      const onDelete = vi.fn().mockReturnValue(
        new Promise<void>((res) => {
          resolveDelete = res;
        }),
      );
      const { result } = renderHook(() =>
        useEntityOptions({ id: "ent-1", type: "Project", onDelete }),
      );

      // Start deleting but don't await — check isDeleting immediately
      act(() => {
        result.current.handleDelete();
      });
      expect(result.current.isDeleting).toBe(true);

      // Resolve the promise and check it resets
      await act(async () => {
        resolveDelete();
      });
      expect(result.current.isDeleting).toBe(false);
    });

    it("does nothing when onDelete is not provided", async () => {
      const { result } = renderHook(() =>
        useEntityOptions({ id: "ent-1", type: "Project" }),
      );

      await act(async () => {
        await result.current.handleDelete();
      });

      expect(mockToastSuccess).not.toHaveBeenCalled();
    });
  });
});
