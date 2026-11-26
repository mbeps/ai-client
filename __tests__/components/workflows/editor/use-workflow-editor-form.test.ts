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

  it("handles isNew=true, tool/subagent toggles, and success hydration", async () => {
    const { result, unmount } = renderHook(() =>
      useWorkflowEditorForm({
        id: "new",
        isNew: true,
        handleApiError: vi.fn(),
      }),
    );

    expect(result.current.nodes).toHaveLength(2);
    expect(result.current.edges).toHaveLength(1);

    act(() => {
      result.current.handleToggleTool("srv-1", "search");
      result.current.handleBulkSelectTools("srv-1", ["a", "b"], true);
      result.current.handleToggleSubagent("ag-1");
    });
    expect(result.current.tools.has("srv-1:search")).toBe(true);
    expect(result.current.subagentIds).toEqual(["ag-1"]);

    act(() => {
      result.current.handleToggleSubagent("ag-1");
    });
    expect(result.current.subagentIds).toEqual([]);
    unmount();

    mockGetWorkflow.mockResolvedValueOnce({
      ok: true,
      value: {
        id: "wf-1",
        name: "Loaded",
        description: null,
        globalContext: null,
        modelId: null,
        tools: [],
        skillMode: "dynamic",
        skillIds: [],
        knowledgeBaseIds: [],
        subagentIds: [],
        requiresFileUpload: false,
        canvasConfig: {},
        approvalConfig: {},
        webhookSecret: null,
        nodes: [],
        edges: [],
      },
    } as never);
    const { unmount: unmount2 } = renderHook(() =>
      useWorkflowEditorForm({
        id: "wf-1",
        isNew: false,
        handleApiError: vi.fn(),
      }),
    );
    await waitFor(() => {
      expect(mockGetWorkflow).toHaveBeenCalledWith("wf-1");
    });
    unmount2();
  });

  it("skips state updates if unmounted before getWorkflow resolves", async () => {
    let resolveOk!: (val: unknown) => void;
    let resolveErr!: (val: unknown) => void;
    let rejectCall!: (err: unknown) => void;

    mockGetWorkflow
      .mockImplementationOnce(() => new Promise((r) => { resolveOk = r; }))
      .mockImplementationOnce(() => new Promise((r) => { resolveErr = r; }))
      .mockImplementationOnce(() => new Promise((_, rej) => { rejectCall = rej; }));

    const handleApiError = vi.fn();

    const u1 = renderHook(() =>
      useWorkflowEditorForm({ id: "wf-1", isNew: false, handleApiError }),
    );
    u1.unmount();
    resolveOk({ ok: true, value: { id: "wf-1", name: "X", nodes: [], edges: [] } });

    const u2 = renderHook(() =>
      useWorkflowEditorForm({ id: "wf-2", isNew: false, handleApiError }),
    );
    u2.unmount();
    resolveErr({ ok: false, error: { code: ERROR_CODE.INTERNAL, message: "err" } });

    const u3 = renderHook(() =>
      useWorkflowEditorForm({ id: "wf-3", isNew: false, handleApiError }),
    );
    u3.unmount();
    rejectCall(new Error("network"));

    await Promise.resolve();
    expect(handleApiError).not.toHaveBeenCalled();
  });
});
