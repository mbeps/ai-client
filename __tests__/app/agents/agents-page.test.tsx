import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import AgentsPage from "@/app/(main)/agents/page";
import { BUILT_IN_AGENTS } from "@/config/built-in-agents";
import { DEFAULT_AGENT_GUARDRAILS } from "@/drizzle/schemas/agent-schema";
import type { Agent } from "@/types/agent/agent";

const mockLoadAgents = vi.hoisted(() => vi.fn());

const customLeaf: Agent = {
  id: "leaf-1",
  userId: "user-1",
  name: "Custom Leaf",
  description: "Leaf helper",
  prompt: "",
  subagentPrompt: "",
  modelId: null,
  knowledgebaseIds: [],
  tools: [],
  skillMode: "dynamic",
  skillIds: [],
  promptMode: "all",
  promptIds: [],
  subagentIds: [],
  guardrails: DEFAULT_AGENT_GUARDRAILS,
  avatar: null,
  isBuiltIn: false,
  isOrchestrator: false,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const customOrchestrator: Agent = {
  ...customLeaf,
  id: "orch-1",
  name: "Custom Orchestrator",
  description: "Parent coordinator",
  subagentIds: ["builtin:researcher"],
  isOrchestrator: true,
};

vi.mock("next/navigation", () => ({
  useRouter: vi.fn(() => ({ push: vi.fn(), refresh: vi.fn() })),
}));
vi.mock("@/hooks/chat/use-create-chat", () => ({
  useCreateChat: vi.fn(() => vi.fn()),
}));
vi.mock("@/hooks/use-mobile", () => ({
  useIsMobile: vi.fn(() => false),
}));
vi.mock("@/lib/store/use-app-store", () => ({
  useAppStore: vi.fn((selector: any) =>
    selector({
      agents: [customLeaf, customOrchestrator, ...BUILT_IN_AGENTS],
      loadAgents: mockLoadAgents,
      deleteAgent: vi.fn(),
      loadError: null,
    }),
  ),
}));

describe("AgentsPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders agents and filters by role tabs (All, My Agents, Orchestrators, Subagents, Built-in)", async () => {
    const user = userEvent.setup();
    render(<AgentsPage />);

    expect(mockLoadAgents).toHaveBeenCalledOnce();
    expect(screen.getByText("Custom Leaf")).toBeInTheDocument();
    expect(screen.getByText("Custom Orchestrator")).toBeInTheDocument();
    expect(screen.getByText("Researcher")).toBeInTheDocument();

    await user.click(screen.getByRole("tab", { name: "Orchestrators" }));
    expect(screen.getByText("Custom Orchestrator")).toBeInTheDocument();
    expect(screen.queryByText("Custom Leaf")).not.toBeInTheDocument();
    expect(screen.queryByText("Researcher")).not.toBeInTheDocument();

    await user.click(screen.getByRole("tab", { name: "Built-in" }));
    expect(screen.getByText("Researcher")).toBeInTheDocument();
    expect(screen.queryByText("Custom Orchestrator")).not.toBeInTheDocument();
  });
});
