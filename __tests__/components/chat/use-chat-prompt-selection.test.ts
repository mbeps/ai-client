import { act, renderHook } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it } from "vitest";
import { useChatPromptSelection } from "@/components/chat/input/use-chat-prompt-selection";
import type { MentionPromptItem } from "@/hooks/chat/use-mention-commands";

const mockPrompt1: MentionPromptItem = {
  id: "p1",
  title: "Prompt 1",
  shortcut: "p1",
  content: "Content 1",
  isMcp: false,
  isSkill: false,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const mockPrompt2: MentionPromptItem = {
  id: "p2",
  title: "Prompt 2",
  shortcut: "p2",
  content: "Content 2",
  isMcp: false,
  isSkill: false,
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe("useChatPromptSelection", () => {
  it("initializes with empty set when selectedPrompts is undefined", () => {
    const { result } = renderHook(() =>
      useChatPromptSelection(undefined, undefined),
    );

    expect(result.current.promptList).toEqual([]);
    expect(result.current.selectedPromptIds.size).toBe(0);
  });

  it("toggles prompts in and out of selection", () => {
    const { result } = renderHook(() => {
      const [prompts, setPrompts] = useState<MentionPromptItem[]>([]);
      return useChatPromptSelection(prompts, setPrompts);
    });

    expect(result.current.selectedPromptIds.size).toBe(0);

    act(() => {
      result.current.handleTogglePrompt(mockPrompt1);
    });

    expect(result.current.selectedPromptIds.has("p1")).toBe(true);

    act(() => {
      result.current.handleTogglePrompt(mockPrompt2);
    });

    expect(result.current.selectedPromptIds.has("p1")).toBe(true);
    expect(result.current.selectedPromptIds.has("p2")).toBe(true);

    act(() => {
      result.current.handleTogglePrompt(mockPrompt1);
    });

    expect(result.current.selectedPromptIds.has("p1")).toBe(false);
    expect(result.current.selectedPromptIds.has("p2")).toBe(true);
  });

  it("removes a prompt by id", () => {
    const { result } = renderHook(() => {
      const [prompts, setPrompts] = useState<MentionPromptItem[]>([
        mockPrompt1,
        mockPrompt2,
      ]);
      return useChatPromptSelection(prompts, setPrompts);
    });

    expect(result.current.selectedPromptIds.size).toBe(2);

    act(() => {
      result.current.handleRemovePrompt("p1");
    });

    expect(result.current.selectedPromptIds.has("p1")).toBe(false);
    expect(result.current.selectedPromptIds.has("p2")).toBe(true);
  });

  it("clears all prompts", () => {
    const { result } = renderHook(() => {
      const [prompts, setPrompts] = useState<MentionPromptItem[]>([
        mockPrompt1,
        mockPrompt2,
      ]);
      return useChatPromptSelection(prompts, setPrompts);
    });

    expect(result.current.selectedPromptIds.size).toBe(2);

    act(() => {
      result.current.handleClearPrompts();
    });

    expect(result.current.selectedPromptIds.size).toBe(0);
    expect(result.current.promptList).toEqual([]);
  });
});

