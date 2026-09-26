"use client";

import { type RefObject, useCallback, useMemo, useState } from "react";
import { useAppStore } from "@/lib/store";
import type { Assistant } from "@/types/assistant/assistant";
import type { Knowledgebase } from "@/types/knowledgebase/knowledgebase";
import type { DiscoveredPrompt } from "@/types/mcp/discovered-prompt";
import type { Prompt } from "@/types/prompt/prompt";
import type { Skill } from "@/types/skill/skill";

export type MentionTrigger = "/" | "@" | "#" | null;

export type MentionPromptItem =
  | (Prompt & { isMcp: false; isSkill?: false })
  | (DiscoveredPrompt & {
      id: string;
      title: string;
      shortcut: string;
      sourceServer: string;
      isMcp: true;
      isSkill?: false;
    });

export type MentionSkillItem = Skill & {
  isSkill: true;
  isMcp: false;
};

export type MentionAssistantItem = Assistant & {
  isMcp: false;
  isSkill?: false;
};

export type MentionKnowledgebaseItem = Knowledgebase & {
  isMcp: false;
  isSkill?: false;
};

export type MentionItem =
  | MentionPromptItem
  | MentionAssistantItem
  | MentionSkillItem
  | MentionKnowledgebaseItem;

/**
 * Type guard for MentionPromptItem
 */
export function isPromptItem(item: MentionItem): item is MentionPromptItem {
  return "shortcut" in item && !("isSkill" in item && (item as any).isSkill);
}

/**
 * Type guard for MentionSkillItem
 */
export function isSkillItem(item: MentionItem): item is MentionSkillItem {
  return "isSkill" in item && (item as any).isSkill === true;
}

/**
 * Type guard for MentionAssistantItem
 */
export function isAssistantItem(
  item: MentionItem,
): item is MentionAssistantItem {
  return (
    !("shortcut" in item) &&
    !("documentCount" in item) &&
    !(item as any).isSkill
  );
}

/**
 * Type guard for MentionKnowledgebaseItem
 */
export function isKnowledgebaseItem(
  item: MentionItem,
): item is MentionKnowledgebaseItem {
  return "documentCount" in item && "indexStatus" in item;
}

/**
 * Manages mention/slash-command UI state and filtering for chat input.
 * Supports two triggers: '/' for prompts and skills, and '@' for assistants.
 * Filters items by query, handles keyboard navigation (arrow keys, enter, escape).
 *
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
  onSelectSkill?: (skill: Skill) => void,
  onSelectKnowledgebase?: (kb: Knowledgebase) => void,
  knowledgebases?: Knowledgebase[],
) {
  const prompts = useAppStore((state) => state.prompts);
  const assistants = useAppStore((state) => state.assistants);
  const skills = useAppStore((state) => state.skills);
  const mcpPrompts = useAppStore((state) => state.mcpPrompts);
  const kbs = knowledgebases ?? [];

  const [openTrigger, setOpenTrigger] = useState<MentionTrigger>(null);
  const [commandQuery, setCommandQuery] = useState("");
  const [cursorPosition, setCursorPosition] = useState(0);
  const [selectedIndex, setSelectedIndex] = useState(0);

  const [selectedPrompt, setSelectedPrompt] =
    useState<MentionPromptItem | null>(() => {
      if (!initialSelectedPromptId) return null;
      const local = prompts.find((p) => p.id === initialSelectedPromptId);
      if (local) return { ...local, isMcp: false, isSkill: false };

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
          isSkill: false,
        };
      }
      return null;
    });

  const [selectedAssistant, setSelectedAssistant] = useState<Assistant | null>(
    initialSelectedAssistantId
      ? assistants.find((a) => a.id === initialSelectedAssistantId) || null
      : null,
  );

  const [selectedKnowledgebase, setSelectedKnowledgebase] =
    useState<Knowledgebase | null>(null);

  const filteredItems = useMemo(() => {
    if (!openTrigger) return [];
    const q = commandQuery.toLowerCase();

    if (openTrigger === "/") {
      const matchingSkills = skills
        .filter(
          (s) =>
            s.enabled &&
            (s.name.toLowerCase().includes(q) ||
              s.displayName.toLowerCase().includes(q) ||
              s.description?.toLowerCase().includes(q)),
        )
        .map((s): MentionSkillItem => ({ ...s, isSkill: true, isMcp: false }));

      const local = prompts
        .filter(
          (p) =>
            p.shortcut.toLowerCase().includes(q) ||
            p.title.toLowerCase().includes(q),
        )
        .map(
          (p): MentionPromptItem => ({ ...p, isMcp: false, isSkill: false }),
        );

      const mcp = mcpPrompts
        .filter((p) => {
          if (selectedServerIds && !selectedServerIds.has(p.serverId)) {
            return false;
          }
          return (
            p.name.toLowerCase().includes(q) ||
            p.serverName.toLowerCase().includes(q) ||
            p.description?.toLowerCase().includes(q)
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
            isSkill: false,
          }),
        );

      return [...matchingSkills, ...local, ...mcp];
    }

    if (openTrigger === "@") {
      return assistants
        .filter(
          (a) =>
            a.name.toLowerCase().includes(q) ||
            a.description?.toLowerCase().includes(q),
        )
        .map(
          (a): MentionAssistantItem => ({ ...a, isMcp: false, isSkill: false }),
        );
    }

    if (openTrigger === "#") {
      return kbs
        .filter(
          (kb) =>
            kb.name.toLowerCase().includes(q) ||
            kb.description?.toLowerCase().includes(q),
        )
        .map(
          (kb): MentionKnowledgebaseItem => ({
            ...kb,
            isMcp: false,
            isSkill: false,
          }),
        );
    }

    return [];
  }, [
    commandQuery,
    skills,
    prompts,
    mcpPrompts,
    assistants,
    kbs,
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
      const lastHashIndex = textBeforeCursor.lastIndexOf("#");

      let triggerIndex = -1;
      let activeTrigger: MentionTrigger = null;

      if (
        lastSlashIndex > lastAtIndex &&
        lastSlashIndex > lastHashIndex &&
        !selectedPrompt
      ) {
        triggerIndex = lastSlashIndex;
        activeTrigger = "/";
      } else if (
        lastAtIndex > lastSlashIndex &&
        lastAtIndex > lastHashIndex &&
        !selectedAssistant &&
        !activeChatAssistantId &&
        canMentionAssistant
      ) {
        triggerIndex = lastAtIndex;
        activeTrigger = "@";
      } else if (
        lastHashIndex > lastSlashIndex &&
        lastHashIndex > lastAtIndex
      ) {
        triggerIndex = lastHashIndex;
        activeTrigger = "#";
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
          if (isSkillItem(item)) {
            onSelectSkill?.(item);
          } else if (isPromptItem(item)) {
            setSelectedPrompt(item);
          }
        } else if (openTrigger === "@") {
          if (isAssistantItem(item)) {
            setSelectedAssistant(item);
          }
        } else if (openTrigger === "#") {
          if (isKnowledgebaseItem(item)) {
            setSelectedKnowledgebase(item);
            onSelectKnowledgebase?.(item);
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
    [
      input,
      cursorPosition,
      setInput,
      textareaRef,
      openTrigger,
      onSelectSkill,
      onSelectKnowledgebase,
    ],
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
    selectedKnowledgebase,
    setSelectedKnowledgebase,
    handleInputChange,
    handleKeyDown,
    handleSelect,
  };
}
