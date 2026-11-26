import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import NewAgentPage from "@/app/(main)/agents/new/page";
import { useResourceHydration } from "@/hooks/use-resource-hydration";
import { useAppStore } from "@/lib/store/use-app-store";

const mockPush = vi.hoisted(() => vi.fn());
const mockSetTab = vi.hoisted(() => vi.fn());
const mockLoadAgents = vi.hoisted(() => vi.fn());
const mockCreateAgent = vi.hoisted(() => vi.fn());
const mockToastSuccess = vi.hoisted(() => vi.fn());
const mockToastError = vi.hoisted(() => vi.fn());

vi.mock("next/navigation", () => ({
  useRouter: vi.fn(() => ({ push: mockPush })),
}));
vi.mock("nuqs", () => ({
  parseAsString: {
    withDefault: () => ({ withOptions: () => ({}) }),
  },
  useQueryState: () => {
    const [tab, setTab] = React.useState("settings");
    return [
      tab,
      (v: string) => {
        mockSetTab(v);
        setTab(v);
      },
    ];
  },
}));
vi.mock("sonner", () => ({
  toast: { success: mockToastSuccess, error: mockToastError },
}));
vi.mock("@/components/agent/agent-settings-tab", () => ({
  AgentSettingsTab: (p: any) => (
    <div>
      <input
        placeholder="Agent name"
        value={p.name}
        onChange={(e) => p.onNameChange(e.target.value)}
      />
      <button
        data-testid="trigger-agent-settings"
        onClick={() => {
          p.onDescriptionChange("Desc");
          p.onModelIdChange("m1");
          p.onReasoningEffortChange("high");
        }}
      />
      <button disabled={!p.name.trim() || p.isSaving} onClick={p.onSave}>
        Create Agent
      </button>
    </div>
  ),
}));
vi.mock("@/components/agent/agent-prompt-tab", () => ({
  AgentPromptTab: (p: any) => (
    <div>
      <button
        data-testid="trigger-agent-prompt"
        onClick={() => {
          p.onPromptChange("P");
          p.onSubagentPromptChange("SP");
          p.onPromptModeChange("selected");
          p.onTogglePromptId("pr1");
          p.onSelectPromptIds(new Set(["pr2"]));
        }}
      />
      <button onClick={p.onSave}>Create Agent</button>
    </div>
  ),
}));
vi.mock("@/components/shared/tools-config-tab", () => ({
  ToolsConfigTab: (p: any) => (
    <button
      data-testid="trigger-agent-tools"
      onClick={() => {
        p.onToggleTool("s1", "t1");
        p.onBulkSelect("s1", ["t1", "t2"], true);
      }}
    />
  ),
}));
vi.mock("@/components/agent/agent-knowledgebases-tab", () => ({
  AgentKnowledgebasesTab: (p: any) => (
    <button
      data-testid="trigger-agent-kbs"
      onClick={() => {
        p.onToggleKb("kb1");
        p.onToggleKb("kb1");
      }}
    />
  ),
}));
vi.mock("@/components/shared/skills-config-tab", () => ({
  SkillsConfigTab: (p: any) => (
    <button
      data-testid="trigger-agent-skills"
      onClick={() => {
        p.onSkillModeChange("all");
        p.onToggleSkill("sk1");
      }}
    />
  ),
}));
vi.mock("@/components/shared/subagents-config-tab", () => ({
  SubagentsConfigTab: (p: any) => (
    <button
      data-testid="trigger-agent-subagents"
      onClick={() => {
        p.onToggleSubagent("sub1");
        p.onToggleSubagent("sub1");
      }}
    />
  ),
}));
vi.mock("@/components/agent/agent-guardrails-tab", () => ({
  AgentGuardrailsTab: (p: any) => (
    <button
      data-testid="trigger-agent-guardrails"
      onClick={() => {
        p.onGuardrailsChange({ maxSteps: 10, maxTokens: 2000, timeoutMs: 5000, allowedTools: [] });
      }}
    />
  ),
}));
vi.mock("@/components/shared/markdown-tab-editor", () => ({
  MarkdownTabEditor: ({ value, onChange, placeholder }: any) => (
    <textarea
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
    />
  ),
}));
vi.mock("@/actions/agents/create-agent", () => ({
  createAgent: mockCreateAgent,
}));
vi.mock("@/actions/knowledgebases/list-knowledgebases", () => ({
  listKnowledgebases: vi.fn(async () => ({ ok: true, value: [] })),
}));
vi.mock("@/hooks/use-resource-hydration", () => ({
  useResourceHydration: vi.fn(() => ({ isLoading: false })),
}));
vi.mock("@/hooks/use-user-models", () => ({
  useUserModels: vi.fn(() => ({ models: [], isLoading: false })),
}));
vi.mock("@/lib/store/use-app-store", () => ({
  useAppStore: vi.fn((selector: any) =>
    selector({
      agents: [],
      mcpServers: [],
      skills: [],
      prompts: [],
      loadAgents: mockLoadAgents,
    }),
  ),
}));

