import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import WorkflowEditorPage from "@/app/(main)/workflows/[id]/page";
import {
  DEFAULT_WORKFLOW_APPROVAL_CONFIG,
  DEFAULT_WORKFLOW_CANVAS_CONFIG,
} from "@/types/workflows/workflow";

vi.mock("next/navigation", () => ({
  useParams: () => ({ id: "wf-1" }),
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock("nuqs", () => ({
  parseAsString: {
    withDefault: () => ({
      withOptions: () => ({}),
    }),
  },
  useQueryState: () => ["canvas", vi.fn()],
}));

vi.mock("@/components/workflows/canvas/workflow-canvas", () => ({
  WorkflowCanvas: () => <div data-testid="mock-workflow-canvas">Canvas</div>,
}));

vi.mock("@/components/shared/markdown-tab-editor", () => ({
  MarkdownTabEditor: () => <div data-testid="mock-markdown-editor" />,
}));

const mockEditorState = {
  isLoading: false,
  hasNoModels: false,
  name: "Daily Ops Workflow",
  setName: vi.fn(),
  description: "",
  setDescription: vi.fn(),
  globalContext: "",
  setGlobalContext: vi.fn(),
  modelId: "gpt-4o",
  setModelId: vi.fn(),
  requiresFileUpload: false,
  setRequiresFileUpload: vi.fn(),
  nodes: [],
  setNodes: vi.fn(),
  edges: [],
  setEdges: vi.fn(),
  mcpServers: [],
  tools: new Set<string>(),
  handleToggleTool: vi.fn(),
  handleBulkSelectTools: vi.fn(),
  knowledgebases: [],
  knowledgeBaseIds: new Set<string>(),
  setKnowledgeBaseIds: vi.fn(),
  skills: [],
  skillMode: "dynamic" as const,
  setSkillMode: vi.fn(),
  skillIds: new Set<string>(),
  setSkillIds: vi.fn(),
  agents: [],
  subagentIds: [],
  handleToggleSubagent: vi.fn(),
  approvalConfig: DEFAULT_WORKFLOW_APPROVAL_CONFIG,
  setApprovalConfig: vi.fn(),
  canvasConfig: DEFAULT_WORKFLOW_CANVAS_CONFIG,
  setCanvasConfig: vi.fn(),
  webhookSecret: "sec-1",
  runs: [],
  isLoadingRuns: false,
  isSaving: false,
  isDeleting: false,
  runDialogOpen: false,
  setRunDialogOpen: vi.fn(),
  runFiles: [],
  setRunFiles: vi.fn(),
  initialInputJson: "",
  setInitialInputJson: vi.fn(),
  dryRun: false,
  setDryRun: vi.fn(),
  isStartingRun: false,
  handleAddNode: vi.fn(),
  handleUpdateNode: vi.fn(),
  handleDeleteNode: vi.fn(),
  handleAutoLayout: vi.fn(),
  handleRegenerateWebhookSecret: vi.fn(),
  handleSave: vi.fn(),
  handleDelete: vi.fn(),
  handleStartRun: vi.fn(),
};

vi.mock("@/components/workflows/editor/use-workflow-editor", () => ({
  useWorkflowEditor: () => mockEditorState,
}));

describe("WorkflowEditorPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders full-viewport workflow editor with header and canvas", () => {
    render(<WorkflowEditorPage />);
    expect(screen.getByText("Daily Ops Workflow")).toBeInTheDocument();
    expect(screen.getByTestId("mock-workflow-canvas")).toBeInTheDocument();
  });
});
