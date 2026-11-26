import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { listChatsMock, listProjectsMock, listAgentsMock } = vi.hoisted(() => ({
  listChatsMock: vi.fn(),
  listProjectsMock: vi.fn(),
  listAgentsMock: vi.fn(),
}));

vi.mock("@/actions/chats/list-chats", () => ({
  listChats: listChatsMock,
}));

vi.mock("@/actions/projects/list-projects", () => ({
  listProjects: listProjectsMock,
}));

vi.mock("@/actions/agents/list-agents", () => ({
  listAgents: listAgentsMock,
}));

vi.mock("@/components/chat/chat-card", () => ({
  ChatCard: ({ chat }: { chat: { id: string; title: string } }) => (
    <div data-testid={`chat-${chat.id}`}>{chat.title}</div>
  ),
}));

vi.mock("@/components/project/project-card", () => ({
  ProjectCard: ({ project }: { project: { id: string; name: string } }) => (
    <div data-testid={`project-${project.id}`}>{project.name}</div>
  ),
}));

vi.mock("@/components/agent/agent-card", () => ({
  AgentCard: ({ agent }: { agent: { id: string; name: string } }) => (
    <div data-testid={`agent-${agent.id}`}>{agent.name}</div>
  ),
}));

vi.mock("@/components/shared/resource-list-page", () => ({
  ResourceListPage: ({
    items,
    filterFn,
    customFilterFn,
    renderList,
    extraFilters,
  }: {
    items: Array<{ type: string; id: string }>;
    filterFn: (item: unknown, q: string) => boolean;
    customFilterFn: (item: unknown) => boolean;
    renderList: (items: unknown[]) => React.ReactNode;
    extraFilters: React.ReactNode;
  }) => {
    const filtered = items.filter((item) => customFilterFn(item) && filterFn(item, ""));
    return (
      <div data-testid="resource-list-page">
        {extraFilters}
        {renderList(filtered)}
        <div data-testid="search-alpha">
          {items.filter((item) => filterFn(item, "alpha")).length}
        </div>
        <div data-testid="search-unknown">
          {String(filterFn({ type: "unknown" }, "alpha"))}
        </div>
      </div>
    );
  },
}));

