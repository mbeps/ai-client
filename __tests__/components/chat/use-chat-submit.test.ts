import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useChatSubmit } from "@/components/chat/input/use-chat-submit";
import type { Attachment } from "@/types/attachment/attachment";

function createAttachment(id = "att-1"): Attachment {
  return {
    id,
    type: "document",
    name: "notes.txt",
    mimeType: "text/plain",
    sizeBytes: 12,
    dataUrl: "data:text/plain;base64,aGVsbG8=",
  };
}

function createOptions(overrides: Partial<Parameters<typeof useChatSubmit>[0]> = {}) {
  return {
    onSend: vi.fn(),
    isLoading: false,
    isSendDisabled: false,
    supportsTools: true,
    selectedTools: new Set(["internal:tool:manage_artifact"]),
    selectedServerIds: new Set(["srv-1"]),
    promptList: [{ id: "prompt-1", title: "Summarize" } as any],
    input: "Hello world",
    setInput: vi.fn(),
    attachments: [createAttachment()],
    clearAttachments: vi.fn(),
    handleClearPrompts: vi.fn(),
    setSelectedAssistant: vi.fn(),
    clearSelectedSkills: vi.fn(),
    modelId: "gpt-4o",
    selectedAssistant: { id: "agent-1" },
    selectedKbs: new Set(["kb-1"]),
    selectedSkills: new Set(["skill-1"]),
    subagentsEnabled: true,
    subagentModelId: "sub-model",
    selectedSubagentIds: ["sub-1"],
    reasoningEffort: "medium" as const,
    approvalMode: "ask" as const,
    handleCommandKeyDown: vi.fn(() => false),
    ...overrides,
  };
}

