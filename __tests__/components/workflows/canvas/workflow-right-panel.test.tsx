import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { WorkflowRightPanel } from "@/components/workflows/canvas/workflow-right-panel";
import type { Agent } from "@/types/agent/agent";
import type { McpServer } from "@/types/mcp/mcp-server";
import type { WorkflowNode } from "@/types/workflows/workflow";

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
      aria-label="Prompt Template"
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
    />
  ),
}));

vi.mock("@/components/shared/model-selector", () => ({
  ModelSelector: ({
    value,
    onValueChange,
  }: {
    value: string;
    onValueChange: (val: string) => void;
  }) => (
    <input
      aria-label="Model Override"
      value={value}
      onChange={(e) => onValueChange(e.target.value)}
    />
  ),
}));

vi.mock("@/components/chat/input/reasoning-effort-selector", () => ({
  ModelReasoningEffortCard: () => null,
}));

vi.mock("@/components/chat/tool-picker-list", () => ({
  ToolPickerList: () => <div data-testid="tool-picker-list" />,
}));

vi.mock("@/components/chat/knowledgebase-picker", () => ({
  KnowledgebasePicker: () => <div data-testid="kb-picker" />,
}));

vi.mock("@/components/chat/skills-picker", () => ({
  SkillsPicker: () => <div data-testid="skills-picker" />,
}));

vi.mock("@/components/shared/subagent-picker", () => ({
  SubagentPicker: () => <div data-testid="subagent-picker" />,
}));

const mockAgent: Agent = {
  id: "agent-1",
  userId: "user-1",
  name: "Researcher",
  description: "Researches topics",
  systemPrompt: "You are a researcher.",
  isBuiltIn: false,
  tools: [],
  knowledgeBaseIds: [],
  skillMode: "inherit",
  skillIds: [],
  subagentIds: [],
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
} as Agent;

const mockMcpServers: McpServer[] = [];

function makeAiNode(overrides?: Partial<WorkflowNode["data"]>): WorkflowNode {
  return {
    id: "node-1",
    type: "ai_step",
    name: "AI Step 1",
    position: { x: 0, y: 0 },
    data: {
      kind: "ai_step",
      variableName: "ai_step_1",
      prompt: "",
      mcpServerIds: [],
      toolIds: [],
      requiresReview: false,
      ...overrides,
    },
  } as WorkflowNode;
}

