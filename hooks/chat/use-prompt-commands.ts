"use client";

import { useAppStore } from "@/lib/store";
import type { Prompt } from "@/types/prompt";
import { useCallback, useMemo, useState, type RefObject } from "react";

export function usePromptCommands(
  input: string,
  setInput: (value: string) => void,
  textareaRef: RefObject<HTMLTextAreaElement | null>,
) {
  const [isCommandOpen, setIsCommandOpen] = useState(false);
  const [commandQuery, setCommandQuery] = useState("");
  const [cursorPosition, setCursorPosition] = useState(0);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [selectedPrompt, setSelectedPrompt] = useState<Prompt | null>(null);

  const prompts = useAppStore((state) => state.prompts);

  const filteredPrompts = useMemo(() => {
    if (!isCommandOpen) return [];
    const q = commandQuery.toLowerCase();
    return prompts.filter(
      (p) =>
        p.shortcut.toLowerCase().includes(q) ||
        p.title.toLowerCase().includes(q),
    );
  }, [commandQuery, prompts, isCommandOpen]);

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    const pos = e.target.selectionStart ?? 0;
    setInput(value);
    setCursorPosition(pos);

    // Detect / trigger
    const textBeforeCursor = value.slice(0, pos);
    const lastSlashIndex = textBeforeCursor.lastIndexOf("/");

    if (lastSlashIndex !== -1) {
      const isStartOfLine = lastSlashIndex === 0;
      const isAfterSpace = textBeforeCursor[lastSlashIndex - 1] === " ";
      const hasNewlineAfterSlash = value
        .slice(lastSlashIndex, pos)
        .includes("\n");

      if ((isStartOfLine || isAfterSpace) && !hasNewlineAfterSlash && !selectedPrompt) {
        setIsCommandOpen(true);
        setCommandQuery(value.slice(lastSlashIndex + 1, pos));
        setSelectedIndex(0);
      } else {
        setIsCommandOpen(false);
      }
    } else {
      setIsCommandOpen(false);
    }
  }, [setInput, selectedPrompt]);

  const handlePromptSelect = useCallback((prompt: Prompt) => {
    const textBeforeCursor = input.slice(0, cursorPosition);
    const lastSlashIndex = textBeforeCursor.lastIndexOf("/");

    if (lastSlashIndex !== -1) {
      const newInput =
        input.slice(0, lastSlashIndex) + input.slice(cursorPosition);

      setInput(newInput);
      setSelectedPrompt(prompt);
      setIsCommandOpen(false);

      setTimeout(() => {
        if (textareaRef.current) {
          textareaRef.current.focus();
          textareaRef.current.setSelectionRange(lastSlashIndex, lastSlashIndex);
        }
      }, 0);
    }
  }, [input, cursorPosition, setInput, textareaRef]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (!isCommandOpen) return false;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % filteredPrompts.length);
      return true;
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex(
        (prev) => (prev - 1 + filteredPrompts.length) % filteredPrompts.length,
      );
      return true;
    }
    if (e.key === "Enter") {
      e.preventDefault();
      if (filteredPrompts[selectedIndex]) {
        handlePromptSelect(filteredPrompts[selectedIndex]);
      }
      return true;
    }
    if (e.key === "Escape") {
      e.preventDefault();
      setIsCommandOpen(false);
      return true;
    }
    return false;
  }, [isCommandOpen, filteredPrompts, selectedIndex, handlePromptSelect]);

  return {
    isCommandOpen,
    setIsCommandOpen,
    commandQuery,
    filteredPrompts,
    selectedIndex,
    setSelectedIndex,
    selectedPrompt,
    setSelectedPrompt,
    handleInputChange,
    handleKeyDown,
    handlePromptSelect,
  };
}
