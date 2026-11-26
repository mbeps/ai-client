import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { WorkflowNodeConfigSheet } from "@/components/workflows/canvas/workflow-node-config-sheet";
import type { WorkflowEdge, WorkflowNode } from "@/types/workflows/workflow";

vi.mock("@/components/shared/markdown-tab-editor", () => ({
  MarkdownTabEditor: ({
    value,
    onChange,
    placeholder,
  }: {
    value: string;
    onChange: (v: string) => void;
    placeholder?: string;
  }) => (
    <textarea
      aria-label="Prompt Editor"
      placeholder={placeholder}
      value={value}
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
    onValueChange: (v: string) => void;
  }) => (
    <select
      aria-label="Node Model"
      value={value}
      onChange={(e) => onValueChange(e.target.value)}
    >
      <option value="">Default</option>
      <option value="gpt-4o">GPT-4o</option>
    </select>
  ),
}));

const nodes: WorkflowNode[] = [
  {
    id: "n1",
    type: "manual_trigger",
    name: "Start",
    position: { x: 0, y: 0 },
    data: { kind: "manual_trigger", variableName: "trigger" },
  },
  {
    id: "n2",
    type: "ai_step",
    name: "Analyze",
    position: { x: 200, y: 0 },
    data: {
      kind: "ai_step",
      variableName: "step1",
      prompt: "Analyze input",
      mcpServerIds: [],
      toolIds: [],
      requiresReview: false,
    },
  },
  {
    id: "n3",
    type: "if_condition",
    name: "Branch",
    position: { x: 400, y: 0 },
    data: {
      kind: "if_condition",
      variableName: "branch1",
      evaluationMode: "deterministic",
      logic: "and",
      rules: [],
    },
  },
  {
    id: "n4",
    type: "http_request",
    name: "Webhook Out",
    position: { x: 600, y: 0 },
    data: {
      kind: "http_request",
      variableName: "http1",
      method: "POST",
      url: "https://api.example.com",
      headers: [],
    },
  },
  {
    id: "n5",
    type: "webhook_trigger",
    name: "Inbound Hook",
    position: { x: 0, y: 200 },
    data: {
      kind: "webhook_trigger",
      variableName: "webhook",
      secretHeaderName: "x-webhook-secret",
    },
  },
];

const edges: WorkflowEdge[] = [
  {
    id: "e1",
    sourceNodeId: "n1",
    targetNodeId: "n2",
    sourceHandle: "main",
    targetHandle: "main",
  },
];