describe("WorkflowRightPanel", () => {
  const baseProps = {
    workflowId: "wf-1",
    allNodes: [] as WorkflowNode[],
    edges: [],
    mcpServers: mockMcpServers,
    knowledgebases: [],
    skills: [],
    agents: [mockAgent],
    onAddNode: vi.fn(),
    onAddAgentNode: vi.fn(),
    onDeselectNode: vi.fn(),
    onUpdateNode: vi.fn(),
    onDeleteNode: vi.fn(),
  };

  it("renders palette when selectedNode is null", () => {
    render(<WorkflowRightPanel {...baseProps} selectedNode={null} />);
    expect(screen.getByPlaceholderText(/search/i)).toBeInTheDocument();
    expect(screen.getByText("AI Agent")).toBeInTheDocument();
  });

  it("renders inspector when selectedNode is provided and calls onDeselectNode on back", () => {
    const onDeselectNode = vi.fn();
    const node = makeAiNode({ prompt: "Summarize" });
    render(
      <WorkflowRightPanel
        {...baseProps}
        allNodes={[node]}
        selectedNode={node}
        onDeselectNode={onDeselectNode}
      />,
    );

    const backBtn = screen.getByRole("button", { name: /back to palette/i });
    fireEvent.click(backBtn);
    expect(onDeselectNode).toHaveBeenCalledTimes(1);
  });

  it("shows Needs info badge on Instructions when unlinked prompt is empty", () => {
    const node = makeAiNode({ prompt: "" });
    render(
      <WorkflowRightPanel {...baseProps} allNodes={[node]} selectedNode={node} />,
    );

    expect(screen.getByText("Needs info")).toBeInTheDocument();
    expect(screen.getByLabelText("Prompt Template")).toBeInTheDocument();
  });

  it("shows Linked Agent card with edit link and detach button", () => {
    const onUpdateNode = vi.fn();
    const node = makeAiNode({ agentId: "agent-1", prompt: "" });
    render(
      <WorkflowRightPanel
        {...baseProps}
        allNodes={[node]}
        selectedNode={node}
        onUpdateNode={onUpdateNode}
      />,
    );

    expect(screen.queryByText("Needs info")).not.toBeInTheDocument();
    expect(screen.getByText("Researcher")).toBeInTheDocument();
    const editLink = screen.getByRole("link", { name: /edit agent/i });
    expect(editLink).toHaveAttribute("href", expect.stringContaining("/agents"));

    const detachBtn = screen.getByRole("button", { name: /detach/i });
    fireEvent.click(detachBtn);
    expect(onUpdateNode).toHaveBeenCalledWith("node-1", {
      data: expect.objectContaining({ agentId: undefined }),
    });
  });

  it("shows missing-agent alert when agentId is not found in agents", () => {
    const node = makeAiNode({ agentId: "missing-agent-id" });
    render(
      <WorkflowRightPanel {...baseProps} allNodes={[node]} selectedNode={node} />,
    );

    expect(screen.getByText(/agent not found/i)).toBeInTheDocument();
  });

  it("expands Connected apps, Knowledgebase, Skills, and More accordions and emits updates", () => {
    const onUpdateNode = vi.fn();
    const node = makeAiNode({ prompt: "Hello" });
    render(
      <WorkflowRightPanel
        {...baseProps}
        allNodes={[node]}
        selectedNode={node}
        onUpdateNode={onUpdateNode}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /connected apps/i }));
    expect(screen.getByTestId("tool-picker-list")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /^knowledgebase/i }));
    expect(screen.getByTestId("kb-picker")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /^skills/i }));
    expect(screen.getByText("Skill Loading Mode")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /^more/i }));
    expect(screen.getByLabelText("Model Override")).toBeInTheDocument();
    expect(screen.getByText(/\{\{ai_step_1\}\}/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("switch", { name: /human review gate/i }));
    expect(onUpdateNode).toHaveBeenCalledWith("node-1", {
      data: expect.objectContaining({ requiresReview: true }),
    });
  });

  it("calls onDeleteNode when delete button is clicked", () => {
    const onDeleteNode = vi.fn();
    const node = makeAiNode({ prompt: "Hello" });
    render(
      <WorkflowRightPanel
        {...baseProps}
        allNodes={[node]}
        selectedNode={node}
        onDeleteNode={onDeleteNode}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /delete node/i }));
    expect(onDeleteNode).toHaveBeenCalledWith("node-1");
  });

  it("shows structured output field chips for upstream ai_step and renders schema editor when outputMode is structured", () => {
    const upstreamNode = makeAiNode({
      variableName: "step1",
      outputMode: "structured",
      structuredOutputSchema: {
        fields: [
          {
            id: "f1",
            name: "invoices",
            type: "object_array",
            required: true,
            itemFields: [],
          },
        ],
      },
    });
    const downstreamNode: WorkflowNode = {
      ...makeAiNode({
        variableName: "step2",
        outputMode: "structured",
        structuredOutputSchema: { fields: [] },
      }),
      id: "node-2",
    };

    render(
      <WorkflowRightPanel
        {...baseProps}
        allNodes={[upstreamNode, downstreamNode]}
        edges={[
          {
            id: "e1",
            sourceNodeId: "node-1",
            targetNodeId: "node-2",
            sourceHandle: "main",
          },
        ]}
        selectedNode={downstreamNode}
      />,
    );

    expect(screen.getByText("{{step1}}")).toBeInTheDocument();
    expect(screen.getByText("{{step1.invoices}}")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /^more$/i }));
    expect(screen.getByText("Output Schema")).toBeInTheDocument();
  });
});
