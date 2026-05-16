"use client";

import { useAppStore } from "@/lib/store";
import type { Prompt } from "@/types/prompt";
import type { Assistant } from "@/types/assistant";
import { useCallback, useMemo, useState, type RefObject } from "react";

export type MentionTrigger = "/" | "@" | null;

export function useMentionCommands(
  input: string,
  setInput: (value: string) => void,
  textareaRef: RefObject<HTMLTextAreaElement | null>,
  activeChatAssistantId?: string | null,
  initialSelectedPromptId?: string,
  initialSelectedAssistantId?: string,
  canMentionAssistant: boolean = true,
) {
  const prompts = useAppStore((state) => state.prompts);
  const assistants = useAppStore((state) => state.assistants);

  const [openTrigger, setOpenTrigger] = useState<MentionTrigger>(null);
  const [commandQuery, setCommandQuery] = useState("");
  const [cursorPosition, setCursorPosition] = useState(0);
  const [selectedIndex, setSelectedIndex] = useState(0);

  const [selectedPrompt, setSelectedPrompt] = useState<Prompt | null>(
    initialSelectedPromptId
      ? prompts.find((p) => p.id === initialSelectedPromptId) || null
      : null,
  );

  const [selectedAssistant, setSelectedAssistant] = useState<Assistant | null>(
    initialSelectedAssistantId
      ? assistants.find((a) => a.id === initialSelectedAssistantId) || null
      : null,
  );

  const filteredItems = useMemo(() => {
    if (!openTrigger) return [];
    const q = commandQuery.toLowerCase();

    if (openTrigger === "/") {
      return prompts.filter(
        (p) =>
          p.shortcut.toLowerCase().includes(q) ||
          p.title.toLowerCase().includes(q),
      );
    }

    if (openTrigger === "@") {
      return assistants.filter(
        (a) =>
          a.name.toLowerCase().includes(q) ||
          (a.description && a.description.toLowerCase().includes(q)),
      );
    }

    return [];
  }, [commandQuery, prompts, assistants, openTrigger]);

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const value = e.target.value;
      const pos = e.target.selectionStart ?? 0;
      setInput(value);
      setCursorPosition(pos);

      const textBeforeCursor = value.slice(0, pos);

      const lastSlashIndex = textBeforeCursor.lastIndexOf("/");
      const lastAtIndex = textBeforeCursor.lastIndexOf("@");

      let triggerIndex = -1;
      let activeTrigger: MentionTrigger = null;

      if (lastSlashIndex > lastAtIndex && !selectedPrompt) {
        triggerIndex = lastSlashIndex;
        activeTrigger = "/";
      } else if (
        lastAtIndex > lastSlashIndex &&
        !selectedAssistant &&
        !activeChatAssistantId &&
        canMentionAssistant
      ) {
        triggerIndex = lastAtIndex;
        activeTrigger = "@";
      }

      if (triggerIndex !== -1) {
        const isStartOfLine = triggerIndex === 0;
        const isAfterSpace =
          textBeforeCursor[triggerIndex - 1] === " " ||
          textBeforeCursor[triggerIndex - 1] === "\n";
        const hasNewlineAfterTrigger = value
          .slice(triggerIndex, pos)
          .includes("\n");

        if ((isStartOfLine || isAfterSpace) && !hasNewlineAfterTrigger) {
          setOpenTrigger(activeTrigger);
          setCommandQuery(value.slice(triggerIndex + 1, pos));
          setSelectedIndex(0);
        } else {
          setOpenTrigger(null);
        }
      } else {
        setOpenTrigger(null);
      }
    },
    [
      setInput,
      selectedPrompt,
      selectedAssistant,
      activeChatAssistantId,
      canMentionAssistant,
    ],
  );

  const handleSelect = useCallback(
    (item: Prompt | Assistant) => {
      if (!openTrigger) return;

      const textBeforeCursor = input.slice(0, cursorPosition);
      const triggerIndex = textBeforeCursor.lastIndexOf(openTrigger);

      if (triggerIndex !== -1) {
        const newInput =
          input.slice(0, triggerIndex) + input.slice(cursorPosition);

        setInput(newInput);

        if (openTrigger === "/") {
          setSelectedPrompt(item as Prompt);
        } else if (openTrigger === "@") {
          setSelectedAssistant(item as Assistant);
        }

        setOpenTrigger(null);

        setTimeout(() => {
          if (textareaRef.current) {
            textareaRef.current.focus();
            textareaRef.current.setSelectionRange(triggerIndex, triggerIndex);
          }
        }, 0);
      }
    },
    [input, cursorPosition, setInput, textareaRef, openTrigger],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (!openTrigger) return false;

      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((prev) => (prev + 1) % filteredItems.length);
        return true;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex(
          (prev) => (prev - 1 + filteredItems.length) % filteredItems.length,
        );
        return true;
      }
      if (e.key === "Enter") {
        e.preventDefault();
        if (filteredItems[selectedIndex]) {
          handleSelect(filteredItems[selectedIndex]);
        }
        return true;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        setOpenTrigger(null);
        return true;
      }
      return false;
    },
    [openTrigger, filteredItems, selectedIndex, handleSelect],
  );

  return {
    openTrigger,
    setOpenTrigger,
    commandQuery,
    filteredItems,
    selectedIndex,
    setSelectedIndex,
    selectedPrompt,
    setSelectedPrompt,
    selectedAssistant,
    setSelectedAssistant,
    handleInputChange,
    handleKeyDown,
    handleSelect,
  };
}
