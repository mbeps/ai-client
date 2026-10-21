import { render, screen, waitFor } from "@testing-library/react";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import TransformRunDetailPage from "@/app/workflows/transform/[id]/[runId]/page";

beforeAll(() => {
  global.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
});

const mockNotFound = vi.hoisted(() => vi.fn());
vi.mock("next/navigation", () => ({
  useParams: () => ({ id: "agent-1", runId: "run-1" }),
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
  notFound: mockNotFound,
}));

vi.mock("inngest/react", () => ({
  useRealtime: () => ({
    messages: { all: [] },
  }),
}));

const mockGetTransformRun = vi.hoisted(() => vi.fn());
vi.mock("@/actions/transform-runs/get-transform-run", () => ({
  getTransformRun: mockGetTransformRun,
}));

const mockGetTransformAgent = vi.hoisted(() => vi.fn());
vi.mock("@/actions/transform-agents/get-transform-agent", () => ({
  getTransformAgent: mockGetTransformAgent,
}));

vi.mock("@/actions/attachments/get-attachment-url", () => ({
  getAttachmentUrl: vi.fn().mockResolvedValue({ url: "https://example.com/test", name: "test.csv" }),
}));

vi.mock("@/actions/attachments/get-attachment-artifact", () => ({
  getAttachmentArtifact: vi.fn().mockResolvedValue({
    type: "spreadsheet",
    title: "Sheet Preview",
    content: "[]",
    messageId: "step-0",
  }),
}));

vi.mock("@/actions/transform-runs/inngest-actions", () => ({
  approveTransformRunAction: vi.fn(),
  getTransformRunRealtimeToken: vi.fn().mockResolvedValue("token-123"),
  startTransformRunAction: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/components/chat/artifact-panel", () => ({
  ArtifactPanel: () => <div data-testid="artifact-panel">Artifact Panel</div>,
}));

describe("TransformRunDetailPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("calls notFound when run is not found", async () => {
    mockGetTransformRun.mockResolvedValueOnce(null);

    render(<TransformRunDetailPage />);

    await waitFor(() => {
      expect(mockNotFound).toHaveBeenCalled();
    });
  });

  it("renders run header and execution timeline when loaded", async () => {
    const now = new Date();
    mockGetTransformRun.mockResolvedValueOnce({
      id: "run-1",
      agentId: "agent-1",
      userId: "user-1",
      status: "completed",
      currentStepIndex: 1,
      dryRun: false,
      inputAttachmentIds: ["in-1"],
      outputAttachmentIds: ["out-1"],
      errorMessage: null,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    });

    mockGetTransformAgent.mockResolvedValueOnce({
      id: "agent-1",
      userId: "user-1",
      name: "Financial Data Extractor",
      description: "Extracts finance data",
      globalContext: null,
      modelId: null,
      tools: ["spreadsheet", "manage_artifact"],
      knowledgeBaseIds: [],
      requiresFileUpload: true,
      steps: JSON.stringify([
        { id: "s1", name: "Parse Balance Sheet", tool: "spreadsheet", order: 0 },
        { id: "s2", name: "Calculate Ratios", tool: "spreadsheet", order: 1 },
      ]),
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    });

    render(<TransformRunDetailPage />);

    await waitFor(() => {
      expect(screen.getByText("Run: Financial Data Extractor")).toBeDefined();
    });

    expect(screen.getByText("Parse Balance Sheet")).toBeDefined();
    expect(screen.getByText("Calculate Ratios")).toBeDefined();
    expect(screen.getByText("Execution Timeline")).toBeDefined();
    expect(screen.getByText("Files & Workbooks")).toBeDefined();
  });
});

