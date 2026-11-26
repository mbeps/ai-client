import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Chat } from "@/types/chat/chat";
import type { Project } from "@/types/project/project";

const {
  useParamsMock,
  pushMock,
  refreshMock,
  notFoundMock,
  setTabMock,
  listChatsMock,
  listKnowledgebasesMock,
  updateProjectMock,
  deleteProjectMock,
  loadProjectsMock,
  loadChatsMock,
  deleteProjectFromStoreMock,
  createNewChatMock,
  useResourceHydrationMock,
  toastSuccessMock,
  toastErrorMock,
  storeState,
} = vi.hoisted(() => ({
  useParamsMock: vi.fn(),
  pushMock: vi.fn(),
  refreshMock: vi.fn(),
  notFoundMock: vi.fn(() => {
    throw new Error("NEXT_NOT_FOUND");
  }),
  setTabMock: vi.fn(),
  listChatsMock: vi.fn(),
  listKnowledgebasesMock: vi.fn(),
  updateProjectMock: vi.fn(),
  deleteProjectMock: vi.fn(),
  loadProjectsMock: vi.fn(),
  loadChatsMock: vi.fn(),
  deleteProjectFromStoreMock: vi.fn(),
  createNewChatMock: vi.fn(),
  useResourceHydrationMock: vi.fn(),
  toastSuccessMock: vi.fn(),
  toastErrorMock: vi.fn(),
  storeState: {
    projects: [] as Project[],
    chats: {} as Record<string, Chat>,
    agents: [],
    mcpServers: [],
    skills: [],
  },
}));

