import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import {
  PromptPicker,
  PromptPickerDialog,
} from "@/components/chat/prompt-picker";
import type { MentionPromptItem } from "@/hooks/chat/use-mention-commands";
import type { DiscoveredPrompt } from "@/types/mcp/discovered-prompt";
import type { Prompt } from "@/types/prompt/prompt";

// Mock env
vi.mock("@/lib/env", () => ({
  env: {
    DATABASE_URL: "postgresql://test:test@localhost:5432/test",
    BETTER_AUTH_SECRET: "test-secret",
    BETTER_AUTH_URL: "http://localhost:3000",
    NEXT_PUBLIC_APP_URL: "http://localhost:3000",
    S3_ENDPOINT: "http://localhost:9000",
    S3_REGION: "us-east-1",
    S3_ACCESS_KEY: "test",
    S3_SECRET_KEY: "test",
    S3_BUCKET: "test-bucket",
    POSTMARK_SERVER_TOKEN: "test-token",
    POSTMARK_FROM_EMAIL: "noreply@example.com",
    NODE_ENV: "test",
  },
}));

const mockPrompts: Prompt[] = [
  {
    id: "p1",
    title: "Summarise Text",
    shortcut: "summarise",
    content: "Summarise the following input",
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: "p2",
    title: "Fix Grammar",
    shortcut: "grammar",
    content: "Correct any grammatical errors",
    createdAt: new Date(),
    updatedAt: new Date(),
  },
];

const mockMcpPrompts: DiscoveredPrompt[] = [
  {
    name: "analyze-repo",
    description: "Analyze GitHub repository structure",
    arguments: [],
    serverId: "srv-1",
    serverName: "GitHub MCP",
  },
];

describe("PromptPicker", () => {
  it("renders both custom and MCP prompts", () => {
    render(
      <PromptPicker
        prompts={mockPrompts}
        mcpPrompts={mockMcpPrompts}
        selectedPrompt={null}
        onSelectPrompt={vi.fn()}
      />,
    );

    expect(screen.getByText("Summarise Text")).toBeDefined();
    expect(screen.getByText("/summarise")).toBeDefined();
    expect(screen.getByText("Fix Grammar")).toBeDefined();
    expect(screen.getByText("/grammar")).toBeDefined();
    expect(screen.getByText("analyze-repo")).toBeDefined();
    expect(screen.getByText("GitHub MCP")).toBeDefined();
  });

  it("filters prompts by search keyword", () => {
    render(
      <PromptPicker
        prompts={mockPrompts}
        mcpPrompts={mockMcpPrompts}
        selectedPrompt={null}
        onSelectPrompt={vi.fn()}
      />,
    );

    const searchInput = screen.getByPlaceholderText("Search prompts...");
    fireEvent.change(searchInput, { target: { value: "grammar" } });

    expect(screen.queryByText("Summarise Text")).toBeNull();
    expect(screen.getByText("Fix Grammar")).toBeDefined();
    expect(screen.queryByText("analyze-repo")).toBeNull();
  });

  it("calls onSelectPrompt when a prompt is clicked", () => {
    const handleSelect = vi.fn();
    render(
      <PromptPicker
        prompts={mockPrompts}
        mcpPrompts={mockMcpPrompts}
        selectedPrompt={null}
        onSelectPrompt={handleSelect}
      />,
    );

    fireEvent.click(screen.getByText("Summarise Text"));
    expect(handleSelect).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "p1",
        title: "Summarise Text",
        shortcut: "summarise",
        isMcp: false,
      }),
    );
  });

  it("calls onSelectPrompt(null) when selected prompt is clicked to deselect", () => {
    const handleSelect = vi.fn();
    const selected: MentionPromptItem = {
      ...mockPrompts[0],
      isMcp: false,
      isSkill: false,
    };

    render(
      <PromptPicker
        prompts={mockPrompts}
        mcpPrompts={mockMcpPrompts}
        selectedPrompt={selected}
        onSelectPrompt={handleSelect}
      />,
    );

    fireEvent.click(screen.getByText("Summarise Text"));
    expect(handleSelect).toHaveBeenCalledWith(null);
  });
});

describe("PromptPickerDialog", () => {
  it("renders empty state when there are no prompts", () => {
    render(
      <PromptPickerDialog
        prompts={[]}
        mcpPrompts={[]}
        selectedPrompt={null}
        onSelectPrompt={vi.fn()}
        trigger={<button>Open Dialog</button>}
      />,
    );

    fireEvent.click(screen.getByText("Open Dialog"));
    expect(screen.getByText("No prompts configured yet.")).toBeDefined();
    expect(screen.getByText("Create a prompt in Settings")).toBeDefined();
  });

  it("renders prompt list and selection count in dialog", () => {
    const selected: MentionPromptItem = {
      ...mockPrompts[0],
      isMcp: false,
      isSkill: false,
    };

    render(
      <PromptPickerDialog
        prompts={mockPrompts}
        mcpPrompts={mockMcpPrompts}
        selectedPrompt={selected}
        onSelectPrompt={vi.fn()}
        trigger={<button>Open Dialog</button>}
      />,
    );

    fireEvent.click(screen.getByText("Open Dialog"));
    expect(screen.getByText("Select Prompt")).toBeDefined();
    expect(screen.getByText("Summarise Text")).toBeDefined();
    expect(
      screen.getByText((_content, element) => {
        return element?.textContent === "1 prompt selected";
      }),
    ).toBeDefined();
  });
});
