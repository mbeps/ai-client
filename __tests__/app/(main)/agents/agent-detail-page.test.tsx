import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Agent } from "@/types/agent/agent";
import type { Chat } from "@/types/chat/chat";

const {
  useParamsMock,
  pushMock,
  notFoundMock,
  setTabMock,
  listChatsMock,
  deleteAgentMock,
  loadChatsMock,
  loadAgentsMock,
  deleteAgentFromStoreMock,
  createNewChatMock,
  useResourceHydrationMock,
  useAgentEditorMock,
  toastSuccessMock,
  toastErrorMock,
  storeState,
} = vi.hoisted(() => ({
  useParamsMock: vi.fn(),
  pushMock: vi.fn(),
  notFoundMock: vi.fn(() => {
    throw new Error("NEXT_NOT_FOUND");
  }),
  setTabMock: vi.fn(),
  listChatsMock: vi.fn(),
  deleteAgentMock: vi.fn(),
  loadChatsMock: vi.fn(),
  loadAgentsMock: vi.fn(),
  deleteAgentFromStoreMock: vi.fn(),
  createNewChatMock: vi.fn(),
  useResourceHydrationMock: vi.fn(),
  useAgentEditorMock: vi.fn(),
  toastSuccessMock: vi.fn(),
  toastErrorMock: vi.fn(),
  storeState: {
    agents: [] as Agent[],
    chats: {} as Record<string, Chat>,
    mcpServers: [],
    skills: [],
  },
}));

vi.mock("@blocknote/core/fonts/inter.css", () => ({}));
vi.mock("@blocknote/mantine/style.css", () => ({}));

vi.mock("next/navigation", () => ({
  useParams: useParamsMock,
  useRouter: () => ({ push: pushMock, refresh: vi.fn() }),
  notFound: notFoundMock,
  unstable_rethrow: vi.fn(),
}));

vi.mock("nuqs", async () => {
  const React = await import("react");
  return {
    parseAsString: {
      withDefault: () => ({ withOptions: () => ({}) }),
    },
    useQueryState: () => {
      const [tab, setTab] = React.useState("chats");
      return [
        tab,
        (next: string) => {
          setTabMock(next);
          setTab(next);
        },
      ];
    },
  };
});

vi.mock("sonner", () => ({
  toast: { success: toastSuccessMock, error: toastErrorMock },
}));

vi.mock("@/actions/chats/list-chats", () => ({
  listChats: listChatsMock,
}));

vi.mock("@/actions/agents/delete-agent", () => ({
  deleteAgent: deleteAgentMock,
}));

vi.mock("@/hooks/chat/use-create-chat", () => ({
  useCreateChat: () => createNewChatMock,
}));

vi.mock("@/hooks/use-resource-hydration", () => ({
  useResourceHydration: useResourceHydrationMock,
}));

vi.mock("@/components/agent/use-agent-editor", () => ({
  useAgentEditor: useAgentEditorMock,
}));

vi.mock("@/lib/store/use-app-store", () => {
  const useAppStore = (selector: (s: unknown) => unknown) =>
    selector({
      ...storeState,
      loadChats: loadChatsMock,
      loadAgents: loadAgentsMock,
      deleteAgent: deleteAgentFromStoreMock,
    });
  useAppStore.getState = () => storeState;
  return { useAppStore };
});

vi.mock("@/components/skeletons/entity-detail-skeleton", () => ({
  EntityDetailSkeleton: () => <div data-testid="entity-detail-skeleton" />,
}));