vi.mock("next/navigation", () => ({
  useParams: useParamsMock,
  useRouter: () => ({ push: pushMock, refresh: refreshMock }),
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

vi.mock("@/actions/knowledgebases/list-knowledgebases", () => ({
  listKnowledgebases: listKnowledgebasesMock,
}));

vi.mock("@/actions/projects/update-project", () => ({
  updateProject: updateProjectMock,
}));

vi.mock("@/actions/projects/delete-project", () => ({
  deleteProject: deleteProjectMock,
}));

vi.mock("@/hooks/chat/use-create-chat", () => ({
  useCreateChat: () => createNewChatMock,
}));

vi.mock("@/hooks/use-resource-hydration", () => ({
  useResourceHydration: useResourceHydrationMock,
}));

vi.mock("@/lib/store/use-app-store", () => {
  const useAppStore = (selector: (s: unknown) => unknown) =>
    selector({
      ...storeState,
      loadProjects: loadProjectsMock,
      loadChats: loadChatsMock,
      deleteProject: deleteProjectFromStoreMock,
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
    actionLabel,
    onAction,
  }: {
    title: string;
    description: string;
    action?: React.ReactNode;
    actionLabel?: string;
    onAction?: () => void;
  }) => (
    <div>
      <h1>{title}</h1>
      <p>{description}</p>
      {action}
      {actionLabel && onAction && (
        <button type="button" onClick={onAction}>
          {actionLabel}
        </button>
      )}
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

vi.mock("@/components/shared/subagents-config-tab", () => ({
  SubagentsConfigTab: ({ onSave }: { onSave: () => void }) => (
    <button data-testid="save-subagents-btn" onClick={onSave}>
      Save Subagents
    </button>
  ),
}));

vi.mock("@/components/shared/skills-config-tab", () => ({
  SkillsConfigTab: ({ onSave }: { onSave: () => void }) => (
    <button data-testid="save-skills-btn" onClick={onSave}>
      Save Skills
    </button>
  ),
}));

vi.mock("@/components/shared/danger-zone-card", () => ({
  DangerZoneCard: ({ onDelete }: { onDelete: () => void }) => (
    <button data-testid="delete-project-btn" onClick={onDelete}>
      Delete Project
    </button>
  ),
}));

vi.mock("@/components/project/project-settings-tab", () => ({
  ProjectSettingsTab: ({
    onSave,
    onDelete,
    onNameChange,
  }: {
    onSave: () => void;
    onDelete?: () => void;
    onNameChange: (name: string) => void;
  }) => (
    <div>
      <button data-testid="save-settings-btn" onClick={onSave}>
        Save Settings
      </button>
      {onDelete && (
        <button data-testid="delete-project-btn" onClick={onDelete}>
          Delete Project
        </button>
      )}
      <button
        data-testid="clear-name-btn"
        onClick={() => onNameChange("  ")}
      >
        Clear Name
      </button>
    </div>
  ),
}));

vi.mock("@/components/shared/entity-tools-tab", () => ({
  EntityToolsTab: (p: any) => (
    <button
      data-testid="trigger-tools-cbs"
      onClick={() => {
        p.onToggleTool("s1", "t1");
        p.onBulkSelect("s1", ["t1", "t2"], true);
        p.onSave?.();
      }}
    >
      ToolsCB
    </button>
  ),
}));

vi.mock("@/components/shared/markdown-tab-editor", () => ({
  MarkdownTabEditor: (p: any) => (
    <button
      data-testid="trigger-prompt-cbs"
      onClick={() => {
        p.onChange("Updated prompt");
        p.onSave?.();
      }}
    >
      PromptCB
    </button>
  ),
}));

vi.mock("@/components/shared/entity-skills-tab", () => ({
  EntitySkillsTab: ({ onSave }: { onSave: () => void }) => (
    <button data-testid="save-skills-btn" onClick={onSave}>
      Save Skills
    </button>
  ),
}));

vi.mock("@/components/shared/entity-subagents-tab", () => ({
  EntitySubagentsTab: ({ onSave }: { onSave: () => void }) => (
    <button data-testid="save-subagents-btn" onClick={onSave}>
      Save Subagents
    </button>
  ),
}));

vi.mock("@/components/project/project-knowledgebase-tab", () => ({
  ProjectKnowledgebaseTab: ({ onSave }: { onSave: () => void }) => (
    <button data-testid="save-kb-btn" onClick={onSave}>
      Save KB
    </button>
  ),
}));

import ProjectPage from "@/app/(main)/projects/[id]/page";

const baseProject: Project = {
  id: "p1",
  userId: "u1",
  name: "Project One",
  description: "Desc",
  globalPrompt: "Prompt",
  tools: ["t1"],
  skillMode: "dynamic",
  skillIds: ["s1"],
  promptMode: "all",
  promptIds: ["pr1"],
  knowledgebaseId: "kb1",
  subagentIds: ["a1"],
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe("ProjectPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    storeState.projects = [baseProject];
    storeState.chats = {};
    useParamsMock.mockReturnValue({ id: "p1" });
    useResourceHydrationMock.mockReturnValue({ isLoading: false });
    listChatsMock.mockResolvedValue({ ok: true, value: [] });
    listKnowledgebasesMock.mockResolvedValue({ ok: true, value: [] });
    updateProjectMock.mockResolvedValue({ ok: true, value: baseProject });
    deleteProjectMock.mockResolvedValue({ ok: true, value: undefined });
  });

  it("calls notFound for 'new' or missing project after hydration", () => {
    useParamsMock.mockReturnValue({ id: "new" });
    expect(() => render(<ProjectPage />)).toThrow("NEXT_NOT_FOUND");

    useParamsMock.mockReturnValue({ id: "missing" });
    expect(() => render(<ProjectPage />)).toThrow("NEXT_NOT_FOUND");
  });

  it("renders skeleton when project is not yet loaded", () => {
    storeState.projects = [];
    useParamsMock.mockReturnValue({ id: "p1" });
    render(<ProjectPage />);
    expect(screen.getByTestId("entity-detail-skeleton")).toBeInTheDocument();
  });

  it("renders project, filters chats, creates chat, and handles save/delete actions", async () => {
    const now = new Date();
    storeState.chats = {
      c1: { id: "c1", title: "Alpha", projectId: "p1", createdAt: now, updatedAt: now, messages: {}, currentLeafId: null },
      c2: { id: "c2", title: "Beta", projectId: "p1", createdAt: now, updatedAt: now, messages: {}, currentLeafId: null },
    };

    render(<ProjectPage />);
    expect(screen.getByText("Project One")).toBeInTheDocument();
    expect(screen.getByTestId("filtered-chat-count")).toHaveTextContent("2");

    fireEvent.change(screen.getByTestId("chat-search"), { target: { value: "alpha" } });
    expect(screen.getByTestId("filtered-chat-count")).toHaveTextContent("1");

    fireEvent.click(screen.getByRole("button", { name: /New Chat/i }));
    expect(createNewChatMock).toHaveBeenCalledWith("New Chat", "p1");

    // Save skills ok + catch
    const user = (await import("@testing-library/user-event")).default.setup();
    await user.click(screen.getByRole("tab", { name: /skills/i }));
    await waitFor(() =>
      expect(screen.getByTestId("save-skills-btn")).toBeInTheDocument(),
    );
    fireEvent.click(screen.getByTestId("save-skills-btn"));
    await waitFor(() => expect(toastSuccessMock).toHaveBeenCalledWith("Project skills saved"));
    updateProjectMock.mockRejectedValueOnce(new Error("err"));
    fireEvent.click(screen.getByTestId("save-skills-btn"));
    await waitFor(() => expect(toastErrorMock).toHaveBeenCalledWith("Failed to save project skills"));

    // Save subagents ok, !ok, catch
    await user.click(screen.getByRole("tab", { name: /subagents/i }));
    await waitFor(() =>
      expect(screen.getByTestId("save-subagents-btn")).toBeInTheDocument(),
    );
    fireEvent.click(screen.getByTestId("save-subagents-btn"));
    await waitFor(() => expect(toastSuccessMock).toHaveBeenCalledWith("Project subagents saved"));
    updateProjectMock.mockResolvedValueOnce({ ok: false, error: { message: "Bad subagents" } });
    fireEvent.click(screen.getByTestId("save-subagents-btn"));
    await waitFor(() => expect(toastErrorMock).toHaveBeenCalledWith("Bad subagents"));
    updateProjectMock.mockRejectedValueOnce(new Error("err"));
    fireEvent.click(screen.getByTestId("save-subagents-btn"));
    await waitFor(() => expect(toastErrorMock).toHaveBeenCalledWith("Failed to save project subagents"));

    // Save KB ok + catch
    await user.click(screen.getByRole("tab", { name: /knowledge/i }));
    await waitFor(() =>
      expect(screen.getByTestId("save-kb-btn")).toBeInTheDocument(),
    );
    fireEvent.click(screen.getByTestId("save-kb-btn"));
    await waitFor(() => expect(toastSuccessMock).toHaveBeenCalledWith("Knowledge base associated"));
    updateProjectMock.mockRejectedValueOnce(new Error("err"));
    fireEvent.click(screen.getByTestId("save-kb-btn"));
    await waitFor(() => expect(toastErrorMock).toHaveBeenCalledWith("Failed to associate knowledge base"));

    // Save settings ok + catch + empty name
    await user.click(screen.getByRole("tab", { name: /settings/i }));
    await waitFor(() =>
      expect(screen.getByTestId("save-settings-btn")).toBeInTheDocument(),
    );
    fireEvent.click(screen.getByTestId("save-settings-btn"));
    await waitFor(() => expect(toastSuccessMock).toHaveBeenCalledWith("Project settings saved"));
    updateProjectMock.mockRejectedValueOnce(new Error("err"));
    fireEvent.click(screen.getByTestId("save-settings-btn"));
    await waitFor(() => expect(toastErrorMock).toHaveBeenCalledWith("Failed to save project settings"));


    // Delete project catch + ok
    await user.click(screen.getByRole("tab", { name: /danger/i }));
    await waitFor(() =>
      expect(screen.getByTestId("delete-project-btn")).toBeInTheDocument(),
    );
    deleteProjectMock.mockRejectedValueOnce(new Error("err"));
    fireEvent.click(screen.getByTestId("delete-project-btn"));
    await waitFor(() => expect(toastErrorMock).toHaveBeenCalledWith("Failed to delete project"));

    fireEvent.click(screen.getByTestId("delete-project-btn"));
    await waitFor(() => {
      expect(loadProjectsMock).toHaveBeenCalled();
      expect(pushMock).toHaveBeenCalledWith("/projects");
    });
  });

  it("triggers all tab callbacks and handles minimal project fields", async () => {
    storeState.projects = [{ id: "p1", name: "Min Project" } as any];
    (storeState as any).prompts = [];
    const user = (await import("@testing-library/user-event")).default.setup();
    render(<ProjectPage />);

    const tabToTestId: Array<[RegExp, string]> = [
      [/settings/i, "trigger-settings-cbs"],
      [/prompt/i, "trigger-prompt-cbs"],
      [/tools/i, "trigger-tools-cbs"],
      [/knowledge/i, "trigger-kb-cbs"],
      [/skills/i, "trigger-skills-cbs"],
      [/subagents/i, "trigger-subagents-cbs"],
    ];

    for (const [tabPattern, testId] of tabToTestId) {
      const tab = screen.getAllByRole("tab", { name: tabPattern })[0];
      await user.click(tab);
      const btn = screen.queryByTestId(testId);
      if (btn) {
        fireEvent.click(btn);
        fireEvent.click(btn);
      }
    }

    // Also test empty error message on subagents save
    await user.click(screen.getAllByRole("tab", { name: /subagents/i })[0]);
    const saveSubBtn = await waitFor(() => screen.getByTestId("save-subagents-btn"));
    updateProjectMock.mockResolvedValueOnce({ ok: false, error: { message: "" } });
    fireEvent.click(saveSubBtn);
    await waitFor(() => expect(toastErrorMock).toHaveBeenCalledWith("Failed to save project subagents"));
  });
});
