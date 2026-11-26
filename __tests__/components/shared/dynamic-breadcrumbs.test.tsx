import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DynamicBreadcrumbs } from "@/components/shared/dynamic-breadcrumbs";

const mockUsePathname = vi.hoisted(() => vi.fn());
const mockGetWorkflowRun = vi.hoisted(() => vi.fn());
const mockGetWorkflow = vi.hoisted(() => vi.fn());
const mockGetKnowledgebase = vi.hoisted(() => vi.fn());
const mockGetProviderById = vi.hoisted(() => vi.fn());
const mockGetSkill = vi.hoisted(() => vi.fn());
const mockLogger = vi.hoisted(() => ({ error: vi.fn() }));

vi.mock("next/navigation", () => ({
  usePathname: mockUsePathname,
  unstable_rethrow: vi.fn(),
}));

vi.mock("next/link", () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

vi.mock("@/lib/logger", () => ({
  logger: mockLogger,
  getLogger: vi.fn(() => mockLogger),
}));

vi.mock("@/actions/workflow-runs/get-workflow-run", () => ({
  getWorkflowRun: mockGetWorkflowRun,
}));

vi.mock("@/actions/workflows/get-workflow", () => ({
  getWorkflow: mockGetWorkflow,
}));

vi.mock("@/actions/knowledgebases/get-knowledgebase", () => ({
  getKnowledgebase: mockGetKnowledgebase,
}));

vi.mock("@/actions/providers/list-providers", () => ({
  listProviders: mockGetProviderById,
}));

vi.mock("@/actions/skills/get-skill", () => ({
  getSkill: mockGetSkill,
}));

vi.mock("@/lib/store/use-app-store", () => ({
  useAppStore: (selector: (s: unknown) => unknown) =>
    selector({
      chats: { "c-1": { id: "c-1", title: "My Chat" } },
      projects: [{ id: "p-1", name: "My Project" }],
      agents: [{ id: "a-1", name: "My Agent" }],
      prompts: [],
      loadPrompts: vi.fn(async () => {}),
      skills: [],
      loadSkills: vi.fn(async () => {}),
      mcpServers: [],
      loadMcpServers: vi.fn(async () => {}),
      publicMcpServers: [],
      loadPublicMcpServers: vi.fn(async () => {}),
      workflows: [],
      loadWorkflows: vi.fn(async () => {}),
    }),
}));

const UUID_1 = "11111111-1111-1111-1111-111111111111";
const UUID_2 = "22222222-2222-2222-2222-222222222222";

describe("DynamicBreadcrumbs", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns null on root path", () => {
    mockUsePathname.mockReturnValue("/");
    const { container } = render(<DynamicBreadcrumbs />);
    expect(container.firstChild).toBeNull();
  });

  it("resolves workflow and workflow run labels", async () => {
    mockGetWorkflow.mockResolvedValue({ ok: true, value: { name: "Daily Sync" } });
    mockGetWorkflowRun.mockResolvedValue({
      ok: true,
      value: { createdAt: "2026-01-01T10:00:00Z" },
    });

    mockUsePathname.mockReturnValue(`/workflows/${UUID_1}/${UUID_2}`);
    render(<DynamicBreadcrumbs />);

    await waitFor(() => {
      expect(screen.getByText("Daily Sync")).toBeInTheDocument();
    });
  });

  it("resolves knowledgebase, skill, and provider labels and handles errors", async () => {
    mockGetKnowledgebase.mockResolvedValue({ ok: true, value: { name: "KB One" } });
    mockUsePathname.mockReturnValue(`/knowledgebases/${UUID_1}`);
    const { rerender } = render(<DynamicBreadcrumbs />);
    await waitFor(() => expect(screen.getByText("KB One")).toBeInTheDocument());

    mockGetSkill.mockResolvedValue({
      ok: true,
      value: { displayName: "Skill Display", name: "skill-slug" },
    });
    mockUsePathname.mockReturnValue(`/skills/${UUID_2}`);
    rerender(<DynamicBreadcrumbs />);
    await waitFor(() => expect(screen.getByText("Skill Display")).toBeInTheDocument());

    mockGetWorkflow.mockRejectedValueOnce(new Error("boom"));
    mockUsePathname.mockReturnValue("/workflows/33333333-3333-3333-3333-333333333333");
    rerender(<DynamicBreadcrumbs />);
    await waitFor(() => expect(mockLogger.error).toHaveBeenCalled());
  });

  it("resolves /chats/[id], chat parent labels, and handles resolver errors/not-found", async () => {
    mockGetWorkflowRun.mockRejectedValueOnce(new Error("run err"));
    mockGetKnowledgebase.mockRejectedValueOnce(new Error("kb err"));
    mockGetSkill.mockRejectedValueOnce(new Error("skill err"));
    mockGetProviderById.mockRejectedValueOnce(new Error("prov err"));

    mockUsePathname.mockReturnValue(`/chats/${UUID_1}`);
    const { rerender } = render(<DynamicBreadcrumbs />);
    expect(screen.getByText("Chats")).toBeInTheDocument();

    mockUsePathname.mockReturnValue(`/workflows/${UUID_1}/44444444-4444-4444-4444-444444444444`);
    rerender(<DynamicBreadcrumbs />);
    await waitFor(() => expect(mockLogger.error).toHaveBeenCalled());

    mockUsePathname.mockReturnValue(`/knowledgebases/55555555-5555-5555-5555-555555555555`);
    rerender(<DynamicBreadcrumbs />);
    await waitFor(() => expect(mockLogger.error).toHaveBeenCalled());

    mockUsePathname.mockReturnValue(`/skills/66666666-6666-6666-6666-666666666666`);
    rerender(<DynamicBreadcrumbs />);
    await waitFor(() => expect(mockLogger.error).toHaveBeenCalled());

    mockUsePathname.mockReturnValue(`/settings/providers/77777777-7777-7777-7777-777777777777`);
    rerender(<DynamicBreadcrumbs />);
    await waitFor(() => expect(mockLogger.error).toHaveBeenCalled());
  });

  it("covers store entity labels (prompts, skills fallback, mcpServers, workflows), chat parents, automations fallback, and loader rejections", async () => {
    const storeMod = await import("@/lib/store/use-app-store");
    const rejectingLoader = vi.fn().mockRejectedValue(new Error("load fail"));
    const makeStore = (overrides: Record<string, unknown>) =>
      (selector: (s: unknown) => unknown) =>
        selector({
          chats: {},
          projects: [],
          agents: [],
          prompts: [],
          skills: [],
          mcpServers: [],
          publicMcpServers: [],
          workflows: [],
          currentChatData: null,
          loadProjects: rejectingLoader,
          loadAgents: rejectingLoader,
          loadPrompts: rejectingLoader,
          loadSkills: rejectingLoader,
          loadMcpServers: rejectingLoader,
          loadPublicMcpServers: rejectingLoader,
          loadWorkflows: rejectingLoader,
          ...overrides,
        });

    const spy = vi
      .spyOn(storeMod, "useAppStore")
      .mockImplementation(makeStore({}) as never);

    mockGetSkill.mockResolvedValueOnce({
      ok: true,
      value: { displayName: "", name: "skill-fallback-name" },
    });
    mockUsePathname.mockReturnValue(`/workflows/automations/${UUID_1}`);
    const { rerender } = render(<DynamicBreadcrumbs />);
    await waitFor(() => expect(rejectingLoader).toHaveBeenCalled());

    mockUsePathname.mockReturnValue(`/skills/${UUID_2}`);
    rerender(<DynamicBreadcrumbs />);
    await waitFor(() => expect(screen.getByText("skill-fallback-name")).toBeInTheDocument());

    // Now test store-backed entities and chat parent labels
    spy.mockImplementation(
      makeStore({
        projects: [{ id: UUID_1, name: "Proj 1" }],
        agents: [{ id: UUID_2, name: "Agent 2" }],
        prompts: [{ id: "33333333-3333-3333-3333-333333333333", title: "Prompt 3" }],
        skills: [{ id: "44444444-4444-4444-4444-444444444444", displayName: "", name: "Skill 4" }],
        mcpServers: [{ id: "55555555-5555-5555-5555-555555555555", name: "MCP 5" }],
        publicMcpServers: [{ id: "pub-1", name: "Pub" }],
        workflows: [{ id: "66666666-6666-6666-6666-666666666666", name: "WF 6" }],
        chats: {
          [UUID_1]: {
            projectId: UUID_1,
            projectName: "Chat Project",
          },
          [UUID_2]: {
            agentId: UUID_2,
            agentName: "Chat Agent",
          },
          "33333333-3333-3333-3333-333333333333": {
            assistantId: "33333333-3333-3333-3333-333333333333",
            assistantName: "Chat Assistant",
          },
        },
        loadProjects: vi.fn().mockResolvedValue(undefined),
        loadAgents: vi.fn().mockResolvedValue(undefined),
        loadPrompts: vi.fn().mockResolvedValue(undefined),
        loadSkills: vi.fn().mockResolvedValue(undefined),
        loadMcpServers: vi.fn().mockResolvedValue(undefined),
        loadPublicMcpServers: vi.fn().mockResolvedValue(undefined),
        loadWorkflows: vi.fn().mockResolvedValue(undefined),
      }) as never,
    );

    mockUsePathname.mockReturnValue(
      `/prompts/33333333-3333-3333-3333-333333333333/44444444-4444-4444-4444-444444444444/55555555-5555-5555-5555-555555555555/66666666-6666-6666-6666-666666666666`,
    );
    rerender(<DynamicBreadcrumbs />);
    expect(screen.getByText("Prompt 3")).toBeInTheDocument();
    expect(screen.getByText("Skill 4")).toBeInTheDocument();
    expect(screen.getByText("MCP 5")).toBeInTheDocument();
    expect(screen.getByText("WF 6")).toBeInTheDocument();

    mockUsePathname.mockReturnValue(`/chats/${UUID_1}`);
    rerender(<DynamicBreadcrumbs />);
    expect(screen.getByText("Chat Project")).toBeInTheDocument();

    mockUsePathname.mockReturnValue(`/chats/${UUID_2}`);
    rerender(<DynamicBreadcrumbs />);
    expect(screen.getByText("Chat Agent")).toBeInTheDocument();

    mockUsePathname.mockReturnValue(`/chats/33333333-3333-3333-3333-333333333333`);
    rerender(<DynamicBreadcrumbs />);
    expect(screen.getByText("Chat Assistant")).toBeInTheDocument();
  });

  it("falls back gracefully when async label resolvers return ok: false or empty", async () => {
    mockGetWorkflowRun.mockResolvedValue({ ok: false, error: "not found" });
    mockGetWorkflow.mockResolvedValue({ ok: false, error: "not found" });
    mockGetKnowledgebase.mockResolvedValue({ ok: false, error: "not found" });
    mockGetProviderById.mockResolvedValue({ ok: false, error: "not found" });
    mockGetSkill.mockResolvedValue({ ok: false, error: "not found" });

    mockUsePathname.mockReturnValue(
      `/workflows/99999999-9999-9999-9999-999999999991/runs/99999999-9999-9999-9999-999999999992/knowledgebases/99999999-9999-9999-9999-999999999993/providers/99999999-9999-9999-9999-999999999994/skills/99999999-9999-9999-9999-999999999995`,
    );
    const { rerender } = render(<DynamicBreadcrumbs />);

    await waitFor(() => {
      expect(mockGetWorkflowRun).toHaveBeenCalledWith("99999999-9999-9999-9999-999999999992");
      expect(mockGetWorkflow).toHaveBeenCalledWith("99999999-9999-9999-9999-999999999991");
      expect(mockGetKnowledgebase).toHaveBeenCalledWith("99999999-9999-9999-9999-999999999993");
      expect(mockGetProviderById).toHaveBeenCalled();
      expect(mockGetSkill).toHaveBeenCalledWith("99999999-9999-9999-9999-999999999995");
    });

    // Also test listProviders returning ok: true with no matching provider
    mockGetProviderById.mockResolvedValue({ ok: true, value: [] });
    mockUsePathname.mockReturnValue(`/settings/models/providers/99999999-9999-9999-9999-999999999996`);
    rerender(<DynamicBreadcrumbs />);
    await waitFor(() => {
      expect(mockGetProviderById).toHaveBeenCalledTimes(2);
    });
  });
});
