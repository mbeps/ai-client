import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ERROR_CODE } from "@/lib/error/error-code";

const mockGetWorkflow = vi.hoisted(() => vi.fn());
const mockLoadMcpServers = vi.hoisted(() => vi.fn());
const mockLoadSkills = vi.hoisted(() => vi.fn());
const mockLoadAgents = vi.hoisted(() => vi.fn());
const mockNotFound = vi.hoisted(() => vi.fn());

vi.mock("next/navigation", () => ({
  notFound: mockNotFound,
}));

vi.mock("@/actions/workflows/get-workflow", () => ({
  getWorkflow: mockGetWorkflow,
}));
vi.mock("@/lib/stores/app-store", () => ({
  useAppStore: () => ({
    mcpServers: [{ id: "srv-1" }],
    loadMcpServers: mockLoadMcpServers,
    skills: [{ id: "sk-1" }],
    loadSkills: mockLoadSkills,
    agents: [{ id: "ag-1" }],
    loadAgents: mockLoadAgents,
  }),
}));
vi.mock("@/hooks/use-knowledgebases", () => ({
  useKnowledgebases: () => ({ normalizedKnowledgebases: [] }),
}));

import { useWorkflowEditorForm } from "@/components/workflows/editor/use-workflow-editor-form";

describe("useWorkflowEditorForm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("sets isNotFound state when getWorkflow returns NOT_FOUND", async () => {
    const handleApiError = vi.fn();
    mockGetWorkflow.mockResolvedValueOnce({
      ok: false,
      error: { code: ERROR_CODE.NOT_FOUND, message: "Missing" },
    });

    const { result } = renderHook(() =>
      useWorkflowEditorForm({
        id: "wf-missing",
        isNew: false,
        handleApiError,
      }),
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.isNotFound).toBe(true);
    expect(mockNotFound).toHaveBeenCalledTimes(1);
    expect(handleApiError).not.toHaveBeenCalled();
  });

  it("calls handleApiError without setting isNotFound on non-NOT_FOUND errors", async () => {
    const handleApiError = vi.fn();
    mockGetWorkflow.mockResolvedValueOnce({
      ok: false,
      error: { code: ERROR_CODE.INTERNAL, message: "Server down" },
    });

    const { result } = renderHook(() =>
      useWorkflowEditorForm({
        id: "wf-err",
        isNew: false,
        handleApiError,
      }),
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.isNotFound).toBe(false);
    expect(handleApiError).toHaveBeenCalledWith(
      { code: ERROR_CODE.INTERNAL, message: "Server down" },
      "Failed to load workflow",
    );
  });

  it("also handles unexpected rejection via handleApiError", async () => {
    const handleApiError = vi.fn();
    const boom = new Error("Network failure");
    mockGetWorkflow.mockRejectedValueOnce(boom);

    const { result } = renderHook(() =>
      useWorkflowEditorForm({
        id: "wf-reject",
        isNew: false,
        handleApiError,
      }),
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    await act(async () => {});
    expect(result.current.isNotFound).toBe(false);
    expect(handleApiError).toHaveBeenCalledWith(boom, "Failed to load workflow");
  });
});