describe("useChatSubmit", () => {
  it("clears composer state after onSend resolves successfully", async () => {
    let resolveSend!: (value: boolean) => void;
    const onSend = vi.fn(
      () =>
        new Promise<boolean>((resolve) => {
          resolveSend = resolve;
        }),
    );
    const opts = createOptions({ onSend });
    const { result } = renderHook(() => useChatSubmit(opts));

    let sendPromise!: Promise<void>;
    act(() => {
      sendPromise = result.current.handleSend();
    });

    expect(onSend).toHaveBeenCalledTimes(1);
    expect(opts.setInput).not.toHaveBeenCalled();
    expect(opts.clearAttachments).not.toHaveBeenCalled();
    expect(opts.handleClearPrompts).not.toHaveBeenCalled();
    expect(opts.setSelectedAssistant).not.toHaveBeenCalled();
    expect(opts.clearSelectedSkills).not.toHaveBeenCalled();

    await act(async () => {
      resolveSend(true);
      await sendPromise;
    });

    expect(opts.setInput).toHaveBeenCalledWith("");
    expect(opts.clearAttachments).toHaveBeenCalledTimes(1);
    expect(opts.handleClearPrompts).toHaveBeenCalledTimes(1);
    expect(opts.setSelectedAssistant).toHaveBeenCalledWith(null);
    expect(opts.clearSelectedSkills).toHaveBeenCalledTimes(1);
  });

  it("clears composer state when sync void onSend returns undefined", async () => {
    const opts = createOptions({ onSend: vi.fn() });
    const { result } = renderHook(() => useChatSubmit(opts));

    await act(async () => {
      await result.current.handleSend();
    });

    expect(opts.setInput).toHaveBeenCalledWith("");
    expect(opts.clearAttachments).toHaveBeenCalledTimes(1);
    expect(opts.handleClearPrompts).toHaveBeenCalledTimes(1);
    expect(opts.setSelectedAssistant).toHaveBeenCalledWith(null);
    expect(opts.clearSelectedSkills).toHaveBeenCalledTimes(1);
  });

  it("preserves input, attachments, prompts, assistant, and skills when onSend returns false", async () => {
    const onSend = vi.fn().mockResolvedValue(false);
    const opts = createOptions({ onSend });
    const { result } = renderHook(() => useChatSubmit(opts));

    await act(async () => {
      await result.current.handleSend();
    });

    expect(onSend).toHaveBeenCalledTimes(1);
    expect(opts.setInput).not.toHaveBeenCalled();
    expect(opts.clearAttachments).not.toHaveBeenCalled();
    expect(opts.handleClearPrompts).not.toHaveBeenCalled();
    expect(opts.setSelectedAssistant).not.toHaveBeenCalled();
    expect(opts.clearSelectedSkills).not.toHaveBeenCalled();
  });

  it("preserves composer state when onSend rejects and allows retry after failure", async () => {
    const onSend = vi
      .fn()
      .mockRejectedValueOnce(new Error("Launch failed"))
      .mockResolvedValueOnce(true);
    const opts = createOptions({ onSend });
    const { result } = renderHook(() => useChatSubmit(opts));

    await act(async () => {
      await result.current.handleSend();
    });

    expect(opts.setInput).not.toHaveBeenCalled();
    expect(opts.clearAttachments).not.toHaveBeenCalled();
    expect(opts.handleClearPrompts).not.toHaveBeenCalled();
    expect(opts.setSelectedAssistant).not.toHaveBeenCalled();
    expect(opts.clearSelectedSkills).not.toHaveBeenCalled();

    await act(async () => {
      await result.current.handleSend();
    });

    expect(onSend).toHaveBeenCalledTimes(2);
    expect(opts.setInput).toHaveBeenCalledWith("");
    expect(opts.clearAttachments).toHaveBeenCalledTimes(1);
  });

  it("blocks duplicate submissions while an async onSend is in-flight and when disabled", async () => {
    let resolveSend!: (value: boolean) => void;
    const onSend = vi.fn(
      () =>
        new Promise<boolean>((resolve) => {
          resolveSend = resolve;
        }),
    );
    const opts = createOptions({ onSend });
    const { result } = renderHook(() => useChatSubmit(opts));

    let first!: Promise<void>;
    let second!: Promise<void>;
    act(() => {
      first = result.current.handleSend();
      second = result.current.handleSend();
    });

    expect(onSend).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolveSend(true);
      await Promise.all([first, second]);
    });

    const disabledOpts = createOptions({ isSendDisabled: true });
    const { result: disabledRes } = renderHook(() => useChatSubmit(disabledOpts));
    await act(async () => {
      await disabledRes.current.handleSend();
    });
    expect(disabledOpts.onSend).not.toHaveBeenCalled();

    const loadingOpts = createOptions({ isLoading: true });
    const { result: loadingRes } = renderHook(() => useChatSubmit(loadingOpts));
    await act(async () => {
      await loadingRes.current.handleSend();
    });
    expect(loadingOpts.onSend).not.toHaveBeenCalled();
  });

  it("omits tools and serverIds when supportsTools is false", async () => {
    const opts = createOptions({ supportsTools: false });
    const { result } = renderHook(() => useChatSubmit(opts));

    await act(async () => {
      await result.current.handleSend();
    });

    expect(opts.onSend).toHaveBeenCalledWith(
      "Hello world",
      opts.attachments,
      "gpt-4o",
      [],
      [],
      ["prompt-1"],
      "agent-1",
      ["kb-1"],
      ["skill-1"],
      true,
      "sub-model",
      "medium",
      ["sub-1"],
      "ask",
    );
  });

  it("handles Enter key submission, Shift+Enter newline, and command key delegation", async () => {
    const opts = createOptions();
    const { result } = renderHook(() => useChatSubmit(opts));

    const preventDefault = vi.fn();
    await act(async () => {
      result.current.handleKeyDown({
        key: "Enter",
        shiftKey: false,
        preventDefault,
      } as unknown as React.KeyboardEvent);
    });
    expect(preventDefault).toHaveBeenCalledTimes(1);
    expect(opts.onSend).toHaveBeenCalledTimes(1);

    const preventShift = vi.fn();
    act(() => {
      result.current.handleKeyDown({
        key: "Enter",
        shiftKey: true,
        preventDefault: preventShift,
      } as unknown as React.KeyboardEvent);
    });
    expect(preventShift).not.toHaveBeenCalled();
    expect(opts.onSend).toHaveBeenCalledTimes(1);

    const commandOpts = createOptions({
      handleCommandKeyDown: vi.fn(() => true),
    });
    const { result: cmdResult } = renderHook(() => useChatSubmit(commandOpts));
    const preventCmd = vi.fn();
    act(() => {
      cmdResult.current.handleKeyDown({
        key: "Enter",
        shiftKey: false,
        preventDefault: preventCmd,
      } as unknown as React.KeyboardEvent);
    });
    expect(preventCmd).not.toHaveBeenCalled();
    expect(commandOpts.onSend).not.toHaveBeenCalled();
  });
});
