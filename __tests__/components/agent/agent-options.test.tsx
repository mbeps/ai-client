import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AgentOptions } from "@/components/agent/agent-options";
import { BUILT_IN_AGENTS } from "@/config/built-in-agents";
import { DEFAULT_AGENT_GUARDRAILS } from "@/drizzle/schemas/agent-schema";
import type { Agent } from "@/types/agent/agent";

const mockPush = vi.hoisted(() => vi.fn());
const mockRefresh = vi.hoisted(() => vi.fn());
const mockCreateNewChat = vi.hoisted(() => vi.fn());
const mockLoadAgents = vi.hoisted(() => vi.fn());
const mockDeleteAgentFromStore = vi.hoisted(() => vi.fn());

vi.mock("next/navigation", () => ({
  useRouter: vi.fn(() => ({ push: mockPush, refresh: mockRefresh })),
}));
vi.mock("@/hooks/chat/use-create-chat", () => ({
  useCreateChat: vi.fn(() => mockCreateNewChat),
}));
vi.mock("@/hooks/use-mobile", () => ({
  useIsMobile: vi.fn(() => false),
}));
vi.mock("@/actions/agents/rename-agent", () => ({
  renameAgent: vi.fn(async () => ({ ok: true, value: {} })),
}));
vi.mock("@/actions/agents/delete-agent", () => ({
  deleteAgent: vi.fn(async () => ({ ok: true, value: undefined })),
}));
vi.mock("@/lib/store/use-app-store", () => ({
  useAppStore: vi.fn((selector: any) =>
    selector({
      loadAgents: mockLoadAgents,
      deleteAgent: mockDeleteAgentFromStore,
    }),
  ),
}));

const customAgent: Agent = {
  id: "agent-1",
  userId: "user-1",
  name: "Custom Agent",
  description: "Helpful",
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
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe("AgentOptions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows New Chat, Manage, Rename Agent, and Delete Agent for custom agents", async () => {
    const user = userEvent.setup();
    render(<AgentOptions agent={customAgent} />);
    await user.click(screen.getByRole("button"));

    expect(screen.getByText("New Chat")).toBeInTheDocument();
    expect(screen.getByText("Manage")).toBeInTheDocument();
    expect(screen.getByText("Rename Agent")).toBeInTheDocument();
    expect(screen.getByText("Delete Agent")).toBeInTheDocument();
  });

  it("hides Rename/Delete for built-in agents and hides New Chat for builtin:kb-reader", async () => {
    const user = userEvent.setup();
    const kbReader = BUILT_IN_AGENTS.find((a) => a.id === "builtin:kb-reader")!;
    render(<AgentOptions agent={kbReader} />);
    await user.click(screen.getByRole("button"));

    expect(screen.queryByText("New Chat")).not.toBeInTheDocument();
    expect(screen.getByText("Inspect")).toBeInTheDocument();
    expect(screen.queryByText("Rename Agent")).not.toBeInTheDocument();
    expect(screen.queryByText("Delete Agent")).not.toBeInTheDocument();
  });

  it("triggers New Chat, Rename Agent, and Delete Agent actions", async () => {
    const user = userEvent.setup();
    const { renameAgent } = await import("@/actions/agents/rename-agent");
    const { deleteAgent } = await import("@/actions/agents/delete-agent");

    render(<AgentOptions agent={customAgent} />);
    await user.click(screen.getByRole("button"));
    await user.click(screen.getByText("New Chat"));
    expect(mockCreateNewChat).toHaveBeenCalledWith("New Chat", undefined, "agent-1");

    await user.click(screen.getByRole("button"));
    await user.click(screen.getByText("Rename Agent"));
    const input = screen.getByDisplayValue("Custom Agent");
    await user.clear(input);
    await user.type(input, "Renamed Agent");
    await user.click(screen.getByRole("button", { name: /save/i }));
    expect(renameAgent).toHaveBeenCalledWith("agent-1", "Renamed Agent");

    await user.click(screen.getByRole("button"));
    await user.click(screen.getByText("Delete Agent"));
    await user.click(screen.getByRole("button", { name: /delete/i }));
    expect(deleteAgent).toHaveBeenCalledWith("agent-1");
    expect(mockDeleteAgentFromStore).toHaveBeenCalledWith("agent-1");
  });

  it("does not delete from store when deleteAgent returns ok: false", async () => {
    const user = userEvent.setup();
    const { deleteAgent } = await import("@/actions/agents/delete-agent");
    vi.mocked(deleteAgent).mockResolvedValueOnce({ ok: false, error: "fail" });

    render(<AgentOptions agent={customAgent} />);
    await user.click(screen.getByRole("button"));
    await user.click(screen.getByText("Delete Agent"));
    await user.click(screen.getByRole("button", { name: /delete/i }));
    expect(deleteAgent).toHaveBeenCalledWith("agent-1");
    expect(mockDeleteAgentFromStore).not.toHaveBeenCalled();
  });
});
