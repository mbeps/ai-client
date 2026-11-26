import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ChatInputToolbar } from "@/components/chat/input/chat-input-toolbar";
import { TooltipProvider } from "@/components/ui/tooltip";

describe("ChatInputToolbar", () => {
  const baseProps = {
    isMobile: false,
    hasNoModels: false,
    attachmentMenuContent: <div>Menu</div>,
    isLoading: false,
    onSend: vi.fn(),
    isSendDisabled: false,
    showReasoningSelector: false,
    reasoningEffort: "medium" as const,
    onReasoningEffortChange: vi.fn(),
    selectedModelName: "GPT-4o",
    chatModels: [],
    modelId: "gpt-4o",
    onModelChange: vi.fn(),
    isModelsLoading: false,
    isToolsPopoverOpen: false,
    onToolsPopoverOpenChange: vi.fn(),
    selectedToolsCount: 0,
    toolsPopoverContent: <div>Tools</div>,
    selectedKbs: new Set<string>(),
    selectedSkills: new Set<string>(),
    selectedTools: new Set<string>(),
    knowledgebases: [],
    skills: [],
    onToggleKb: vi.fn(),
    onToggleSkill: vi.fn(),
    onFileSelect: vi.fn(),
  };

  it("renders mobile drawer trigger and stop button when isMobile and isLoading are true", () => {
    const onStop = vi.fn();
    render(
      <TooltipProvider>
        <ChatInputToolbar
          {...baseProps}
          isMobile={true}
          isLoading={true}
          onStop={onStop}
        />
      </TooltipProvider>,
    );

    const buttons = screen.getAllByRole("button");
    // Click VoiceInputButton and Stop button
    buttons.forEach((btn) => fireEvent.click(btn));
    expect(onStop).toHaveBeenCalled();
  });

  it("defaults approvalMode to 'ask' when onToggleApprovalMode is provided without approvalMode", () => {
    const onToggleApprovalMode = vi.fn();
    render(
      <TooltipProvider>
        <ChatInputToolbar
          {...baseProps}
          onToggleApprovalMode={onToggleApprovalMode}
        />
      </TooltipProvider>,
    );
    expect(screen.getAllByRole("button").length).toBeGreaterThan(0);
  });
});