vi.mock("@/components/ui/select", () => ({
  Select: ({
    value,
    onValueChange,
    children,
  }: {
    value: string;
    onValueChange: (val: string) => void;
    children: React.ReactNode;
  }) => (
    <div>
      <select
        data-testid="search-filter-select"
        value={value}
        onChange={(e) => onValueChange(e.target.value)}
      >
        <option value="all">All Types</option>
        <option value="chat">Chats</option>
        <option value="project">Projects</option>
        <option value="agent">Agents</option>
      </select>
      {children}
    </div>
  ),
  SelectTrigger: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SelectValue: () => null,
  SelectContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SelectItem: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

import SearchPage from "@/app/(main)/search/page";
import { SearchClient } from "@/app/(main)/search/_components/search-client";

describe("SearchPage and SearchClient", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders SearchPage with populated and null-coalesced rows", async () => {
    listChatsMock.mockResolvedValue({
      ok: true,
      value: [
        {
          id: "c1",
          title: "Alpha Chat",
          projectId: "p1",
          agentId: "a1",
          knowledgebaseId: "kb1",
          createdAt: "2026-01-01T00:00:00Z",
          updatedAt: "2026-01-01T00:00:00Z",
          currentLeafId: "m1",
        },
        {
          id: "c2",
          title: "Beta Chat",
          projectId: null,
          agentId: null,
          knowledgebaseId: null,
          createdAt: "2026-01-01T00:00:00Z",
          updatedAt: "2026-01-01T00:00:00Z",
          currentLeafId: null,
        },
      ],
    });
    listProjectsMock.mockResolvedValue({
      ok: true,
      value: [
        {
          id: "p1",
          userId: "u1",
          name: "Alpha Project",
          description: "desc",
          globalPrompt: "gp",
          tools: ["t1"],
          skillMode: "dynamic",
          skillIds: ["s1"],
          promptMode: "specific",
          promptIds: ["pr1"],
          knowledgebaseId: "kb1",
          subagentIds: ["a1"],
          createdAt: "2026-01-01T00:00:00Z",
          updatedAt: "2026-01-01T00:00:00Z",
        },
        {
          id: "p2",
          userId: "u1",
          name: "Beta Project",
          description: null,
          globalPrompt: null,
          tools: null,
          skillMode: "none",
          skillIds: null,
          promptMode: null,
          promptIds: null,
          knowledgebaseId: null,
          subagentIds: null,
          createdAt: "2026-01-01T00:00:00Z",
          updatedAt: "2026-01-01T00:00:00Z",
        },
      ],
    });
    listAgentsMock.mockResolvedValue({
      ok: true,
      value: [
        {
          id: "a1",
          userId: "u1",
          name: "Alpha Agent",
          description: "desc",
          prompt: "p",
          tools: ["t1"],
          skillMode: "dynamic",
          skillIds: ["s1"],
          promptMode: "specific",
          promptIds: ["pr1"],
          avatar: "av",
          subagentPrompt: "sp",
          modelId: "m1",
          subagentIds: ["a2"],
          guardrails: { maxTokens: 10 },
          createdAt: "2026-01-01T00:00:00Z",
          updatedAt: "2026-01-01T00:00:00Z",
        },
        {
          id: "a2",
          userId: "u1",
          name: "Beta Agent",
          description: null,
          prompt: null,
          tools: null,
          skillMode: "none",
          skillIds: null,
          promptMode: null,
          promptIds: null,
          avatar: null,
          subagentPrompt: null,
          modelId: null,
          subagentIds: null,
          guardrails: null,
          createdAt: "2026-01-01T00:00:00Z",
          updatedAt: "2026-01-01T00:00:00Z",
        },
      ],
    });

    const el = await SearchPage();
    render(el);

    expect(screen.getByTestId("chat-c1")).toBeInTheDocument();
    expect(screen.getByTestId("project-p1")).toBeInTheDocument();
    expect(screen.getByTestId("agent-a1")).toBeInTheDocument();
    expect(screen.getByTestId("search-alpha")).toHaveTextContent("3");
    expect(screen.getByTestId("search-unknown")).toHaveTextContent("false");
  });

  it("handles rejected or failed list calls in SearchPage", async () => {
    listChatsMock.mockRejectedValue(new Error("chat err"));
    listProjectsMock.mockRejectedValue(new Error("proj err"));
    listAgentsMock.mockRejectedValue(new Error("agent err"));

    const el = await SearchPage();
    render(el);

    expect(screen.queryByRole("heading", { name: "Projects" })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Agents" })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Chats" })).not.toBeInTheDocument();
  });

  it("filters SearchClient by type", () => {
    const now = new Date();
    render(
      <SearchClient
        initialChats={[{ id: "c1", title: "C1", createdAt: now, updatedAt: now, messages: {}, currentLeafId: null }]}
        initialProjects={[
          {
            id: "p1",
            userId: "u1",
            name: "P1",
            description: "",
            globalPrompt: "",
            tools: [],
            skillMode: "none",
            skillIds: [],
            promptMode: "all",
            promptIds: [],
            knowledgebaseId: null,
            subagentIds: [],
            createdAt: now,
            updatedAt: now,
          },
        ]}
        initialAgents={[
          {
            id: "a1",
            userId: "u1",
            name: "A1",
            description: "",
            prompt: "",
            tools: [],
            skillMode: "none",
            skillIds: [],
            promptMode: "all",
            promptIds: [],
            avatar: null,
            subagentPrompt: "",
            modelId: null,
            knowledgebaseIds: [],
            subagentIds: [],
            guardrails: null,
            isBuiltIn: false,
            isOrchestrator: false,
            usedByCount: 0,
            createdAt: now,
            updatedAt: now,
          },
        ]}
      />,
    );

    const select = screen.getByTestId("search-filter-select");
    fireEvent.change(select, { target: { value: "chat" } });
    expect(screen.getByTestId("chat-c1")).toBeInTheDocument();
    expect(screen.queryByTestId("project-p1")).not.toBeInTheDocument();

    fireEvent.change(select, { target: { value: "project" } });
    expect(screen.getByTestId("project-p1")).toBeInTheDocument();
    expect(screen.queryByTestId("chat-c1")).not.toBeInTheDocument();

    fireEvent.change(select, { target: { value: "agent" } });
    expect(screen.getByTestId("agent-a1")).toBeInTheDocument();
    expect(screen.queryByTestId("project-p1")).not.toBeInTheDocument();
  });
});
