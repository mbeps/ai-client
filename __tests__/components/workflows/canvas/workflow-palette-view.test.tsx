import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { WorkflowPaletteView } from "@/components/workflows/canvas/workflow-palette-view";
import { ROUTES } from "@/config/routes";
import type { Agent } from "@/types/agent/agent";

vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    ...props
  }: {
    href: string;
    children: React.ReactNode;
    [key: string]: unknown;
  }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

function makeAgent(overrides: Partial<Agent> = {}): Agent {
  return {
    id: "agent-1",
    userId: "user-1",
    name: "Researcher",
    description: "Researches topics thoroughly",
    prompt: "Research prompt",
    subagentPrompt: "",
    modelId: null,
    knowledgebaseIds: [],
    tools: [],
    skillMode: "dynamic",
    skillIds: [],
    promptMode: "all",
    promptIds: [],
    subagentIds: [],
    guardrails: {},
    avatar: null,
    isBuiltIn: false,
    createdAt: new Date("2026-01-01T00:00:00Z"),
    updatedAt: new Date("2026-01-01T00:00:00Z"),
    ...overrides,
  };
}

describe("WorkflowPaletteView", () => {
  it("renders AI Agent card, Flow control, Triggers & Actions, and Existing agents with View all link", () => {
    const agents = [
      makeAgent({ id: "builtin-1", name: "Built-in Analyst", isBuiltIn: true }),
      makeAgent({ id: "custom-1", name: "Custom Writer", isBuiltIn: false }),
    ];

    render(
      <WorkflowPaletteView
        agents={agents}
        onAddNode={vi.fn()}
        onAddAgentNode={vi.fn()}
      />,
    );

    expect(screen.getByText("AI Agent")).toBeInTheDocument();
    expect(screen.getByText("Flow control")).toBeInTheDocument();
    expect(screen.getByText("Condition")).toBeInTheDocument();
    expect(screen.getByText("Triggers & Actions")).toBeInTheDocument();
    expect(screen.getByText("Manual Trigger")).toBeInTheDocument();
    expect(screen.getByText("Webhook Trigger")).toBeInTheDocument();
    expect(screen.getByText("HTTP Request")).toBeInTheDocument();
    expect(screen.getByText("Existing agents")).toBeInTheDocument();
    expect(screen.getByText("Built-in Analyst")).toBeInTheDocument();
    expect(screen.getByText("Built-in")).toBeInTheDocument();
    expect(screen.getByText("Custom Writer")).toBeInTheDocument();

    const viewAllLink = screen.getByRole("link", { name: /View all agents/i });
    expect(viewAllLink).toHaveAttribute("href", ROUTES.AGENTS.path);
    // Ensure View all link is NOT nested inside a button (AccordionTrigger)
    expect(viewAllLink.closest("button")).toBeNull();
  });

  it("calls onAddNode when clicking AI Agent or standard node items", () => {
    const onAddNode = vi.fn();
    render(
      <WorkflowPaletteView
        agents={[]}
        onAddNode={onAddNode}
        onAddAgentNode={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /AI Agent/i }));
    expect(onAddNode).toHaveBeenCalledWith("ai_step");

    fireEvent.click(screen.getByRole("button", { name: /Condition/i }));
    expect(onAddNode).toHaveBeenCalledWith("if_condition");

    fireEvent.click(screen.getByRole("button", { name: /HTTP Request/i }));
    expect(onAddNode).toHaveBeenCalledWith("http_request");
  });

  it("calls onAddAgentNode when clicking an existing agent", () => {
    const agent = makeAgent({ id: "custom-1", name: "Custom Writer" });
    const onAddAgentNode = vi.fn();

    render(
      <WorkflowPaletteView
        agents={[agent]}
        onAddNode={vi.fn()}
        onAddAgentNode={onAddAgentNode}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /Custom Writer/i }));
    expect(onAddAgentNode).toHaveBeenCalledWith(agent);
  });

  it("filters across all groups and auto-expands collapsed groups with matches", () => {
    const agents = [
      makeAgent({
        id: "agent-sql",
        name: "SQL Analyst",
        description: "Queries databases",
      }),
    ];

    render(
      <WorkflowPaletteView
        agents={agents}
        onAddNode={vi.fn()}
        onAddAgentNode={vi.fn()}
      />,
    );

    // Collapse Existing agents manually
    fireEvent.click(screen.getByRole("button", { name: /Existing agents/i }));
    expect(screen.queryByText("SQL Analyst")).not.toBeInTheDocument();

    // Search for SQL Analyst -> should auto-expand Existing agents and hide non-matching items
    const searchInput = screen.getByPlaceholderText(/Search nodes & agents/i);
    fireEvent.change(searchInput, { target: { value: "SQL" } });

    expect(screen.getByText("SQL Analyst")).toBeVisible();
    expect(screen.queryByText("Manual Trigger")).not.toBeInTheDocument();
    expect(screen.queryByText("Condition")).not.toBeInTheDocument();

    // Search for Condition -> auto-expands Flow control
    fireEvent.change(searchInput, { target: { value: "Condition" } });
    expect(screen.getByText("Condition")).toBeVisible();

    // Search for Webhook -> auto-expands Triggers & Actions
    fireEvent.change(searchInput, { target: { value: "Webhook" } });
    expect(screen.getByText("Webhook Trigger")).toBeVisible();

    // Search with no matches -> shows empty search state
    fireEvent.change(searchInput, { target: { value: "nonexistent-xyz" } });
    expect(screen.getByText(/No matching nodes or agents/i)).toBeInTheDocument();
  });

  it("omits description when agent description is empty", () => {
    const agent = makeAgent({ id: "no-desc", name: "Minimal Agent", description: "" });
    render(
      <WorkflowPaletteView
        agents={[agent]}
        onAddNode={vi.fn()}
        onAddAgentNode={vi.fn()}
      />,
    );

    expect(screen.getByText("Minimal Agent")).toBeInTheDocument();
  });

  it("shows empty state when agents array is empty", () => {
    render(
      <WorkflowPaletteView
        agents={[]}
        onAddNode={vi.fn()}
        onAddAgentNode={vi.fn()}
      />,
    );

    expect(screen.getByText(/No agents yet/i)).toBeInTheDocument();
  });
});