describe("NewAgentPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates a new agent and navigates to its detail page", async () => {
    const { default: userEvent } = await import("@testing-library/user-event");
    const user = userEvent.setup();
    mockCreateAgent.mockResolvedValueOnce({
      ok: true,
      value: { id: "new-agent-1" },
    });

    render(<NewAgentPage />);

    const nameInput = screen.getByPlaceholderText("Agent name");
    fireEvent.change(nameInput, { target: { value: "Code Reviewer" } });

    fireEvent.click(
      screen.getAllByRole("button", { name: /create agent/i })[0],
    );

    await waitFor(() => {
      expect(mockCreateAgent).toHaveBeenCalledWith(
        expect.objectContaining({ name: "Code Reviewer" }),
      );
      expect(mockLoadAgents).toHaveBeenCalled();
      expect(mockPush).toHaveBeenCalledWith("/agents/new-agent-1");
    });
  });

  it("disables create button when name is empty", () => {
    render(<NewAgentPage />);
    const createBtn = screen.getAllByRole("button", { name: /create agent/i })[0];
    expect(createBtn).toBeDisabled();
    expect(mockCreateAgent).not.toHaveBeenCalled();
  });

  it("handles createAgent failure and thrown errors", async () => {
    mockCreateAgent.mockResolvedValueOnce({
      ok: false,
      error: { message: "Custom error" },
    });

    render(<NewAgentPage />);
    fireEvent.change(screen.getByPlaceholderText("Agent name"), {
      target: { value: "Agent X" },
    });

    fireEvent.click(
      screen.getAllByRole("button", { name: /create agent/i })[0],
    );

    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith("Custom error");
    });

    mockCreateAgent.mockResolvedValueOnce({
      ok: false,
      error: { message: "" },
    });
    fireEvent.click(
      screen.getAllByRole("button", { name: /create agent/i })[0],
    );
    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith("Failed to create agent");
    });

    mockCreateAgent.mockRejectedValueOnce(new Error("network"));
    fireEvent.click(
      screen.getAllByRole("button", { name: /create agent/i })[0],
    );
    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith("Failed to create agent");
    });
  });

  it("shows error toast and switches to settings tab when name is empty on create", async () => {
    const user = (await import("@testing-library/user-event")).default.setup();
    render(<NewAgentPage />);
    await user.click(screen.getByRole("tab", { name: /prompt/i }));
    // Trigger onSave from prompt tab
    const promptSaveBtn = screen.getAllByRole("button", { name: /create agent/i }).at(-1)!;
    fireEvent.click(promptSaveBtn);
    expect(mockToastError).toHaveBeenCalledWith("Agent name is required");
  });

  it("renders skeleton when hydrating with no agents, and renders page when hydrating with existing agents", () => {
    vi.mocked(useResourceHydration).mockReturnValueOnce({ isLoading: true } as any);
    const { unmount } = render(<NewAgentPage />);
    expect(screen.queryByText("New Agent")).not.toBeInTheDocument();
    unmount();

    vi.mocked(useResourceHydration).mockReturnValueOnce({ isLoading: true } as any);
    vi.mocked(useAppStore).mockImplementationOnce((selector: any) =>
      selector({
        agents: [{ id: "a1", name: "Existing" }],
        mcpServers: [],
        skills: [],
        prompts: [],
        loadAgents: mockLoadAgents,
      }),
    );
    render(<NewAgentPage />);
    expect(screen.getByPlaceholderText("Agent name")).toBeInTheDocument();
  });

  it("covers all tab callbacks including toggle add/remove and modelId reasoningEffort", async () => {
    const user = (await import("@testing-library/user-event")).default.setup();
    mockCreateAgent.mockResolvedValueOnce({ ok: true, value: { id: "a-new" } });
    render(<NewAgentPage />);

    const testIds = [
      "trigger-agent-settings",
      "trigger-agent-prompt",
      "trigger-agent-tools",
      "trigger-agent-kb",
      "trigger-agent-skills",
      "trigger-agent-subagents",
      "trigger-agent-guardrails",
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

    const nameInput = screen.queryByPlaceholderText("Agent name");
    if (nameInput) {
      fireEvent.change(nameInput, { target: { value: "My Agent" } });
    }
    const createBtn = screen.queryAllByRole("button", { name: /create agent/i })[0];
    if (createBtn) {
      fireEvent.click(createBtn);
    }
  });
});
