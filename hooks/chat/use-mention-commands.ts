"use client";

import { useAppStore } from "@/lib/store";
import type { Prompt } from "@/types/prompt/prompt";
import type { Assistant } from "@/types/assistant/assistant";
import type { DiscoveredPrompt } from "@/types/mcp/discovered-prompt";
import { useCallback, useMemo, useState, type RefObject } from "react";

export type MentionTrigger = "/" | "@" | null;

export type MentionPromptItem =
  | (Prompt & { isMcp: false })
  | (DiscoveredPrompt & {
      id: string;
      title: string;
      shortcut: string;
      sourceServer: string;
      isMcp: true;
    });

export type MentionAssistantItem = Assistant & { isMcp: false };

export type MentionItem = MentionPromptItem | MentionAssistantItem;

/**
 * Type guard for MentionPromptItem
 */
function isPromptItem(item: MentionItem): item is MentionPromptItem {
  return "shortcut" in item;
}

/**
 * Type guard for MentionAssistantItem
 */
function isAssistantItem(item: MentionItem): item is MentionAssistantItem {
  return !("shortcut" in item);
}

/**
 * Manages mention/slash-command UI state and filtering for chat input.
 * Supports two triggers: '/' for prompts (local + MCP) and '@' for assistants.
 * Filters items by query, handles keyboard navigation (arrow keys, enter, escape).
 * Tracks cursor position and selected items; inserts mention into input on selection.
 * Supports pre-selection of prompt/assistant for initial state (e.g. edit flows).
 *
 * Side effects: Updates input textarea, modifies text at cursor position, manages keyboard listeners.
 * Use case: Chat input mention autocomplete; MCP prompt + assistant discovery and selection.
 * Constraint: Requires ref to textarea element for cursor tracking; selected items are read-only (selection via keyboard only).
 *
 * @param input - Current input text value.
 * @param setInput - Callback to update input text.
 * @param textareaRef - Ref to textarea element for cursor tracking and insertion.
 * @param activeChatAssistantId - Optional ID of chat's associated assistant (disables '@' mention for that assistant).
 * @param initialSelectedPromptId - Optional prompt ID to pre-select (for edit flows).
 * @param initialSelectedAssistantId - Optional assistant ID to pre-select (for edit flows).
 * @param canMentionAssistant - Whether '@' mention should be enabled (default: true).
 * @param selectedServerIds - Optional set of enabled MCP server IDs to filter MCP prompts.
 * @returns Object with open trigger state, filtered items, selection index, handlers (handleInputChange, handleSelectItem, etc.).
 * @throws No exceptions thrown; all state changes are safe.
 * @see useMentionCommands for type definitions and usage patterns.
 * @author Maruf Bepary
 */
export function useMentionCommands(
  input: string,
  setInput: (value: string) => void,
  textareaRef: RefObject<HTMLTextAreaElement | null>,
  activeChatAssistantId?: string | null,
  initialSelectedPromptId?: string,
  initialSelectedAssistantId?: string,
  canMentionAssistant: boolean = true,
  selectedServerIds?: Set<string>,
) {
  const prompts = useAppStore((state) => state.prompts);
  const assistants = useAppStore((state) => state.assistants);
  const mcpPrompts = useAppStore((state) => state.mcpPrompts);

  const [openTrigger, setOpenTrigger] = useState<MentionTrigger>(null);
  const [commandQuery, setCommandQuery] = useState("");
  const [cursorPosition, setCursorPosition] = useState(0);
  const [selectedIndex, setSelectedIndex] = useState(0);

  const [selectedPrompt, setSelectedPrompt] =
    useState<MentionPromptItem | null>(() => {
      if (!initialSelectedPromptId) return null;
      const local = prompts.find((p) => p.id === initialSelectedPromptId);
      if (local) return { ...local, isMcp: false };

      const mcp = mcpPrompts.find(
        (p) => `mcp:${p.serverId}:${p.name}` === initialSelectedPromptId,
      );
      if (mcp) {
        return {
          ...mcp,
          id: `mcp:${mcp.serverId}:${mcp.name}`,
          title: mcp.name,
          shortcut: mcp.name,
          sourceServer: mcp.serverName,
          isMcp: true,
        };
      }
      return null;
    });

  const [selectedAssistant, setSelectedAssistant] = useState<Assistant | null>(
    initialSelectedAssistantId
      ? assistants.find((a) => a.id === initialSelectedAssistantId) || null
      : null,
  );

  const filteredItems = useMemo(() => {
    if (!openTrigger) return [];
    const q = commandQuery.toLowerCase();

    if (openTrigger === "/") {
      const local = prompts
        .filter(
          (p) =>
            p.shortcut.toLowerCase().includes(q) ||
            p.title.toLowerCase().includes(q),
        )
        .map((p): MentionPromptItem => ({ ...p, isMcp: false }));

      const mcp = mcpPrompts
        .filter((p) => {
          // Filter by enabled servers if provided
          if (selectedServerIds && !selectedServerIds.has(p.serverId)) {
            return false;
          }

          return (
            p.name.toLowerCase().includes(q) ||
            p.serverName.toLowerCase().includes(q) ||
            (p.description && p.description.toLowerCase().includes(q))
          );
        })
        .map(
          (p): MentionPromptItem => ({
            ...p,
            id: `mcp:${p.serverId}:${p.name}`,
            title: p.name,
            shortcut: p.name,
            sourceServer: p.serverName,
            isMcp: true,
          }),
        );

      return [...local, ...mcp];
    }

    if (openTrigger === "@") {
      return assistants
        .filter(
          (a) =>
            a.name.toLowerCase().includes(q) ||
            (a.description && a.description.toLowerCase().includes(q)),
        )
        .map((a): MentionAssistantItem => ({ ...a, isMcp: false }));
    }

    return [];
  }, [
    commandQuery,
    prompts,
    mcpPrompts,
    assistants,
    openTrigger,
    selectedServerIds,
  ]);

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
    (item: MentionItem) => {
      if (!openTrigger) return;

      const textBeforeCursor = input.slice(0, cursorPosition);
      const triggerIndex = textBeforeCursor.lastIndexOf(openTrigger);

      if (triggerIndex !== -1) {
        const newInput =
          input.slice(0, triggerIndex) + input.slice(cursorPosition);

        setInput(newInput);

        if (openTrigger === "/") {
          if (isPromptItem(item)) {
            setSelectedPrompt(item);
          }
        } else if (openTrigger === "@") {
          if (isAssistantItem(item)) {
            setSelectedAssistant(item);
          }
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
