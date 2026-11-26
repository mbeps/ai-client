import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useWorkflowRunDialog } from "@/components/workflows/editor/use-workflow-run-dialog";

const mockPush = vi.hoisted(() => vi.fn());
const mockCreateWorkflowRun = vi.hoisted(() => vi.fn());
const mockUploadWorkflowRunFiles = vi.hoisted(() => vi.fn());
const mockToastError = vi.hoisted(() => vi.fn());
const mockToastSuccess = vi.hoisted(() => vi.fn());

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
  unstable_rethrow: vi.fn(),
}));
vi.mock("@/actions/workflow-runs/create-workflow-run", () => ({
  createWorkflowRun: mockCreateWorkflowRun,
}));
vi.mock("@/components/workflows/editor/workflow-editor-helpers", () => ({
  uploadWorkflowRunFiles: mockUploadWorkflowRunFiles,
}));
vi.mock("sonner", () => ({
  toast: { error: mockToastError, success: mockToastSuccess },
}));

describe("useWorkflowRunDialog", () => {
  const handleApiError = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("validates required file upload and JSON payload", async () => {
    const { result, unmount } = renderHook(() =>
      useWorkflowRunDialog({
        workflowId: "wf-1",
        requiresFileUpload: true,
        handleApiError,
      }),
    );

    await act(async () => {
      await result.current.handleStartRun();
    });
    expect(mockToastError).toHaveBeenCalledWith("Please select at least one input file");

    act(() => {
      result.current.setRunFiles([new File(["a"], "a.txt")]);
      result.current.setInitialInputJson("{bad json");
    });
    await act(async () => {
      await result.current.handleStartRun();
    });
    expect(mockToastError).toHaveBeenCalledWith("Invalid JSON trigger payload");

    act(() => {
      result.current.setInitialInputJson("[1, 2]");
    });
    await act(async () => {
      await result.current.handleStartRun();
    });
    expect(mockToastError).toHaveBeenCalledWith("Trigger payload must be a JSON object");

    unmount();
  });

  it("handles upload failure, create failure, thrown error, and success", async () => {
    const { result, unmount } = renderHook(() =>
      useWorkflowRunDialog({
        workflowId: "wf-1",
        requiresFileUpload: false,
        handleApiError,
      }),
    );

    act(() => {
      result.current.setRunDialogOpen(true);
      result.current.setInitialInputJson('{"key":"val"}');
    });

    // Upload fails
    mockUploadWorkflowRunFiles.mockResolvedValueOnce({
      ok: false,
      error: { message: "Upload err" },
    });
    await act(async () => {
      await result.current.handleStartRun();
    });
    expect(handleApiError).toHaveBeenCalledWith({ message: "Upload err" }, "Failed to upload files");

    // Create fails
    mockUploadWorkflowRunFiles.mockResolvedValueOnce({ ok: true, value: ["att-1"] });
    mockCreateWorkflowRun.mockResolvedValueOnce({
      ok: false,
      error: { message: "Create err" },
    });
    await act(async () => {
      await result.current.handleStartRun();
    });
    expect(handleApiError).toHaveBeenCalledWith({ message: "Create err" }, "Failed to start workflow run");

    // Thrown error
    mockUploadWorkflowRunFiles.mockRejectedValueOnce(new Error("Network"));
    await act(async () => {
      await result.current.handleStartRun();
    });
    expect(handleApiError).toHaveBeenCalledWith(expect.any(Error), "Failed to start workflow run");

    // Success
    mockUploadWorkflowRunFiles.mockResolvedValueOnce({ ok: true, value: ["att-1"] });
    mockCreateWorkflowRun.mockResolvedValueOnce({ ok: true, value: { id: "run-99" } });
    await act(async () => {
      await result.current.handleStartRun();
    });
    expect(mockToastSuccess).toHaveBeenCalledWith("Workflow run started");
    expect(result.current.runDialogOpen).toBe(false);
    expect(mockPush).toHaveBeenCalledWith("/workflows/wf-1/run-99");

    // Empty initialInputJson skips JSON.parse
    act(() => {
      result.current.setInitialInputJson("   ");
    });
    mockUploadWorkflowRunFiles.mockResolvedValueOnce({ ok: true, value: ["att-1"] });
    mockCreateWorkflowRun.mockResolvedValueOnce({ ok: true, value: { id: "run-100" } });
    await act(async () => {
      await result.current.handleStartRun();
    });
    expect(mockCreateWorkflowRun).toHaveBeenLastCalledWith(
      expect.objectContaining({ initialData: {} }),
    );

    unmount();
  });
});
