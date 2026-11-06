import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createTransformRun } from "@/actions/transform-runs/create-transform-run";
import { uploadRunInputFiles } from "@/components/workflows/sheet-flow/agent-editor-helpers";
import { useAgentRunDialog } from "@/components/workflows/sheet-flow/use-agent-run-dialog";
import { ROUTES } from "@/config/routes";

const mockPush = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
}));

vi.mock("sonner", () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

import { toast } from "sonner";

vi.mock("@/actions/transform-runs/create-transform-run", () => ({
  createTransformRun: vi.fn(),
}));

vi.mock("@/components/workflows/sheet-flow/agent-editor-helpers", () => ({
  uploadRunInputFiles: vi.fn(),
}));

describe("useAgentRunDialog hook", () => {
  const handleApiError = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("blocks start run when requiresFileUpload is true and no files selected", async () => {
    const { result } = renderHook(() =>
      useAgentRunDialog({
        id: "agent-1",
        requiresFileUpload: true,
        handleApiError,
      }),
    );

    await act(async () => {
      await result.current.handleStartRun();
    });

    expect(toast.error).toHaveBeenCalledWith("Please select at least one file");
    expect(uploadRunInputFiles).not.toHaveBeenCalled();
    expect(createTransformRun).not.toHaveBeenCalled();
  });

  it("handles upload failure via handleApiError without throwing", async () => {
    const uploadError = { code: "FILE_TOO_LARGE", message: "File exceeds 50MB" };
    vi.mocked(uploadRunInputFiles).mockResolvedValue({
      ok: false,
      error: uploadError as any,
    });

    const { result } = renderHook(() =>
      useAgentRunDialog({
        id: "agent-1",
        requiresFileUpload: false,
        handleApiError,
      }),
    );

    act(() => {
      result.current.setRunFiles([new File(["test"], "data.csv")]);
    });

    await act(async () => {
      await result.current.handleStartRun();
    });

    expect(handleApiError).toHaveBeenCalledWith(
      uploadError,
      "Failed to upload files",
    );
    expect(createTransformRun).not.toHaveBeenCalled();
    expect(result.current.isStartingRun).toBe(false);
  });

  it("handles createTransformRun error Result via handleApiError without throwing", async () => {
    vi.mocked(uploadRunInputFiles).mockResolvedValue({
      ok: true,
      value: [],
    });
    const runError = { code: "NOT_FOUND", message: "Agent not found" };
    vi.mocked(createTransformRun).mockResolvedValue({
      ok: false,
      error: runError as any,
    });

    const { result } = renderHook(() =>
      useAgentRunDialog({
        id: "agent-1",
        requiresFileUpload: false,
        handleApiError,
      }),
    );

    await act(async () => {
      await result.current.handleStartRun();
    });

    expect(handleApiError).toHaveBeenCalledWith(
      runError,
      "Failed to start run",
    );
    expect(toast.success).not.toHaveBeenCalled();
    expect(result.current.isStartingRun).toBe(false);
  });

  it("successfully creates a transform run and navigates to the run detail route", async () => {
    vi.mocked(uploadRunInputFiles).mockResolvedValue({
      ok: true,
      value: ["att-1"],
    });
    const mockRun = { id: "run-99" };
    vi.mocked(createTransformRun).mockResolvedValue({
      ok: true,
      value: mockRun as any,
    });

    const { result } = renderHook(() =>
      useAgentRunDialog({
        id: "agent-1",
        requiresFileUpload: false,
        handleApiError,
      }),
    );

    act(() => {
      result.current.setRunFiles([new File(["test"], "file.txt")]);
      result.current.setRunDialogOpen(true);
    });

    await act(async () => {
      await result.current.handleStartRun();
    });

    expect(toast.success).toHaveBeenCalledWith("Run started successfully");
    expect(result.current.runDialogOpen).toBe(false);
    expect(result.current.runFiles).toEqual([]);
    expect(mockPush).toHaveBeenCalledWith(
      ROUTES.WORKFLOWS.TRANSFORM.runs("agent-1", "run-99"),
    );
  });
});
