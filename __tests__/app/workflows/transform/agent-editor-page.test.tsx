import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

// jsdom doesn't implement ResizeObserver
beforeAll(() => {
  global.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
});

// Mock CSS imports for jsdom
vi.mock("katex/dist/katex.min.css", () => ({}));
vi.mock("@blocknote/mantine/style.css", () => ({}));
vi.mock("@blocknote/core/fonts/inter.css", () => ({}));

// Mock navigation
const mockPush = vi.hoisted(() => vi.fn());
const mockRefresh = vi.hoisted(() => vi.fn());
const mockRouter = vi.hoisted(() => ({ push: mockPush, refresh: mockRefresh }));
let currentParamId = "agent-1";
vi.mock("next/navigation", () => ({
  useParams: () => ({ id: currentParamId }),
  useRouter: () => mockRouter,
  notFound: vi.fn(),
}));

// Mock nuqs
vi.mock("nuqs", () => ({
  parseAsString: {
    withDefault: vi.fn().mockReturnValue({
      withOptions: vi.fn().mockReturnValue({}),
    }),
  },
  useQueryState: vi.fn((_key, _options) => ["steps", vi.fn()]),
}));

// Mock actions
const mockGetTransformAgent = vi.hoisted(() => vi.fn());
const mockListTransformRuns = vi.hoisted(() => vi.fn());
vi.mock("@/actions/transform-agents/get-transform-agent", () => ({
  getTransformAgent: mockGetTransformAgent,
}));
vi.mock("@/actions/transform-agents/update-transform-agent", () => ({
  updateTransformAgent: vi.fn(),
}));
vi.mock("@/actions/transform-agents/create-transform-agent", () => ({
  createTransformAgent: vi.fn(),
}));
vi.mock("@/actions/transform-agents/delete-transform-agent", () => ({
  deleteTransformAgent: vi.fn(),
}));
vi.mock("@/actions/transform-runs/list-transform-runs", () => ({
  listTransformRuns: mockListTransformRuns,
}));
vi.mock("@/actions/transform-runs/create-transform-run", () => ({
  createTransformRun: vi.fn(),
}));
vi.mock("@/actions/transform-runs/upload-run-input", () => ({
  uploadRunInput: vi.fn(),
}));

// Mock hooks & store
vi.mock("@/hooks/use-knowledgebases", () => ({
  useKnowledgebases: () => ({ normalizedKnowledgebases: [] }),
}));
vi.mock("@/hooks/use-user-models", () => ({
  useUserModels: () => ({
    models: [{ id: "model-1", name: "Model 1", provider: "openai" }],
  }),
}));

vi.mock("@/components/shared/markdown-tab-editor", () => ({
  MarkdownTabEditor: ({
    value,
    onChange,
    placeholder,
  }: {
    value: string;
    onChange: (val: string) => void;
    placeholder?: string;
  }) => (
    <textarea
      aria-label="step-prompt-editor"
      placeholder={placeholder}
      value={value}
      onChange={(e) => onChange(e.target.value)}
    />
  ),
}));

import AgentEditorPage from "@/app/workflows/transform/[id]/page";

describe("AgentEditorPage - Step-by-Step Automation Regression Tests", () => {
  beforeEach(() => {
    currentParamId = "agent-1";
    vi.clearAllMocks();
    mockListTransformRuns.mockResolvedValue([]);
  });

  it("adds a new step ('Step 2') when clicking 'Add Step' without re-fetching or discarding steps", async () => {
    const initialAgent = {
      id: "agent-1",
      name: "Test Agent",
      description: "A test agent",
      globalContext: "",
      modelId: "model-1",
      tools: [],
      knowledgeBaseIds: [],
      requiresFileUpload: true,
      steps: JSON.stringify([
        {
          id: "step-1",
          name: "Step 1",
          prompt: "Initial prompt",
          mcpServerIds: [],
          toolIds: [],
          order: 0,
          requiresReview: false,
        },
      ]),
    };

    mockGetTransformAgent.mockResolvedValue(initialAgent);

    render(<AgentEditorPage />);

    // Wait for initial load to finish
    await waitFor(() => {
      expect(screen.getByText("Step 1")).toBeInTheDocument();
    });

    expect(mockGetTransformAgent).toHaveBeenCalledTimes(1);

    // User clicks "Add Step" button
    const addStepBtn = screen.getByRole("button", { name: /Add Step/i });
    fireEvent.click(addStepBtn);

    // Verify Step 2 is rendered and Step 1 remains
    expect(screen.getByText("Step 1")).toBeInTheDocument();
    expect(screen.getByText("Step 2")).toBeInTheDocument();

    // Verify mockGetTransformAgent is NOT called again
    expect(mockGetTransformAgent).toHaveBeenCalledTimes(1);

    // Ensure Step 2 remains in document over time
    await waitFor(() => {
      expect(screen.getByText("Step 2")).toBeInTheDocument();
      expect(mockGetTransformAgent).toHaveBeenCalledTimes(1);
    });
  });

  it("does not re-fetch agent when editing inputs or adding multiple steps", async () => {
    const initialAgent = {
      id: "agent-1",
      name: "Test Agent",
      description: "A test agent",
      globalContext: "",
      modelId: "model-1",
      tools: [],
      knowledgeBaseIds: [],
      requiresFileUpload: true,
      steps: JSON.stringify([
        {
          id: "step-1",
          name: "Step 1",
          prompt: "Initial prompt",
          mcpServerIds: [],
          toolIds: [],
          order: 0,
          requiresReview: false,
        },
      ]),
    };

    mockGetTransformAgent.mockResolvedValue(initialAgent);

    render(<AgentEditorPage />);

    // Wait for initial load to finish
    await waitFor(() => {
      expect(screen.getByText("Step 1")).toBeInTheDocument();
    });

    expect(mockGetTransformAgent).toHaveBeenCalledTimes(1);

    // Add Step 2
    const addStepBtn = screen.getByRole("button", { name: /Add Step/i });
    fireEvent.click(addStepBtn);
    expect(screen.getByText("Step 2")).toBeInTheDocument();

    // Add Step 3
    fireEvent.click(addStepBtn);
    expect(screen.getByText("Step 3")).toBeInTheDocument();

    // Edit prompt input of the step
    const promptEditors = screen.getAllByLabelText("step-prompt-editor");
    expect(promptEditors.length).toBeGreaterThanOrEqual(1);
    fireEvent.change(promptEditors[0], {
      target: { value: "Updated prompt instructions" },
    });

    // Verify getTransformAgent was NOT called again and all steps remain
    expect(mockGetTransformAgent).toHaveBeenCalledTimes(1);
    expect(screen.getByText("Step 1")).toBeInTheDocument();
    expect(screen.getByText("Step 2")).toBeInTheDocument();
    expect(screen.getByText("Step 3")).toBeInTheDocument();
    expect(promptEditors[0]).toHaveValue("Updated prompt instructions");
  });
});
