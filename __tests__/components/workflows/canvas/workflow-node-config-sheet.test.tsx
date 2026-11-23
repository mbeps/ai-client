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
        edges={edges}
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
        edges={edges}
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
        edges={edges}
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
        edges={edges}
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
        edges={edges}
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
});