describe("WorkflowNodeConfigSheet", () => {
  it("renders upstream variable chips and inserts {{variableName}} into AI step prompt", () => {
    const onUpdateNode = vi.fn();
    render(
      <WorkflowNodeConfigSheet
        open={true}
        onOpenChange={vi.fn()}
        node={nodes[1]}
        allNodes={nodes}
        edges={[
          ...edges,
          { id: "e2", sourceNodeId: "n2", targetNodeId: "n3", sourceHandle: "main", targetHandle: "main" },
        ]}
        workflowId="wf-1"
        webhookSecret="sec-abc"
        mcpServers={[]}
        onUpdateNode={onUpdateNode}
        onDeleteNode={vi.fn()}
      />,
    );

    const chip = screen.getByRole("button", { name: "{{trigger}}" });
    expect(chip).toBeInTheDocument();
    fireEvent.click(chip);

    expect(onUpdateNode).toHaveBeenCalledWith(
      "n2",
      expect.objectContaining({
        data: expect.objectContaining({
          prompt: expect.stringContaining("{{trigger}}"),
        }),
      }),
    );
  });

  it("renders IfCondition rules builder and allows adding deterministic rule", () => {
    const onUpdateNode = vi.fn();
    render(
      <WorkflowNodeConfigSheet
        open={true}
        onOpenChange={vi.fn()}
        node={nodes[2]}
        allNodes={nodes}
        edges={[
          ...edges,
          { id: "e2", sourceNodeId: "n2", targetNodeId: "n3", sourceHandle: "main", targetHandle: "main" },
        ]}
        workflowId="wf-1"
        webhookSecret="sec-abc"
        mcpServers={[]}
        onUpdateNode={onUpdateNode}
        onDeleteNode={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /Add Rule/i }));
    expect(onUpdateNode).toHaveBeenCalledWith(
      "n3",
      expect.objectContaining({
        data: expect.objectContaining({
          rules: expect.arrayContaining([
            expect.objectContaining({ operator: "equals" }),
          ]),
        }),
      }),
    );
  });

  it("renders HttpRequest and WebhookTrigger inspectors with secret copy/regenerate", () => {
    const onUpdateNode = vi.fn();
    const onRegenerateSecret = vi.fn();

    const { rerender } = render(
      <WorkflowNodeConfigSheet
        open={true}
        onOpenChange={vi.fn()}
        node={nodes[3]}
        allNodes={nodes}
        edges={[
          ...edges,
          { id: "e2", sourceNodeId: "n2", targetNodeId: "n3", sourceHandle: "main", targetHandle: "main" },
        ]}
        workflowId="wf-1"
        webhookSecret="sec-abc"
        mcpServers={[]}
        onUpdateNode={onUpdateNode}
        onDeleteNode={vi.fn()}
      />,
    );
    expect(screen.getByLabelText("Request URL")).toHaveValue(
      "https://api.example.com",
    );

    rerender(
      <WorkflowNodeConfigSheet
        open={true}
        onOpenChange={vi.fn()}
        node={nodes[4]}
        allNodes={nodes}
        edges={[
          ...edges,
          { id: "e2", sourceNodeId: "n2", targetNodeId: "n3", sourceHandle: "main", targetHandle: "main" },
        ]}
        workflowId="wf-1"
        webhookSecret="sec-abc"
        mcpServers={[]}
        onUpdateNode={onUpdateNode}
        onDeleteNode={vi.fn()}
        onRegenerateWebhookSecret={onRegenerateSecret}
      />,
    );
    expect(screen.getByText(/\/api\/webhooks\/workflows\/wf-1/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Regenerate Secret/i }));
    expect(onRegenerateSecret).toHaveBeenCalledTimes(1);
  });

  it("renders Add Node and Cancel buttons when configuring a new pending node", () => {
    const onConfirmAdd = vi.fn();
    const onOpenChange = vi.fn();

    render(
      <WorkflowNodeConfigSheet
        open={true}
        onOpenChange={onOpenChange}
        node={nodes[0]}
        allNodes={nodes}
        edges={[
          ...edges,
          { id: "e2", sourceNodeId: "n2", targetNodeId: "n3", sourceHandle: "main", targetHandle: "main" },
        ]}
        workflowId="wf-1"
        mcpServers={[]}
        onUpdateNode={vi.fn()}
        onDeleteNode={vi.fn()}
        isNew={true}
        onConfirmAdd={onConfirmAdd}
      />,
    );

    expect(
      screen.queryByRole("button", { name: /Delete Node/i }),
    ).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Add Node/i }));
    expect(onConfirmAdd).toHaveBeenCalledTimes(1);
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("navigates AI step sections and updates tools, knowledgebases, skills, and subagents", () => {
    const onUpdateNode = vi.fn();
    render(
      <WorkflowNodeConfigSheet
        open={true}
        onOpenChange={vi.fn()}
        node={{
          ...nodes[1],
          data: {
            kind: "ai_step",
            variableName: "step1",
            prompt: "Analyze input",
            mcpServerIds: [],
            toolIds: ["internal:tool:manage_artifact"],
            knowledgeBaseIds: ["kb-1"],
            skillMode: "specific",
            skillIds: ["sk-1"],
            subagentIds: ["builtin:researcher"],
            requiresReview: false,
          },
        }}
        allNodes={nodes}
        edges={[
          ...edges,
          { id: "e2", sourceNodeId: "n2", targetNodeId: "n3", sourceHandle: "main", targetHandle: "main" },
        ]}
        workflowId="wf-1"
        mcpServers={[]}
        knowledgebases={[
          {
            id: "kb-1",
            name: "Product Docs",
            description: "Docs",
            indexStatus: "ready",
          } as any,
          {
            id: "kb-2",
            name: "Sales KB",
            description: "Sales",
            indexStatus: "ready",
          } as any,
        ]}
        skills={[
          {
            id: "sk-1",
            name: "sql-helper",
            displayName: "SQL Helper",
            description: "Helps write SQL",
            enabled: true,
          } as any,
        ]}
        agents={[
          {
            id: "builtin:researcher",
            name: "Researcher",
            description: "Researches topics",
            isBuiltIn: true,
            isOrchestrator: false,
            subagentIds: [],
          } as any,
        ]}
        onUpdateNode={onUpdateNode}
        onDeleteNode={vi.fn()}
      />,
    );

    // Switch to Tools & MCP
    fireEvent.click(screen.getByRole("button", { name: /Tools & MCP/i }));
    expect(screen.getByText("Tools & MCP Capabilities")).toBeInTheDocument();

    // Switch to Knowledge and toggle kb-2
    fireEvent.click(screen.getByRole("button", { name: /Knowledge/i }));
    expect(screen.getByText("Knowledge Bases")).toBeInTheDocument();
    fireEvent.click(screen.getByText("Sales KB"));
    expect(onUpdateNode).toHaveBeenCalledWith(
      "n2",
      expect.objectContaining({
        data: expect.objectContaining({
          knowledgeBaseIds: ["kb-1", "kb-2"],
        }),
      }),
    );

    // Switch to Skills and toggle sk-1
    fireEvent.click(screen.getByRole("button", { name: /Skills/i }));
    expect(screen.getByText("Agent Skills")).toBeInTheDocument();
    fireEvent.click(screen.getByText("SQL Helper"));
    expect(onUpdateNode).toHaveBeenCalledWith(
      "n2",
      expect.objectContaining({
        data: expect.objectContaining({
          skillIds: [],
        }),
      }),
    );

    // Switch to Subagents and toggle Researcher
    fireEvent.click(screen.getByRole("button", { name: /Subagents/i }));
    expect(screen.getByText("Subagent Delegation")).toBeInTheDocument();
    fireEvent.click(screen.getByText("Researcher"));
    expect(onUpdateNode).toHaveBeenCalledWith(
      "n2",
      expect.objectContaining({
        data: expect.objectContaining({
          subagentIds: [],
        }),
      }),
    );
  });

  it("shows HTTP request body for DELETE with unquoted {{json ...}} placeholder and batches Select All in AI tools", () => {
    const onUpdateNode = vi.fn();
    const { rerender } = render(
      <WorkflowNodeConfigSheet
        open={true}
        onOpenChange={vi.fn()}
        node={{
          ...nodes[3],
          data: {
            kind: "http_request",
            variableName: "http1",
            method: "DELETE",
            url: "https://api.example.com/item",
            headers: [],
          },
        }}
        allNodes={nodes}
        edges={[
          ...edges,
          { id: "e2", sourceNodeId: "n2", targetNodeId: "n3", sourceHandle: "main", targetHandle: "main" },
        ]}
        workflowId="wf-1"
        mcpServers={[]}
        onUpdateNode={onUpdateNode}
        onDeleteNode={vi.fn()}
      />,
    );

    const bodyInput = screen.getByLabelText("JSON / Request Body");
    expect(bodyInput).toBeInTheDocument();
    expect(bodyInput).toHaveAttribute(
      "placeholder",
      '{"summary": {{json step1.summary}}}',
    );

    rerender(
      <WorkflowNodeConfigSheet
        open={true}
        onOpenChange={vi.fn()}
        node={{
          ...nodes[1],
          data: {
            kind: "ai_step",
            variableName: "step1",
            prompt: "Run",
            mcpServerIds: ["srv-1"],
            toolIds: [],
            requiresReview: false,
          },
        }}
        allNodes={nodes}
        edges={[
          ...edges,
          { id: "e2", sourceNodeId: "n2", targetNodeId: "n3", sourceHandle: "main", targetHandle: "main" },
        ]}
        workflowId="wf-1"
        mcpServers={[]}
        onUpdateNode={onUpdateNode}
        onDeleteNode={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /Tools & MCP/i }));
    fireEvent.click(screen.getByText("Select All"));
    expect(onUpdateNode).toHaveBeenCalledTimes(1);
    expect(onUpdateNode).toHaveBeenCalledWith(
      "n2",
      expect.objectContaining({
        data: expect.objectContaining({
          toolIds: [
            "internal:tool:manage_artifact",
            "internal:tool:manage_memory",
            "internal:tool:interactive_ui",
          ],
        }),
      }),
    );
  });

  it("handles node name/variable edits, upstream variable insertion for if_condition and http_request, skill badge, and footer buttons", () => {
    const onUpdateNode = vi.fn();
    const onDeleteNode = vi.fn();
    const onOpenChange = vi.fn();

    const { rerender } = render(
      <WorkflowNodeConfigSheet
        open={true}
        onOpenChange={onOpenChange}
        node={{
          ...nodes[1],
          data: {
            kind: "ai_step",
            variableName: "step1",
            prompt: "",
            mcpServerIds: [],
            toolIds: [],
            requiresReview: false,
            skillMode: "specific",
            skillIds: ["sk-1", "sk-2"],
          },
        }}
        allNodes={nodes}
        edges={[
          ...edges,
          { id: "e2", sourceNodeId: "n2", targetNodeId: "n3", sourceHandle: "main", targetHandle: "main" },
        ]}
        workflowId="wf-1"
        mcpServers={[]}
        onUpdateNode={onUpdateNode}
        onDeleteNode={onDeleteNode}
      />,
    );

    fireEvent.change(screen.getByLabelText("Node Name"), {
      target: { value: "Renamed Node" },
    });
    expect(onUpdateNode).toHaveBeenCalledWith("n2", { name: "Renamed Node" });

    fireEvent.change(screen.getByLabelText("Variable Name"), {
      target: { value: "renamedVar" },
    });
    expect(onUpdateNode).toHaveBeenCalledWith(
      "n2",
      expect.objectContaining({
        data: expect.objectContaining({ variableName: "renamedVar" }),
      }),
    );

    // Delete Node button in non-new mode
    fireEvent.click(screen.getByRole("button", { name: /Delete Node/i }));
    expect(onDeleteNode).toHaveBeenCalledWith("n2");
    expect(onOpenChange).toHaveBeenCalledWith(false);

    // isNew={true} Cancel button
    rerender(
      <WorkflowNodeConfigSheet
        open={true}
        isNew={true}
        onOpenChange={onOpenChange}
        node={nodes[2]}
        allNodes={nodes}
        edges={[
          ...edges,
          { id: "e2", sourceNodeId: "n2", targetNodeId: "n3", sourceHandle: "main", targetHandle: "main" },
        ]}
        workflowId="wf-1"
        mcpServers={[]}
        onUpdateNode={onUpdateNode}
        onDeleteNode={onDeleteNode}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /Cancel/i }));
    expect(onOpenChange).toHaveBeenCalledWith(false);

    // if_condition in llm mode: insertVariable
    rerender(
      <WorkflowNodeConfigSheet
        open={true}
        onOpenChange={onOpenChange}
        node={{
          ...nodes[2],
          data: {
            kind: "if_condition",
            variableName: "branch1",
            evaluationMode: "llm",
            logic: "and",
            rules: [],
            llmConditionPrompt: "Check",
          },
        }}
        allNodes={nodes}
        edges={[
          ...edges,
          { id: "e2", sourceNodeId: "n2", targetNodeId: "n3", sourceHandle: "main", targetHandle: "main" },
        ]}
        workflowId="wf-1"
        mcpServers={[]}
        onUpdateNode={onUpdateNode}
        onDeleteNode={onDeleteNode}
      />,
    );
    const chip3 = screen.getAllByText(/^\{\{.*\}\}$/)[0];
    fireEvent.click(chip3);
    expect(onUpdateNode).toHaveBeenCalledWith(
      "n3",
      expect.objectContaining({
        data: expect.objectContaining({
          llmConditionPrompt: expect.stringContaining("Check {{"),
        }),
      }),
    );

    // http_request: insertVariable
    rerender(
      <WorkflowNodeConfigSheet
        open={true}
        onOpenChange={onOpenChange}
        node={{
          ...nodes[3],
          data: {
            kind: "http_request",
            variableName: "http1",
            method: "POST",
            url: "https://api.example.com",
            headers: [],
            body: "",
          },
        }}
        allNodes={nodes}
        edges={[
          ...edges,
          { id: "e2", sourceNodeId: "n2", targetNodeId: "n3", sourceHandle: "main", targetHandle: "main" },
          { id: "e3", sourceNodeId: "n3", targetNodeId: "n4", sourceHandle: "true", targetHandle: "main" },
        ]}
        workflowId="wf-1"
        mcpServers={[]}
        onUpdateNode={onUpdateNode}
        onDeleteNode={onDeleteNode}
      />,
    );
    const chip4 = screen.getAllByText(/^\{\{.*\}\}$/)[0];
    fireEvent.click(chip4);
    expect(onUpdateNode).toHaveBeenCalledWith(
      "n4",
      expect.objectContaining({
        data: expect.objectContaining({
          body: expect.stringContaining("{{"),
        }),
      }),
    );
  });

  it("covers insertVariable edge cases and skillMode badge variants", () => {
    const onUpdateNode = vi.fn();
    const emptyVarNodes = [
      {
        ...nodes[0],
        data: { kind: "manual_trigger" as const, variableName: "" },
      },
      ...nodes.slice(1),
    ];

    const { rerender } = render(
      <WorkflowNodeConfigSheet
        open={true}
        onOpenChange={vi.fn()}
        node={{
          ...nodes[1],
          data: {
            kind: "ai_step",
            variableName: "step1",
            prompt: "",
            mcpServerIds: [],
            toolIds: [],
            skillMode: "all",
            requiresReview: false,
          },
        }}
        allNodes={emptyVarNodes}
        edges={[
          ...edges,
          { id: "e2", sourceNodeId: "n2", targetNodeId: "n3", sourceHandle: "main", targetHandle: "main" },
        ]}
        workflowId="wf-1"
        mcpServers={[]}
        onUpdateNode={onUpdateNode}
        onDeleteNode={vi.fn()}
      />,
    );
    expect(screen.getByText("all")).toBeInTheDocument();

    // ai_step with empty prompt
    rerender(
      <WorkflowNodeConfigSheet
        open={true}
        onOpenChange={vi.fn()}
        node={{
          ...nodes[1],
          data: {
            kind: "ai_step",
            variableName: "step1",
            prompt: "",
            mcpServerIds: [],
            toolIds: [],
            skillMode: "specific",
            requiresReview: false,
          },
        }}
        allNodes={nodes}
        edges={[
          ...edges,
          { id: "e2", sourceNodeId: "n2", targetNodeId: "n3", sourceHandle: "main", targetHandle: "main" },
        ]}
        workflowId="wf-1"
        mcpServers={[]}
        onUpdateNode={onUpdateNode}
        onDeleteNode={vi.fn()}
      />,
    );
    fireEvent.click(screen.getAllByText(/^\{\{.*\}\}$/)[0]);
    expect(onUpdateNode).toHaveBeenCalledWith(
      "n2",
      expect.objectContaining({
        data: expect.objectContaining({ prompt: "{{trigger}}" }),
      }),
    );

    // if_condition llm with undefined llmConditionPrompt
    rerender(
      <WorkflowNodeConfigSheet
        open={true}
        onOpenChange={vi.fn()}
        node={{
          ...nodes[2],
          data: {
            kind: "if_condition",
            variableName: "branch1",
            evaluationMode: "llm",
            logic: "and",
            rules: [],
          },
        }}
        allNodes={nodes}
        edges={[
          ...edges,
          { id: "e2", sourceNodeId: "n2", targetNodeId: "n3", sourceHandle: "main", targetHandle: "main" },
        ]}
        workflowId="wf-1"
        mcpServers={[]}
        onUpdateNode={onUpdateNode}
        onDeleteNode={vi.fn()}
      />,
    );
    fireEvent.click(screen.getAllByText(/^\{\{.*\}\}$/)[0]);
    expect(onUpdateNode).toHaveBeenCalledWith(
      "n3",
      expect.objectContaining({
        data: expect.objectContaining({ llmConditionPrompt: "{{step1}}" }),
      }),
    );

    // http_request with undefined body
    rerender(
      <WorkflowNodeConfigSheet
        open={true}
        onOpenChange={vi.fn()}
        node={{
          ...nodes[3],
          data: {
            kind: "http_request",
            variableName: "http1",
            method: "POST",
            url: "https://api.example.com",
            headers: [],
          },
        }}
        allNodes={nodes}
        edges={[
          ...edges,
          { id: "e2", sourceNodeId: "n2", targetNodeId: "n3", sourceHandle: "main", targetHandle: "main" },
          { id: "e3", sourceNodeId: "n3", targetNodeId: "n4", sourceHandle: "true", targetHandle: "main" },
        ]}
        workflowId="wf-1"
        mcpServers={[]}
        onUpdateNode={onUpdateNode}
        onDeleteNode={vi.fn()}
      />,
    );
    fireEvent.click(screen.getAllByText(/^\{\{.*\}\}$/)[0]);
    expect(onUpdateNode).toHaveBeenCalledWith(
      "n4",
      expect.objectContaining({
        data: expect.objectContaining({ body: "{{branch1}}" }),
      }),
    );
  });
});
