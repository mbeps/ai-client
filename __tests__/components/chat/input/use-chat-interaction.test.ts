import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { createRef, type ChangeEvent } from "react";
import { useChatInteraction } from "@/components/chat/input/use-chat-interaction";
import { toast } from "sonner";

vi.mock("sonner", () => ({
  toast: {
    info: vi.fn(),
    error: vi.fn(),
  },
}));

describe("useChatInteraction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("computes skill tokens, handles compact actions, callbacks, and clears restored assistant", async () => {
    const handleApiError = vi.fn();
    const onCompact = vi.fn();
    const setInput = vi.fn();
    const textareaRef = createRef<HTMLTextAreaElement>();

    const { result, rerender } = renderHook(
      ({ isLoading, hasNoModels, thread }: { isLoading: boolean; hasNoModels: boolean; thread: any[] }) =>
        useChatInteraction({
          props: {
            onSend: vi.fn(),
            isLoading,
            onCompact,
            thread,
            initialSelectedAssistantId: "asst-1",
            initialSelectedSkillIds: ["sk-selected"],
          },
          services: {
            supportsVision: false,
            supportsTools: true,
            hasNoModels,
            modelId: "gpt-4o",
            skills: [
              { id: "sk-selected", enabled: true, content: "hello", files: [{ path: "a.md", content: "world" }] },
              { id: "sk-unselected", enabled: true, content: "ignored" },
              { id: "sk-disabled", enabled: false, content: "disabled" },
            ],
            knowledgebases: [],
            handleApiError,
          } as any,
          input: "/",
          setInput,
          textareaRef,
          canMentionAssistant: true,
          thread,
        }),
      {
        initialProps: {
          isLoading: true,
          hasNoModels: true,
          thread: [] as any[],
        },
      },
    );

    expect(result.current.selectedSkillTokens).toBeGreaterThan(0);
    expect(result.current.availableSkillCount).toBe(2);

    // Callbacks
    act(() => {
      result.current.handleRemoveAssistant();
      result.current.handleOpenSubagents();
      result.current.handleCloseMentions();
    });
    expect(result.current.selections.isSubagentDialogOpen).toBe(true);

    // Trigger handleVisionUnsupported via handleFileInputChange with image when supportsVision is false
    const imgFile = new File(["img"], "photo.png", { type: "image/png" });
    await act(async () => {
      await result.current.attachments.handleFileInputChange({
        target: { files: [imgFile], value: "photo.png" },
      } as unknown as ChangeEvent<HTMLInputElement>);
    });
    expect(handleApiError).toHaveBeenCalled();

    // Open '/' trigger so mentions.handleSelect dispatches action items
    act(() => {
      result.current.mentions.handleInputChange({
        target: { value: "/", selectionStart: 1 },
      } as unknown as ChangeEvent<HTMLTextAreaElement>);
    });

    // handleSelectAction: non-compact action (no-op)
    act(() => {
      result.current.mentions.handleSelect({
        id: "other",
        name: "other",
        title: "Other",
        description: "Other",
        isAction: true,
        isMcp: false,
      });
    });

    // handleSelectAction: compact while isLoading === true
    act(() => {
      result.current.mentions.handleSelect({
        id: "action:compact",
        name: "compact",
        title: "Compact",
        description: "Compact",
        isAction: true,
        isMcp: false,
      });
    });
    expect(toast.info).toHaveBeenCalledWith(
      "Wait for the current response to finish before compacting",
    );

    // Rerender with isLoading: false, thread: [] (< 2 messages)
    rerender({ isLoading: false, hasNoModels: false, thread: [] });
    act(() => {
      result.current.mentions.handleSelect({
        id: "action:compact",
        name: "compact",
        title: "Compact",
        description: "Compact",
        isAction: true,
        isMcp: false,
      });
    });
    expect(toast.info).toHaveBeenCalledWith("Need at least 2 messages to compact");

    // Rerender with isLoading: false, thread with 2 messages -> canCompact === true
    rerender({
      isLoading: false,
      hasNoModels: false,
      thread: [{ id: "1", role: "user" }, { id: "2", role: "assistant" }],
    });
    act(() => {
      result.current.mentions.handleSelect({
        id: "action:compact",
        name: "compact",
        title: "Compact",
        description: "Compact",
        isAction: true,
        isMcp: false,
      });
    });
    expect(onCompact).toHaveBeenCalledWith("gpt-4o");
  });
});
