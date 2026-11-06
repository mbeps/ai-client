import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AgentEditorTabs } from "@/components/workflows/sheet-flow/agent-editor-tabs";
import type { McpServer } from "@/types/mcp/mcp-server";

// Mock CSS imports for jsdom
vi.mock("katex/dist/katex.min.css", () => ({}));
vi.mock("@blocknote/mantine/style.css", () => ({}));
vi.mock("@blocknote/core/fonts/inter.css", () => ({}));

vi.mock("@/components/chat/tool-picker-list", () => ({
  ToolPickerList: vi.fn(({ servers }: { servers: McpServer[] }) => (
    <div data-testid="mock-tool-picker-list">
      {servers.map((s) => (
        <span key={s.id} data-testid={`server-${s.id}`}>
          {s.name}
        </span>
      ))}
    </div>
  )),
}));

describe("AgentEditorTabs Tools Tab", () => {
  const mockServers: McpServer[] = [
    {
      id: "srv-enabled",
      userId: "u1",
      name: "Enabled Server",
      url: "https://example.com/enabled",
      isPublic: false,
      enabled: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: "srv-disabled",
      userId: "u1",
      name: "Mock Public Tools",
      url: "https://example.com/mcp",
      isPublic: false,
      enabled: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ];

  const defaultProps = {
    activeTab: "tools",
    onActiveTabChange: vi.fn(),
    isNew: false,
    agentId: "agent-1",
    steps: [],
    onAddStep: vi.fn(),
    onUpdateStep: vi.fn(),
    onRemoveStep: vi.fn(),
    globalContext: "",
    onGlobalContextChange: vi.fn(),
    knowledgebases: [],
    knowledgeBaseIds: new Set<string>(),
    onSelectKnowledgebases: vi.fn(),
    mcpServers: mockServers,
    tools: new Set<string>(),
    onToggleTool: vi.fn(),
    onBulkSelectTools: vi.fn(),
    skillMode: "disabled" as const,
    onSkillModeChange: vi.fn(),
    skillIds: new Set<string>(),
    onSelectSkills: vi.fn(),
    skills: [],
    onSave: vi.fn(),
    isSaving: false,
    runs: [],
    isLoadingRuns: false,
    name: "Test Agent",
    onNameChange: vi.fn(),
    description: "",
    onDescriptionChange: vi.fn(),
    modelId: "gpt-4o",
    onModelIdChange: vi.fn(),
    requiresFileUpload: false,
    onRequiresFileUploadChange: vi.fn(),
    onOpenDeleteDialog: vi.fn(),
    isDeleting: false,
  };

  it("only passes enabled MCP servers to ToolPickerList and excludes disabled servers", () => {
    render(<AgentEditorTabs {...defaultProps} />);

    expect(screen.getByTestId("server-srv-enabled")).toBeInTheDocument();
    expect(screen.queryByTestId("server-srv-disabled")).not.toBeInTheDocument();
  });

  it("renders tools container without border class consistent with assistants and projects", () => {
    const { container } = render(<AgentEditorTabs {...defaultProps} />);

    const toolsWrapper = container.querySelector(".max-h-\\[500px\\]");
    expect(toolsWrapper).not.toBeNull();
    expect(toolsWrapper?.classList.contains("border")).toBe(false);
  });
});
