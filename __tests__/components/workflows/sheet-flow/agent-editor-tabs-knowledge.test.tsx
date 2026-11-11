import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AgentEditorTabs } from "@/components/workflows/sheet-flow/agent-editor-tabs";
import { ROUTES } from "@/config/routes";

vi.mock("katex/dist/katex.min.css", () => ({}));
vi.mock("@blocknote/mantine/style.css", () => ({}));
vi.mock("@blocknote/core/fonts/inter.css", () => ({}));

describe("AgentEditorTabs Knowledge Bases Tab", () => {
  const defaultProps = {
    activeTab: "knowledge",
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
    knowledgeBaseIds: new Set(["kb-existing"]),
    onSelectKnowledgebases: vi.fn(),
    mcpServers: [],
    tools: new Set<string>(),
    onToggleTool: vi.fn(),
    onBulkSelectTools: vi.fn(),
    skillMode: "dynamic" as const,
    onSkillModeChange: vi.fn(),
    skillIds: new Set<string>(),
    onSelectSkills: vi.fn(),
    skills: [],
    onSave: vi.fn(),
    isSaving: false,
    runs: [],
    isLoadingRuns: false,
    name: "Car Research",
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

  it("renders New Knowledgebase link pointing to dedicated creation page", () => {
    render(<AgentEditorTabs {...defaultProps} />);

    const newKbLink = screen.getByRole("link", { name: /new knowledgebase/i });
    expect(newKbLink).toHaveAttribute("href", ROUTES.KNOWLEDGEBASES.new);
  });
});