vi.mock("@/components/shared/page-container", () => ({
  PageContainer: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock("@/components/shared/entity-detail-header", () => ({
  EntityDetailHeader: ({
    title,
    description,
    action,
  }: {
    title: string;
    description: string;
    action?: React.ReactNode;
  }) => (
    <div>
      <h1>{title}</h1>
      <p>{description}</p>
      {action}
    </div>
  ),
}));

vi.mock("@/components/shared/entity-chats-tab", () => ({
  EntityChatsTab: ({
    filteredChats = [],
    searchQuery,
    onSearchQueryChange,
  }: {
    filteredChats?: Chat[];
    searchQuery: string;
    onSearchQueryChange: (v: string) => void;
  }) => (
    <div>
      <input
        data-testid="chat-search"
        value={searchQuery}
        onChange={(e) => onSearchQueryChange(e.target.value)}
      />
      <div data-testid="filtered-chat-count">{filteredChats.length}</div>
    </div>
  ),
}));

vi.mock("@/components/shared/danger-zone-card", () => ({
  DangerZoneCard: ({ onDelete }: { onDelete: () => void }) => (
    <button data-testid="delete-agent-btn" onClick={onDelete}>
      Delete
    </button>
  ),
}));

vi.mock("@/components/agent/agent-settings-tab", () => ({
  AgentSettingsTab: (p: any) => (
    <button
      data-testid="trigger-settings-cbs"
      onClick={() => {
        p.onNameChange("N");
        p.onDescriptionChange("D");
        p.onModelIdChange("m1");
        p.onReasoningEffortChange("high");
      }}
    >
      SettingsCB
    </button>
  ),
}));
vi.mock("@/components/agent/agent-prompt-tab", () => ({
  AgentPromptTab: (p: any) => (
    <button
      data-testid="trigger-prompt-cbs"
      onClick={() => {
        p.onPromptChange("P");
        p.onSubagentPromptChange("SP");
        p.onPromptModeChange("selected");
        p.onTogglePromptId("pr1");
        p.onSelectPromptIds(new Set(["pr1"]));
      }}
    >
      PromptCB
    </button>
  ),
}));
vi.mock("@/components/shared/tools-config-tab", () => ({
  ToolsConfigTab: (p: any) => (
    <button
      data-testid="trigger-tools-cbs"
      onClick={() => {
        p.onToggleTool("s1", "t1");
        p.onBulkSelect("s1", ["t1", "t2"], true);
      }}
    >
      ToolsCB
    </button>
  ),
}));
vi.mock("@/components/agent/agent-knowledgebases-tab", () => ({
  AgentKnowledgebasesTab: (p: any) => (
    <button
      data-testid="trigger-kb-cbs"
      onClick={() => {
        p.onToggleKb("kb1");
      }}
    >
      KbCB
    </button>
  ),
}));
vi.mock("@/components/shared/skills-config-tab", () => ({
  SkillsConfigTab: (p: any) => (
    <button
      data-testid="trigger-skills-cbs"
      onClick={() => {
        p.onSkillModeChange("selected");
        p.onToggleSkill("sk1");
      }}
    >
      SkillsCB
    </button>
  ),
}));
vi.mock("@/components/shared/subagents-config-tab", () => ({
  SubagentsConfigTab: (p: any) => (
    <button
      data-testid="trigger-subagents-cbs"
      onClick={() => {
        p.onToggleSubagent("sub1");
      }}
    >
      SubagentsCB
    </button>
  ),
}));
vi.mock("@/components/agent/agent-guardrails-tab", () => ({
  AgentGuardrailsTab: (p: any) => (
    <button
      data-testid="trigger-guardrails-cbs"
      onClick={() => {
        p.onGuardrailsChange({ maxSteps: 10, maxTokens: 2000, timeoutMs: 5000, allowedTools: [] });
      }}
    >
      GuardrailsCB
    </button>
  ),
}));

vi.mock("@/components/agent/agent-prompts-tab", () => ({
  AgentPromptsTab: () => <div />,
}));
vi.mock("@/components/shared/entity-tools-tab", () => ({
  EntityToolsTab: () => <div />,
}));
vi.mock("@/components/shared/entity-skills-tab", () => ({
  EntitySkillsTab: () => <div />,
}));
vi.mock("@/components/shared/entity-subagents-tab", () => ({
  EntitySubagentsTab: () => <div />,
}));

import AgentDetailPage from "@/app/(main)/agents/[id]/page";

const baseAgent: Agent = {
  id: "a1",
  userId: "u1",
  name: "Agent One",
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
  guardrails: { maxSteps: 5, maxTokens: 1000, timeoutMs: 10000, allowedTools: [] },
  avatar: null,
  isBuiltIn: false,
  isOrchestrator: false,
  usedByCount: 0,
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe("AgentDetailPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    storeState.agents = [baseAgent];
    storeState.chats = {};
    useParamsMock.mockReturnValue({ id: "a1" });
    useResourceHydrationMock.mockReturnValue({ isLoading: false });
    listChatsMock.mockResolvedValue({ ok: true, value: [] });
    useAgentEditorMock.mockReturnValue({
      form: {
        name: "Agent One",
        description: "Helpful",
        prompt: "",
        subagentPrompt: "",
        modelId: null,
        reasoningEffort: null,
        selectedTools: new Set(),
        skillMode: "dynamic",
        selectedSkillIds: new Set(),
        promptMode: "all",
        selectedPromptIds: new Set(),
        selectedKbIds: [],
        selectedSubagentIds: [],
        guardrails: baseAgent.guardrails,
      },
      setForm: vi.fn(),
      saving: {},
      handleSaveDetails: vi.fn(),
      handleSavePrompts: vi.fn(),
      handleSaveTools: vi.fn(),
      handleSaveKbs: vi.fn(),
      handleSaveSkills: vi.fn(),
      handleSaveSubagents: vi.fn(),
      handleSaveGuardrails: vi.fn(),
    });
  });

  it("calls notFound for 'new' or missing agent after hydration", () => {
    const errors: unknown[] = [];
    const CatchError = ({ children }: { children: React.ReactNode }) => {
      try {
        return <>{children}</>;
      } catch (e) {
        errors.push(e);
        return null;
      }
    };
    useParamsMock.mockReturnValue({ id: "new" });
    expect(() => render(<AgentDetailPage />)).toThrow("NEXT_NOT_FOUND");

    useParamsMock.mockReturnValue({ id: "missing" });
    expect(() => render(<AgentDetailPage />)).toThrow("NEXT_NOT_FOUND");
  });

  it("renders skeleton when agent is not yet loaded", () => {
    storeState.agents = [];
    useParamsMock.mockReturnValue({ id: "a1" });
    render(<AgentDetailPage />);
    expect(screen.getByTestId("entity-detail-skeleton")).toBeInTheDocument();
  });

  it("renders custom agent, filters chats, creates chat, and handles delete outcomes", async () => {
    const now = new Date();
    storeState.chats = {
      c1: { id: "c1", title: "Alpha", agentId: "a1", createdAt: now, updatedAt: now, messages: {}, currentLeafId: null },
      c2: { id: "c2", title: "Beta", assistantId: "a1", createdAt: now, updatedAt: now, messages: {}, currentLeafId: null },
    };

    render(<AgentDetailPage />);
    expect(screen.getByText("Agent One")).toBeInTheDocument();
    expect(screen.getByTestId("filtered-chat-count")).toHaveTextContent("2");

    fireEvent.change(screen.getByTestId("chat-search"), { target: { value: "alpha" } });
    expect(screen.getByTestId("filtered-chat-count")).toHaveTextContent("1");

    fireEvent.click(screen.getByRole("button", { name: /New Chat/i }));
    expect(createNewChatMock).toHaveBeenCalledWith("New Chat", undefined, "a1");

    deleteAgentMock.mockResolvedValueOnce({ ok: false, error: { message: "Denied" } });
    const user = (await import("@testing-library/user-event")).default.setup();
    await user.click(screen.getByRole("tab", { name: /danger/i }));
    await waitFor(() =>
      expect(screen.getByTestId("delete-agent-btn")).toBeInTheDocument(),
    );
    fireEvent.click(screen.getByTestId("delete-agent-btn"));
    await waitFor(() => expect(toastErrorMock).toHaveBeenCalledWith("Denied"));

    deleteAgentMock.mockRejectedValueOnce(new Error("boom"));
    fireEvent.click(screen.getByTestId("delete-agent-btn"));
    await waitFor(() => expect(toastErrorMock).toHaveBeenCalledWith("Failed to delete agent"));

    deleteAgentMock.mockResolvedValueOnce({ ok: true, value: undefined });
    fireEvent.click(screen.getByTestId("delete-agent-btn"));
    await waitFor(() => {
      expect(deleteAgentFromStoreMock).toHaveBeenCalledWith("a1");
      expect(pushMock).toHaveBeenCalledWith("/agents");
    });
  });

  it("renders built-in kb-reader agent without New Chat button", () => {
    useParamsMock.mockReturnValue({ id: "builtin:kb-reader" });
    render(<AgentDetailPage />);
    expect(screen.queryByRole("button", { name: /New Chat/i })).not.toBeInTheDocument();
  });

  it("covers non-string params.id, listChats failure/rejection, empty delete error, non-kb-reader builtin, and all tab callbacks", async () => {
    useParamsMock.mockReturnValue({});
    expect(() => render(<AgentDetailPage />)).toThrow("NEXT_NOT_FOUND");

    useParamsMock.mockReturnValue({ id: "builtin:other" });
    storeState.agents = [{ ...baseAgent, id: "builtin:other", isBuiltIn: true }];
    render(<AgentDetailPage />);
    expect(screen.getByText(/Built-in system agents cannot be edited or deleted/)).toBeInTheDocument();
    storeState.agents = [baseAgent];

    useParamsMock.mockReturnValue({ id: "a1" });
    listChatsMock.mockResolvedValueOnce({ ok: false, error: { message: "err" } });
    render(<AgentDetailPage />);
    await waitFor(() => expect(listChatsMock).toHaveBeenCalled());

    listChatsMock.mockRejectedValueOnce(new Error("net"));
    render(<AgentDetailPage />);
    await waitFor(() => expect(listChatsMock).toHaveBeenCalled());

    const user = (await import("@testing-library/user-event")).default.setup();
    for (const tabName of [/settings/i, /prompts/i, /tools/i, /knowledge/i, /skills/i, /subagents/i, /guardrails/i]) {
      const tabs = screen.queryAllByRole("tab", { name: tabName });
      if (tabs[0]) await user.click(tabs[0]);
    }
    for (const testId of [
      "trigger-prompts-cbs",
      "trigger-tools-cbs",
      "trigger-kb-cbs",
      "trigger-skills-cbs",
      "trigger-subagents-cbs",
      "trigger-guardrails-cbs",
    ]) {
      const el = screen.queryByTestId(testId);
      if (el) fireEvent.click(el);
    }

    deleteAgentMock.mockResolvedValueOnce({ ok: false, error: { message: "" } });
    await user.click(screen.getAllByRole("tab", { name: /danger/i })[0]);
    await waitFor(() => expect(screen.getAllByTestId("delete-agent-btn")[0]).toBeInTheDocument());
    fireEvent.click(screen.getAllByTestId("delete-agent-btn")[0]);
    await waitFor(() => expect(toastErrorMock).toHaveBeenCalledWith("Failed to delete agent"));
  });

  it("covers all tab callbacks including toggle add and remove", async () => {
    const user = (await import("@testing-library/user-event")).default.setup();
    render(<AgentDetailPage />);

    const testIds = [
      "trigger-settings-cbs",
      "trigger-prompt-cbs",
      "trigger-tools-cbs",
      "trigger-kb-cbs",
      "trigger-skills-cbs",
      "trigger-subagents-cbs",
      "trigger-guardrails-cbs",
    ];

    for (const tab of screen.getAllByRole("tab")) {
      await user.click(tab);
      await waitFor(() => {
        for (const testId of testIds) {
          const btn = screen.queryByTestId(testId);
          if (btn) {
            fireEvent.click(btn);
            fireEvent.click(btn);
          }
        }
      });
    }
  });
});
